"use client";

import { dateKey, weekRange } from "@planevo/core/state/calendar-state";
import { TodayTaskRow, type TodayColumnTask } from "./today-task-row";

export type TodayColumnGroups = {
  today: TodayColumnTask[];
  thisWeek: TodayColumnTask[];
  unscheduled: TodayColumnTask[];
};

/**
 * Sunsama-style buckets: overdue and due-today tasks lead, the rest of this
 * week follows, undated tasks wait in Unscheduled. Done and cancelled tasks
 * stay out — the column is a picker for schedulable work.
 */
export function groupTodayColumnTasks(
  tasks: TodayColumnTask[],
  now: Date,
): TodayColumnGroups {
  const open = tasks.filter(
    (task) => task.status !== "done" && task.status !== "cancelled",
  );
  const todayKey = dateKey(now);
  const { end: weekEnd } = weekRange(now);

  const today: TodayColumnTask[] = [];
  const thisWeek: TodayColumnTask[] = [];
  const unscheduled: TodayColumnTask[] = [];

  for (const task of open) {
    if (!task.due_at) {
      unscheduled.push(task);
      continue;
    }
    const due = new Date(task.due_at);
    if (Number.isNaN(due.getTime())) {
      unscheduled.push(task);
      continue;
    }
    if (dateKey(due) === todayKey || due.getTime() < now.getTime()) {
      today.push(task);
    } else if (due.getTime() < weekEnd.getTime()) {
      thisWeek.push(task);
    }
    // Due beyond this week: out of the column's horizon.
  }

  return { today, thisWeek, unscheduled };
}

const COLUMN_TABS = [
  { label: "To-dos", enabled: true },
  { label: "Event", enabled: false },
  { label: "Notes", enabled: false },
] as const;

function TaskSection({
  label,
  tasks,
}: {
  label: string;
  tasks: TodayColumnTask[];
}) {
  return (
    <section aria-label={label}>
      <h3 className="px-2 pb-1 text-label uppercase text-text-muted">{label}</h3>
      {tasks.length === 0 ? (
        <p className="px-2 pb-2 text-product-meta text-text-muted">Nothing here</p>
      ) : (
        <div className="flex flex-col gap-0.5 pb-2">
          {tasks.map((task) => (
            <TodayTaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </section>
  );
}

export function TodayColumn({
  tasks,
  now,
}: {
  tasks: TodayColumnTask[];
  now: Date;
}) {
  const groups = groupTodayColumnTasks(tasks, now);

  return (
    <div className="flex h-full w-full flex-col">
      <header className="border-b border-border px-2 pb-2">
        <h2 className="px-2 text-h3">Today</h2>
        <div role="tablist" aria-label="Today column" className="mt-2 flex gap-1">
          {COLUMN_TABS.map((tab) => (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={tab.enabled}
              disabled={!tab.enabled}
              className={`rounded-lg px-2.5 py-1 text-product-body outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
                tab.enabled
                  ? "font-medium text-ink underline decoration-2 underline-offset-8"
                  : "cursor-not-allowed text-text-muted"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto py-3">
        <TaskSection label="Today" tasks={groups.today} />
        <TaskSection label="This week" tasks={groups.thisWeek} />
        <TaskSection label="Unscheduled" tasks={groups.unscheduled} />
        <p className="mt-auto px-2 text-product-meta text-text-muted">
          Drag a task onto the grid to schedule it
        </p>
      </div>
    </div>
  );
}
