"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { dateKey, weekRange } from "@planevo/core/state/calendar-state";
import type {
  CalendarColor,
  CalendarEventRow,
  CalendarRow,
} from "@planevo/core/types/calendar";
import { cn } from "@/lib/utils";
import { CalendarColorDot } from "./calendar-color-dot";
import { formatTimeLabel } from "./time-axis";
import { TodayTaskRow, type TodayColumnTask } from "./today-task-row";

type Bucket = "week" | "month" | "none";

export type TodayColumnGroups = {
  thisWeek: TodayColumnTask[];
  thisMonth: TodayColumnTask[];
  unscheduled: TodayColumnTask[];
};

/** This week (incl. overdue/today) → this month → undated. Beyond month drops. */
export function groupTodayColumnTasks(
  tasks: TodayColumnTask[],
  now: Date,
): TodayColumnGroups {
  const open = tasks.filter(
    (task) => task.status !== "done" && task.status !== "cancelled",
  );
  const weekEnd = weekRange(now).end.getTime();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

  const groups: TodayColumnGroups = {
    thisWeek: [],
    thisMonth: [],
    unscheduled: [],
  };

  for (const task of open) {
    if (!task.due_at) {
      groups.unscheduled.push(task);
      continue;
    }
    const due = new Date(task.due_at).getTime();
    if (Number.isNaN(due)) groups.unscheduled.push(task);
    else if (due < weekEnd) groups.thisWeek.push(task);
    else if (due < monthEnd) groups.thisMonth.push(task);
  }

  return groups;
}

type TodayEvent = {
  id: string;
  title: string;
  timeLabel: string;
  color: CalendarColor;
};

function collectTodayEvents(
  events: CalendarEventRow[],
  calendars: CalendarRow[],
  now: Date,
): TodayEvent[] {
  const colorByCalendarId = new Map(
    calendars.map((calendar) => [calendar.id, calendar.color]),
  );
  const visibleCalendarIds = new Set(
    calendars.filter((calendar) => calendar.is_visible).map((c) => c.id),
  );
  const todayKey = dateKey(now);
  return events
    .filter(
      (event) =>
        visibleCalendarIds.has(event.calendar_id) &&
        dateKey(new Date(event.starts_at)) === todayKey,
    )
    .sort((a, b) => {
      if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
      return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    })
    .map((event) => ({
      id: event.id,
      title: event.title,
      timeLabel: event.all_day
        ? "All day"
        : formatTimeLabel(new Date(event.starts_at)),
      color: colorByCalendarId.get(event.calendar_id) ?? "slate",
    }));
}

