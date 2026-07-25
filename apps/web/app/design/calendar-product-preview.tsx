"use client";

import { DndContext } from "@dnd-kit/core";
import type {
  CalendarEventRow,
  CalendarRow,
  TaskDueChip,
} from "@planevo/core/types/calendar";
import { useState } from "react";
import { PanelLeft } from "lucide-react";
import { CalendarGridEngine } from "@/features/calendar-product/calendar-grid-engine";
import { CalendarPlanningSidebar } from "@/features/calendar-product/calendar-planning-sidebar";
import { CalendarTasksSection } from "@/features/calendar-product/calendar-tasks-section";
import { CreateEventPopover } from "@/features/calendar-product/create-event-popover";
import { EventPeek } from "@/features/calendar-product/event-peek";
import type { TodayColumnTask } from "@/features/calendar-product/today-task-row";

/** Fixed clock so preview states do not drift day to day. */
const DESIGN_NOW = new Date(2026, 6, 15, 13, 0);
const DESIGN_WEEK_START = new Date(2026, 6, 13);
const DESIGN_MONTH_ANCHOR = new Date(2026, 6, 24);
const DESIGN_MONTH_NOW = new Date(2026, 6, 24, 10, 0);
const DESIGN_SIX_WEEK_MONTH_ANCHOR = new Date(2026, 4, 24);
const DESIGN_SIX_WEEK_MONTH_NOW = new Date(2026, 4, 24, 10, 0);

const DESIGN_TODAY_TASKS: TodayColumnTask[] = [
  {
    id: "task-marketing",
    title: "Marketing page",
    status: "not_started",
    due_at: "2026-07-15T17:00:00.000Z",
  },
  {
    id: "task-wireframe",
    title: "Wireframe - Paper",
    status: "in_progress",
    due_at: "2026-07-14T09:00:00.000Z",
  },
  {
    id: "task-invoice",
    title: "Invoice template design",
    status: "not_started",
    due_at: "2026-07-17T12:00:00.000Z",
  },
  {
    id: "task-research",
    title: "UX research flow",
    status: "not_started",
    due_at: null,
  },
  {
    id: "task-widgets",
    title: "Review UI widgets",
    status: "not_started",
    due_at: null,
  },
  {
    id: "task-done",
    title: "Landing page",
    status: "done",
    due_at: "2026-07-15T10:00:00.000Z",
  },
];

export const DESIGN_CALENDARS: CalendarRow[] = [
  {
    id: "cal-personal",
    user_id: "design-owner",
    name: "Personal",
    color: "ocean",
    is_visible: true,
    position: 0,
    created_at: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "cal-work",
    user_id: "design-owner",
    name: "Work",
    color: "slate",
    is_visible: true,
    position: 1,
    created_at: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "cal-holidays",
    user_id: "design-owner",
    name: "Holidays",
    color: "meadow",
    is_visible: false,
    position: 2,
    created_at: "2026-07-01T00:00:00.000Z",
  },
];

function previewTime(dayOfMonth: number, hour: number, minute = 0): string {
  return new Date(2026, 6, dayOfMonth, hour, minute).toISOString();
}

