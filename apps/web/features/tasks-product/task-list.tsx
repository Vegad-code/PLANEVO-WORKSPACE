"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { TaskWithMeta } from "@planevo/core/queries/product-tasks";
import {
  TASK_STATUS_LABELS,
  type TaskPriority,
} from "@planevo/core/types/tasks";
import { Icon } from "@/components/ui/planevo-icon";
import { getShellLayoutTransition } from "@/lib/motion/shell-spring";
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion";
import {
  groupTasksForList,
  type TaskListGrouping,
  type TaskListGroupKey,
} from "@/lib/tasks/task-view-state";

type TaskListProps = {
  tasks: TaskWithMeta[];
  onTaskSelect?: (taskId: string) => void;
  fillHeight?: boolean;
};

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  high: "border-brick bg-brick-tint text-ink",
  medium: "border-border-strong bg-paper text-ink",
  low: "border-meadow bg-meadow-tint text-ink",
};

function orderedTasks(tasks: TaskWithMeta[]): TaskWithMeta[] {
  return [...tasks].sort(
    (left, right) =>
      left.position - right.position || left.id.localeCompare(right.id),
  );
}

function formatDueDate(dueAt: string | null): string {
  if (!dueAt) return "No due date";

  const date = new Date(dueAt);
  return Number.isNaN(date.getTime())
    ? "No due date"
    : DATE_FORMATTER.format(date);
}

function TaskListRow({
  task,
  onTaskSelect,
}: {
  task: TaskWithMeta;
  onTaskSelect?: (taskId: string) => void;
}) {
  const title = task.title.trim() || "Untitled task";
  const rowContent = (
    <>
      <span className="min-w-0 flex-1 truncate text-product-title text-ink">
        {title}
      </span>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
        {task.priority ? (
          <span
            className={`rounded-full border px-2.5 py-0.5 text-product-meta ${PRIORITY_STYLES[task.priority]}`}
          >
            <span className="sr-only">Priority: </span>
            {PRIORITY_LABELS[task.priority]}
          </span>
        ) : null}
        <span className="hidden items-center gap-1.5 text-product-body text-text-secondary sm:inline-flex">
          <Icon name="calendar" className="size-3.5 text-text-muted" />
          {formatDueDate(task.due_at)}
        </span>
        <span className="flex items-center gap-1.5 text-product-stat tabular-nums text-text-secondary">
          {task.subtaskDone}/{task.subtaskTotal}
          <span className="sr-only"> subtasks complete</span>
        </span>
      </div>
    </>
  );

  return (
    <li className="border-b border-border last:border-b-0">
      {onTaskSelect ? (
        <button
          type="button"
          onClick={() => onTaskSelect(task.id)}
          aria-label={`Open task: ${title}`}
          className="flex w-full items-center gap-4 px-4 py-3 text-left outline-none transition-colors hover:bg-sidebar/40 focus-visible:bg-sidebar/40 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
        >
          {rowContent}
        </button>
      ) : (
        <div className="flex items-center gap-4 px-4 py-3">{rowContent}</div>
      )}
    </li>
  );
}

function groupLabel(key: TaskListGroupKey, grouping: TaskListGrouping): string {
  if (grouping === "status") return TASK_STATUS_LABELS[key as keyof typeof TASK_STATUS_LABELS];
  return key === "none" ? "No priority" : PRIORITY_LABELS[key as TaskPriority];
}

function TaskGroup({
  groupKey,
  grouping,
  tasks,
  onTaskSelect,
}: {
  groupKey: TaskListGroupKey;
  grouping: TaskListGrouping;
  tasks: TaskWithMeta[];
  onTaskSelect?: (taskId: string) => void;
}) {
  const headingId = `task-list-${grouping}-${groupKey}`;
  const countLabel = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;

  return (
    <section aria-labelledby={headingId}>
      <div className="flex items-center justify-between gap-3 border-b border-border bg-sidebar/60 px-4 py-2.5">
        <h3
          id={headingId}
          className="text-product-column text-text-muted"
        >
          {groupLabel(groupKey, grouping)}
        </h3>
        <span
          aria-label={countLabel}
          className="text-product-stat tabular-nums text-text-muted"
        >
          {String(tasks.length).padStart(2, "0")}
        </span>
      </div>
      {tasks.length > 0 ? (
        <ul>
          {tasks.map((task) => (
            <TaskListRow key={task.id} task={task} onTaskSelect={onTaskSelect} />
          ))}
        </ul>
      ) : (
        <p className="border-b border-border px-4 py-4 text-product-meta text-text-muted">
          No tasks in this group.
        </p>
      )}
    </section>
  );
}

export function TaskList({
  tasks,
  onTaskSelect,
  fillHeight = false,
}: TaskListProps) {
  const [grouping, setGrouping] = useState<TaskListGrouping>("status");
  const prefersReducedMotion = usePrefersReducedMotion();
  const layoutTransition = getShellLayoutTransition(prefersReducedMotion);
  const groups = groupTasksForList(tasks, grouping);

  const listContent = (
    <div
      role="region"
      aria-label="Tasks list"
      className={`flex min-h-0 flex-col overflow-hidden border border-border bg-paper ${
        fillHeight ? "min-h-0 flex-1" : ""
      }`}
    >
      <div className="flex shrink-0 justify-end border-b border-border bg-paper px-4 py-2.5">
        <label className="flex items-center gap-2 text-product-body text-text-secondary">
          Group by
          <select
            value={grouping}
            onChange={(event) =>
              setGrouping(event.target.value as TaskListGrouping)
            }
            className="rounded-lg border border-border bg-paper px-2.5 py-1.5 text-product-body text-ink outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <option value="status">Status</option>
            <option value="priority">Priority</option>
          </select>
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {groups.map((group) => (
          <TaskGroup
            key={group.key}
            groupKey={group.key}
            grouping={grouping}
            tasks={orderedTasks(group.tasks)}
            onTaskSelect={onTaskSelect}
          />
        ))}
      </div>
      <div className="flex shrink-0 items-center border-t border-border bg-paper px-4 py-2.5">
        <p className="text-product-meta tabular-nums text-text-muted">
          Count {tasks.length}
        </p>
      </div>
    </div>
  );

  if (!fillHeight) {
    return listContent;
  }

  return (
    <motion.div
      layout
      transition={layoutTransition}
      className="flex min-h-0 flex-1 flex-col"
    >
      {listContent}
    </motion.div>
  );
}
