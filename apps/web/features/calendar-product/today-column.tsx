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

function MiniCalendar({ now }: { now: Date }) {
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay === 0 ? 6 : firstDay - 1 }, (_, i) => i); // Monday start
  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-product-body font-medium text-ink">
          {now.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex gap-2">
          <button className="text-text-muted hover:text-ink size-5 flex items-center justify-center rounded">&lt;</button>
          <button className="text-text-muted hover:text-ink size-5 flex items-center justify-center rounded">&gt;</button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {weekDays.map((d, i) => (
          <div key={`${d}-${i}`} className="text-label uppercase font-medium text-text-muted">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1 gap-x-1 text-center">
        {blanks.map(b => <div key={`blank-${b}`} />)}
        {days.map(d => {
          const isToday = d === now.getDate();
          return (
            <button
              key={d}
              className={`text-product-meta size-7 flex items-center justify-center rounded-full hover:bg-surface-raised mx-auto ${
                isToday ? 'bg-ink text-paper font-medium' : 'text-ink'
              }`}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
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
    <div className="flex h-full w-full flex-col bg-paper">
      <MiniCalendar now={now} />
      
      <div className="px-4 pt-2 pb-1">
        <h2 className="text-h3 font-medium tracking-tight mb-2">To-dos</h2>
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-2">
        <TaskSection label="Today" tasks={groups.today} />
        <TaskSection label="This week" tasks={groups.thisWeek} />
        <TaskSection label="Unscheduled" tasks={groups.unscheduled} />
        <p className="mt-auto px-2 pb-4 text-product-meta text-text-muted text-center">
          Drag a task onto the grid to schedule it
        </p>
      </div>
    </div>
  );
}