function previewEvent(
  overrides: Partial<CalendarEventRow> &
    Pick<
      CalendarEventRow,
      "id" | "title" | "starts_at" | "ends_at" | "calendar_id"
    >,
): CalendarEventRow {
  return {
    user_id: "design-owner",
    all_day: false,
    location: null,
    description_json: {},
    task_id: null,
    google_event_id: null,
    source: "planevo",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

const DESIGN_EVENTS: CalendarEventRow[] = [
  previewEvent({
    id: "ev-standup",
    title: "Standup call",
    calendar_id: "cal-work",
    starts_at: previewTime(13, 12),
    ends_at: previewTime(13, 13),
  }),
  previewEvent({
    id: "ev-design",
    title: "Design system",
    calendar_id: "cal-work",
    starts_at: previewTime(14, 10),
    ends_at: previewTime(14, 11),
  }),
  previewEvent({
    id: "ev-review",
    title: "Tuesday review",
    calendar_id: "cal-personal",
    starts_at: previewTime(14, 14),
    ends_at: previewTime(14, 15, 30),
    task_id: "task-wireframe",
  }),
  previewEvent({
    id: "ev-cricket",
    title: "Cricket",
    calendar_id: "cal-personal",
    starts_at: previewTime(17, 14, 30),
    ends_at: previewTime(17, 16, 45),
    location: "Mumbai, Maharastra",
  }),
  previewEvent({
    id: "ev-hidden",
    title: "Holiday planning",
    calendar_id: "cal-holidays",
    starts_at: previewTime(15, 9),
    ends_at: previewTime(15, 10),
  }),
];

const DESIGN_MONTH_EVENTS: CalendarEventRow[] = [
  previewEvent({
    id: "ev-month-span",
    title: "Team offsite",
    calendar_id: "cal-work",
    starts_at: new Date(2026, 5, 30, 9, 0).toISOString(),
    ends_at: new Date(2026, 6, 3, 17, 0).toISOString(),
  }),
  previewEvent({
    id: "ev-month-allday",
    title: "Independence Day",
    calendar_id: "cal-personal",
    all_day: true,
    starts_at: new Date(2026, 6, 4, 0, 0).toISOString(),
    ends_at: new Date(2026, 6, 5, 0, 0).toISOString(),
  }),
  previewEvent({
    id: "ev-month-sync",
    title: "Team sync",
    calendar_id: "cal-work",
    starts_at: previewTime(24, 9, 0),
    ends_at: previewTime(24, 10, 0),
  }),
  previewEvent({
    id: "ev-month-review",
    title: "Design review",
    calendar_id: "cal-work",
    starts_at: previewTime(24, 11, 30),
    ends_at: previewTime(24, 12, 30),
  }),
  previewEvent({
    id: "ev-month-lunch",
    title: "Lunch with Alex",
    calendar_id: "cal-personal",
    starts_at: previewTime(24, 12, 0),
    ends_at: previewTime(24, 13, 0),
  }),
  previewEvent({
    id: "ev-overflow-1",
    title: "Morning standup",
    calendar_id: "cal-work",
    starts_at: previewTime(3, 9, 0),
    ends_at: previewTime(3, 9, 30),
  }),
  previewEvent({
    id: "ev-overflow-2",
    title: "Sprint planning",
    calendar_id: "cal-work",
    starts_at: previewTime(3, 10, 0),
    ends_at: previewTime(3, 11, 0),
  }),
  previewEvent({
    id: "ev-overflow-3",
    title: "Client call",
    calendar_id: "cal-personal",
    starts_at: previewTime(3, 11, 30),
    ends_at: previewTime(3, 12, 30),
  }),
  previewEvent({
    id: "ev-overflow-4",
    title: "1:1 with manager",
    calendar_id: "cal-work",
    starts_at: previewTime(3, 14, 0),
    ends_at: previewTime(3, 14, 30),
  }),
  previewEvent({
    id: "ev-overflow-5",
    title: "Docs review",
    calendar_id: "cal-work",
    starts_at: previewTime(3, 15, 0),
    ends_at: previewTime(3, 16, 0),
  }),
  previewEvent({
    id: "ev-overflow-6",
    title: "Retro",
    calendar_id: "cal-work",
    starts_at: previewTime(3, 16, 30),
    ends_at: previewTime(3, 17, 30),
  }),
  previewEvent({
    id: "ev-aug-1",
    title: "August kickoff",
    calendar_id: "cal-personal",
    starts_at: new Date(2026, 7, 1, 10, 0).toISOString(),
    ends_at: new Date(2026, 7, 1, 11, 0).toISOString(),
  }),
];

const DESIGN_MONTH_TASK_DUES: TaskDueChip[] = [
  {
    taskId: "task-month-open",
    title: "Send the project brief",
    dueAt: previewTime(24, 10, 30),
    status: "in_progress",
  },
  {
    taskId: "task-month-complete",
    title: "Review research notes",
    dueAt: previewTime(24, 16),
    status: "done",
  },
];

const DESIGN_MONTH_MULTI_DAY_EVENTS = DESIGN_MONTH_EVENTS.filter((event) =>
  ["ev-month-span", "ev-month-allday", "ev-month-sync"].includes(event.id),
);

const DESIGN_MONTH_OUTSIDE_EVENTS = DESIGN_MONTH_EVENTS.filter((event) =>
  event.id === "ev-aug-1",
);

const DESIGN_SIX_WEEK_DENSE_EVENTS: CalendarEventRow[] = [
  previewEvent({
    id: "ev-may-bar",
    title: "Annual planning",
    calendar_id: "cal-work",
    all_day: true,
    starts_at: new Date(2026, 4, 24, 0, 0).toISOString(),
    ends_at: new Date(2026, 4, 26, 0, 0).toISOString(),
  }),
  ...[9, 10, 11, 13, 14, 15].map((hour, index) =>
    previewEvent({
      id: `ev-may-dense-${hour}`,
      title: [
        "Team sync",
        "Research review",
        "Partner call",
        "Draft handoff",
        "Focus block",
        "Wrap-up",
      ][index]!,
      calendar_id: index % 2 === 0 ? "cal-work" : "cal-personal",
      starts_at: new Date(2026, 4, 24, hour, 0).toISOString(),
      ends_at: new Date(2026, 4, 24, hour + 1, 0).toISOString(),
    }),
  ),
];

const DESIGN_SIX_WEEK_TASK_DUES: TaskDueChip[] = [
  {
    taskId: "task-may-open",
    title: "Send the planning notes",
    dueAt: new Date(2026, 4, 24, 8, 30).toISOString(),
    status: "in_progress",
  },
  {
    taskId: "task-may-complete",
    title: "Close last week’s review",
    dueAt: new Date(2026, 4, 24, 17).toISOString(),
    status: "done",
  },
];

function noop() {
  // Design previews render interactions inert.
}

function PlanningSidebarFrame({
  todayTasks = DESIGN_TODAY_TASKS,
  calendars = DESIGN_CALENDARS,
}: {
  todayTasks?: TodayColumnTask[];
  calendars?: CalendarRow[];
}) {
  return (
    <div className="calendar-rail-glass h-full w-80 overflow-hidden rounded-xl">
      <DndContext>
        <CalendarPlanningSidebar
          calendars={calendars}
          events={DESIGN_EVENTS}
          todayTasks={todayTasks}
          now={DESIGN_NOW}
          weekStart={DESIGN_WEEK_START}
          onSelectDay={noop}
          onToggleVisibility={noop}
          onCreateCalendar={noop}
          onToggleTask={noop}
          onQuickAddTask={noop}
          onCollapse={noop}
        />
      </DndContext>
    </div>
  );
}

function EventPeekDemo() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const peekEvent = DESIGN_EVENTS[3]!;

  return (
    <div>
      <button
        type="button"
        onClick={(clickEvent) =>
          setAnchor(anchor ? null : clickEvent.currentTarget)
        }
        className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-product-body font-medium text-ink hover:bg-paper"
      >
        {anchor ? "Close event peek" : "Open event peek"}
      </button>
      {anchor ? (
        <EventPeek
          event={{
            ...peekEvent,
            description_json: {
              text: "Everyone should join this call. The team is all set for the new update.",
            },
          }}
          calendar={DESIGN_CALENDARS[0]!}
          anchor={anchor}
          onClose={() => setAnchor(null)}
          onLinkTask={noop}
          onAttachFile={noop}
          onAddToWorkspace={noop}
        />
      ) : null}
    </div>
  );
}

function CreateEventDemo() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-product-body font-medium text-ink hover:bg-paper"
      >
        Open create-event form
      </button>
      {open ? (
        <CreateEventPopover
          slotStart={new Date(2026, 6, 15, 9, 30)}
          calendars={DESIGN_CALENDARS}
          onSubmit={() => setOpen(false)}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

type MonthDesignStateProps = {
  label: string;
  events: CalendarEventRow[];
  taskDues?: TaskDueChip[];
  anchor?: Date;
  now?: Date;
};

function MonthDesignState({
  label,
  events,
  taskDues = [],
  anchor = DESIGN_MONTH_ANCHOR,
  now = DESIGN_MONTH_NOW,
}: MonthDesignStateProps) {
  return (
    <>
      <figure className="w-full">
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Month state — {label} · light
        </figcaption>
        <div className="calendar-panel-glass h-80 overflow-hidden rounded-xl p-2">
          <CalendarGridEngine
            view="month"
            anchor={anchor}
            calendars={DESIGN_CALENDARS}
            events={events}
            taskDues={taskDues}
            now={now}
            onSlotSelect={noop}
            onEventSelect={noop}
            onEventTimesChange={noop}
            onToggleTask={noop}
            onOpenDay={noop}
          />
        </div>
      </figure>
      <figure data-theme="dark" className="w-full">
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Month state — {label} · dark
        </figcaption>
        <div className="calendar-panel-glass h-80 overflow-hidden rounded-xl p-2">
          <CalendarGridEngine
            view="month"
            anchor={anchor}
            calendars={DESIGN_CALENDARS}
            events={events}
            taskDues={taskDues}
            now={now}
            onSlotSelect={noop}
            onEventSelect={noop}
            onEventTimesChange={noop}
            onToggleTask={noop}
            onOpenDay={noop}
          />
        </div>
      </figure>
    </>
  );
}

export function CalendarProductPreview() {
  return (
    <div className="flex flex-wrap gap-8">
      <figure className="w-full">
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Two-pane product — Planning rail · react-big-calendar week grid
        </figcaption>
        <div className="flex h-[36rem] gap-3 overflow-hidden rounded-xl bg-sidebar p-3">
          <DndContext>
            <div className="calendar-rail-glass w-80 shrink-0 overflow-hidden rounded-xl">
              <CalendarPlanningSidebar
                calendars={DESIGN_CALENDARS}
                events={DESIGN_EVENTS}
                todayTasks={DESIGN_TODAY_TASKS}
                now={DESIGN_NOW}
                weekStart={DESIGN_WEEK_START}
                onSelectDay={noop}
                onToggleVisibility={noop}
                onCreateCalendar={noop}
                onToggleTask={noop}
                onQuickAddTask={noop}
                onCollapse={noop}
              />
            </div>
            <div className="calendar-panel-glass min-w-0 flex-1 overflow-hidden rounded-xl p-2">
              <CalendarGridEngine
                view="week"
                anchor={DESIGN_WEEK_START}
                calendars={DESIGN_CALENDARS}
                events={DESIGN_EVENTS}
                taskDues={[]}
                now={DESIGN_NOW}
                onSlotSelect={noop}
                onEventSelect={noop}
                onEventTimesChange={noop}
                onToggleTask={noop}
                onOpenDay={noop}
              />
            </div>
          </DndContext>
        </div>
      </figure>

      <MonthDesignState label="empty" events={[]} />
      <MonthDesignState
        label="normal"
        events={DESIGN_MONTH_EVENTS.slice(0, 5)}
      />
      <MonthDesignState
        label="dense overflow"
        anchor={DESIGN_SIX_WEEK_MONTH_ANCHOR}
        now={DESIGN_SIX_WEEK_MONTH_NOW}
        events={DESIGN_SIX_WEEK_DENSE_EVENTS}
        taskDues={DESIGN_SIX_WEEK_TASK_DUES}
      />
      <MonthDesignState
        label="multi-day"
        events={DESIGN_MONTH_MULTI_DAY_EVENTS}
      />
      <MonthDesignState
        label="outside-month"
        events={DESIGN_MONTH_OUTSIDE_EVENTS}
      />
      <MonthDesignState
        label="task due"
        events={DESIGN_MONTH_EVENTS.slice(2, 5)}
        taskDues={DESIGN_MONTH_TASK_DUES}
      />

      <figure>
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Planning rail — all sections open
        </figcaption>
        <div className="h-[32rem]">
          <PlanningSidebarFrame />
        </div>
      </figure>

      <figure>
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Planning rail — empty tasks + empty calendars
        </figcaption>
        <div className="h-[28rem]">
          <PlanningSidebarFrame todayTasks={[]} calendars={[]} />
        </div>
      </figure>

      <figure>
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Agenda collapsed — reveal control
        </figcaption>
        <div className="calendar-panel-glass flex w-80 items-center gap-2 rounded-xl p-4">
          <button
            type="button"
            aria-label="Show agenda"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <PanelLeft aria-hidden="true" className="size-4" />
          </button>
          <div>
            <p className="text-product-meta text-text-muted">Calendar</p>
            <p className="text-h3 font-semibold text-ink">Calendar</p>
          </div>
        </div>
      </figure>

      <figure>
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Tasks section — empty buckets
        </figcaption>
        <div className="calendar-rail-glass w-80 overflow-hidden rounded-xl p-4">
          <DndContext>
            <CalendarTasksSection
              tasks={[]}
              events={[]}
              calendars={DESIGN_CALENDARS}
              now={DESIGN_NOW}
              onToggleTask={noop}
              onQuickAddTask={noop}
            />
          </DndContext>
        </div>
      </figure>

      <figure>
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Mobile agenda drawer
        </figcaption>
        <div className="relative h-[28rem] w-80 overflow-hidden rounded-xl bg-ink/40">
          <div className="calendar-rail-glass absolute inset-y-0 right-0 flex w-full flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-product-body font-medium text-ink">Agenda</p>
              <span className="text-product-meta text-text-secondary">Close</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <DndContext>
                <CalendarPlanningSidebar
                  calendars={DESIGN_CALENDARS}
                  events={DESIGN_EVENTS}
                  todayTasks={DESIGN_TODAY_TASKS}
                  now={DESIGN_NOW}
                  weekStart={DESIGN_WEEK_START}
                  onSelectDay={noop}
                  onToggleVisibility={noop}
                  onCreateCalendar={noop}
                  onToggleTask={noop}
                  onQuickAddTask={noop}
                  onCollapse={noop}
                  hideCollapseControl
                />
              </DndContext>
            </div>
          </div>
        </div>
      </figure>

      <figure>
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Event peek — anchored popover with cross-links
        </figcaption>
        <EventPeekDemo />
      </figure>

      <figure>
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Create event — from grid slot click
        </figcaption>
        <CreateEventDemo />
      </figure>
    </div>
  );
}