function TaskGroup({
  label,
  bucket,
  tasks,
  onToggleTask,
  onQuickAddTask,
}: {
  label: string;
  bucket: Bucket;
  tasks: TodayColumnTask[];
  onToggleTask: (taskId: string, done: boolean) => void;
  onQuickAddTask: (title: string, bucket: Bucket) => void;
}) {
  const [open, setOpen] = useState(true);
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = value.trim();
    if (!title) return;
    onQuickAddTask(title, bucket);
    setValue("");
    setAdding(false);
  }

  return (
    <section aria-label={label}>
      <div className="group/head flex items-center gap-1 px-1">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center gap-1 rounded-md py-1 text-left outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {open ? (
            <ChevronDown
              aria-hidden="true"
              className="size-3.5 shrink-0 text-text-muted"
            />
          ) : (
            <ChevronRight
              aria-hidden="true"
              className="size-3.5 shrink-0 text-text-muted"
            />
          )}
          <span className="text-label uppercase text-text-muted">{label}</span>
          {tasks.length > 0 ? (
            <span className="text-label text-text-muted">{tasks.length}</span>
          ) : null}
        </button>
        <button
          type="button"
          aria-label={`Add task to ${label}`}
          onClick={() => {
            setAdding(true);
            setOpen(true);
          }}
          className="flex size-6 items-center justify-center rounded-md text-text-muted opacity-0 outline-none transition-opacity hover:bg-surface-raised hover:text-ink focus-visible:opacity-100 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink group-hover/head:opacity-100"
        >
          <Plus aria-hidden="true" className="size-4" />
        </button>
      </div>

      {open ? (
        <div className="flex flex-col gap-0.5 pb-1">
          {adding ? (
            <form onSubmit={handleSubmit} className="px-1 py-1">
              <input
                autoFocus
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onBlur={() => {
                  if (!value.trim()) setAdding(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setAdding(false);
                }}
                placeholder="Task name…"
                aria-label={`New task in ${label}`}
                className="w-full rounded-md border border-border bg-surface-raised px-2 py-1.5 text-product-body text-ink outline-none placeholder:text-text-muted focus-visible:border-border-strong"
              />
            </form>
          ) : null}
          {tasks.length === 0 && !adding ? (
            <p className="px-2 pb-1 text-product-meta text-text-muted">
              Nothing here
            </p>
          ) : (
            tasks.map((task) => (
              <TodayTaskRow
                key={task.id}
                task={task}
                onToggle={onToggleTask}
              />
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}

type CalendarTasksSectionProps = {
  tasks: TodayColumnTask[];
  events: CalendarEventRow[];
  calendars: CalendarRow[];
  now: Date;
  onToggleTask: (taskId: string, done: boolean) => void;
  onQuickAddTask: (title: string, bucket: Bucket) => void;
};

/** Tasks / today's events body for the Planning sidebar Tasks accordion. */
export function CalendarTasksSection({
  tasks,
  events,
  calendars,
  now,
  onToggleTask,
  onQuickAddTask,
}: CalendarTasksSectionProps) {
  const [tab, setTab] = useState<"todos" | "events">("todos");
  const groups = groupTodayColumnTasks(tasks, now);
  const todayEvents = collectTodayEvents(events, calendars, now);

  return (
    <div className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label="Tasks view"
        className="flex rounded-xl border border-border bg-surface-raised p-1"
      >
        {([
          { id: "todos", label: "To-do list" },
          { id: "events", label: "Events" },
        ] as const).map((option) => {
          const isSelected = tab === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setTab(option.id)}
              className={cn(
                "flex-1 rounded-lg px-3 py-1.5 text-product-body font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none",
                isSelected
                  ? "bg-paper text-ink shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
                  : "text-text-muted hover:text-ink",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {tab === "todos" ? (
        <div className="flex flex-col gap-3">
          <TaskGroup
            label="This week"
            bucket="week"
            tasks={groups.thisWeek}
            onToggleTask={onToggleTask}
            onQuickAddTask={onQuickAddTask}
          />
          <TaskGroup
            label="This month"
            bucket="month"
            tasks={groups.thisMonth}
            onToggleTask={onToggleTask}
            onQuickAddTask={onQuickAddTask}
          />
          <TaskGroup
            label="Unscheduled"
            bucket="none"
            tasks={groups.unscheduled}
            onToggleTask={onToggleTask}
            onQuickAddTask={onQuickAddTask}
          />
          <p className="px-2 pt-1 text-product-meta text-text-muted">
            Drag a task onto the grid to schedule it
          </p>
        </div>
      ) : todayEvents.length === 0 ? (
        <p className="px-2 py-2 text-product-meta text-text-muted">
          No events today
        </p>
      ) : (
        <div className="flex flex-col gap-0.5">
          {todayEvents.map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-surface-raised"
            >
              <CalendarColorDot color={event.color} />
              <span className="w-16 shrink-0 text-product-meta tabular-nums text-text-secondary">
                {event.timeLabel}
              </span>
              <span className="truncate text-product-body text-ink">
                {event.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Open-task count shown on the Tasks accordion header. */
export function countOpenPlanningTasks(
  tasks: TodayColumnTask[],
  now: Date,
): number {
  const groups = groupTodayColumnTasks(tasks, now);
  return (
    groups.thisWeek.length +
    groups.thisMonth.length +
    groups.unscheduled.length
  );
}
