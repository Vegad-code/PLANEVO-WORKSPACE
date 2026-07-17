"use client";

import { useMemo, useState } from "react";
import type { TaskWithMeta } from "@planevo/core/queries/product-tasks";
import {
  TASK_PRIORITIES,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type TaskPriority,
} from "@planevo/core/types/tasks";

type TaskTableProps = {
  tasks: TaskWithMeta[];
  onTaskSelect?: (taskId: string) => void;
};

type SortKey =
  | "title"
  | "status"
  | "priority"
  | "due"
  | "subtasks"
  | "files";

type SortDirection = "ascending" | "descending";

type SortState = {
  key: SortKey;
  direction: SortDirection;
};

const COLUMNS = [
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "due", label: "Due" },
  { key: "subtasks", label: "Subtasks" },
  { key: "files", label: "Files" },
] as const satisfies ReadonlyArray<{ key: SortKey; label: string }>;

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const TITLE_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const STATUS_ORDER = new Map(TASK_STATUSES.map((status, index) => [status, index]));
const PRIORITY_ORDER = new Map(
  [...TASK_PRIORITIES].reverse().map((priority, index) => [priority, index]),
);

function compareNullableNumbers(left: number | null, right: number | null): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}

function dueTimestamp(dueAt: string | null): number | null {
  if (!dueAt) return null;

  const timestamp = new Date(dueAt).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function compareTasks(left: TaskWithMeta, right: TaskWithMeta, key: SortKey): number {
  switch (key) {
    case "title":
      return TITLE_COLLATOR.compare(left.title.trim(), right.title.trim());
    case "status":
      return (STATUS_ORDER.get(left.status) ?? Number.MAX_SAFE_INTEGER) -
        (STATUS_ORDER.get(right.status) ?? Number.MAX_SAFE_INTEGER);
    case "priority":
      return compareNullableNumbers(
        left.priority ? (PRIORITY_ORDER.get(left.priority) ?? null) : null,
        right.priority ? (PRIORITY_ORDER.get(right.priority) ?? null) : null,
      );
    case "due":
      return compareNullableNumbers(dueTimestamp(left.due_at), dueTimestamp(right.due_at));
    case "subtasks":
      return left.subtaskTotal - right.subtaskTotal || left.subtaskDone - right.subtaskDone;
    case "files":
      return left.fileCount - right.fileCount;
  }
}

function sortedTasks(tasks: TaskWithMeta[], sort: SortState): TaskWithMeta[] {
  const direction = sort.direction === "ascending" ? 1 : -1;

  return [...tasks].sort((left, right) => {
    const primary = compareTasks(left, right, sort.key);
    return primary === 0 ? left.id.localeCompare(right.id) : primary * direction;
  });
}

export function TaskTable({ tasks, onTaskSelect }: TaskTableProps) {
  const [sort, setSort] = useState<SortState>({
    key: "title",
    direction: "ascending",
  });
  const rows = useMemo(() => sortedTasks(tasks, sort), [tasks, sort]);

  function selectSort(key: SortKey) {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "ascending"
          ? "descending"
          : "ascending",
    }));
  }

  return (
    <div
      role="region"
      aria-label="Tasks table. Scroll horizontally to see all columns."
      tabIndex={0}
      className="overflow-x-auto rounded-card border border-border bg-surface-raised outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <table className="min-w-full border-collapse text-left">
        <thead className="bg-paper">
          <tr>
            {COLUMNS.map((column) => {
              const isActive = sort.key === column.key;
              const ariaSort = isActive ? sort.direction : "none";

              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort}
                  className={`border-b border-border px-4 py-3 text-label uppercase text-text-muted ${
                    column.key === "title" ? "min-w-64" : "whitespace-nowrap"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectSort(column.key)}
                    className="inline-flex items-center gap-2 rounded-lg outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    {column.label}
                    {isActive ? (
                      <span aria-hidden="true">
                        {sort.direction === "ascending" ? "↑" : "↓"}
                      </span>
                    ) : null}
                    <span className="sr-only">
                      {isActive
                        ? `, sorted ${sort.direction}. Activate to sort ${sort.direction === "ascending" ? "descending" : "ascending"}.`
                        : ", not sorted. Activate to sort ascending."}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((task) => {
            const title = task.title.trim() || "Untitled task";
            const due = dueTimestamp(task.due_at);

            return (
              <tr key={task.id} className="border-b border-border last:border-b-0 hover:bg-paper">
                <th scope="row" className="px-4 py-3 text-body font-medium text-ink">
                  {onTaskSelect ? (
                    <button
                      type="button"
                      onClick={() => onTaskSelect(task.id)}
                      aria-label={`Open task: ${title}`}
                      className="rounded-lg text-left outline-none hover:underline focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                    >
                      {title}
                    </button>
                  ) : (
                    title
                  )}
                </th>
                <td className="whitespace-nowrap px-4 py-3 text-small text-text-secondary">
                  {TASK_STATUS_LABELS[task.status]}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-small text-text-secondary">
                  {task.priority ? PRIORITY_LABELS[task.priority] : "No priority"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-small text-text-secondary">
                  {due !== null ? (
                    <time dateTime={new Date(due).toISOString()}>
                      {DATE_FORMATTER.format(due)}
                    </time>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-mono text-text-secondary">
                  {task.subtaskDone} / {task.subtaskTotal}
                </td>
                <td className="whitespace-nowrap px-4 py-3 font-mono text-mono text-text-secondary">
                  {task.fileCount}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={COLUMNS.length} className="px-4 py-8 text-center text-small text-text-muted">
                No tasks to display.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
