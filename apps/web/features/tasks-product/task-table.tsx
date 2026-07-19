"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { TaskWithMeta } from "@planevo/core/queries/product-tasks";
import {
  TASK_PRIORITIES,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type TaskPriority,
} from "@planevo/core/types/tasks";
import { Icon, type IconName } from "@/components/ui/planevo-icon";
import { getShellLayoutTransition } from "@/lib/motion/shell-spring";
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion";

type TaskTableProps = {
  tasks: TaskWithMeta[];
  onTaskSelect?: (taskId: string) => void;
  fillHeight?: boolean;
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
  { key: "title", label: "Title", icon: "tasks" },
  { key: "status", label: "Status", icon: "check" },
  { key: "priority", label: "Priority", icon: "star" },
  { key: "due", label: "Due", icon: "calendar" },
  { key: "subtasks", label: "Subtasks", icon: "tasks" },
  { key: "files", label: "Files", icon: "document" },
] as const satisfies ReadonlyArray<{
  key: SortKey;
  label: string;
  icon: IconName;
}>;

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

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  high: "border-brick bg-brick-tint text-ink",
  medium: "border-border-strong bg-paper text-ink",
  low: "border-meadow bg-meadow-tint text-ink",
};

const STATUS_STYLES: Record<
  (typeof TASK_STATUSES)[number],
  string
> = {
  not_started: "border-border bg-paper text-text-secondary",
  in_progress: "border-border-strong bg-sidebar text-ink",
  in_review: "border-border bg-surface-raised text-ink",
  done: "border-meadow bg-meadow-tint text-ink",
  cancelled: "border-border bg-paper text-text-muted",
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

function ColumnHeader({
  column,
  sort,
  onSelectSort,
}: {
  column: (typeof COLUMNS)[number];
  sort: SortState;
  onSelectSort: (key: SortKey) => void;
}) {
  const isActive = sort.key === column.key;
  const ariaSort = isActive ? sort.direction : "none";
  const SortIcon = sort.direction === "ascending" ? ChevronUp : ChevronDown;

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`sticky top-0 z-10 border-b border-border bg-paper px-4 py-2.5 text-left ${
        column.key === "title" ? "min-w-64" : "whitespace-nowrap"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelectSort(column.key)}
        className="inline-flex items-center gap-2 rounded-lg text-product-column text-text-muted outline-none transition-colors hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
      >
        <Icon name={column.icon} className="size-3.5 shrink-0 text-text-muted" />
        {column.label}
        {isActive ? (
          <SortIcon aria-hidden="true" className="size-3.5 text-ink" />
        ) : null}
        <span className="sr-only">
          {isActive
            ? `, sorted ${sort.direction}. Activate to sort ${sort.direction === "ascending" ? "descending" : "ascending"}.`
            : ", not sorted. Activate to sort ascending."}
        </span>
      </button>
    </th>
  );
}

export function TaskTable({
  tasks,
  onTaskSelect,
  fillHeight = false,
}: TaskTableProps) {
  const [sort, setSort] = useState<SortState>({
    key: "title",
    direction: "ascending",
  });
  const prefersReducedMotion = usePrefersReducedMotion();
  const layoutTransition = getShellLayoutTransition(prefersReducedMotion);
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

  const tableContent = (
    <div
      role="region"
      aria-label="Tasks table. Scroll horizontally to see all columns."
      tabIndex={0}
      className={`flex min-h-0 flex-col overflow-hidden border border-border bg-paper outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
        fillHeight ? "min-h-0 flex-1" : ""
      }`}
    >
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <ColumnHeader
                  key={column.key}
                  column={column}
                  sort={sort}
                  onSelectSort={selectSort}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((task) => {
              const title = task.title.trim() || "Untitled task";
              const due = dueTimestamp(task.due_at);

              return (
                <tr
                  key={task.id}
                  className="border-b border-border transition-colors hover:bg-sidebar/40 motion-reduce:transition-none"
                >
                  <th scope="row" className="px-4 py-2.5 text-product-title text-ink">
                    {onTaskSelect ? (
                      <button
                        type="button"
                        onClick={() => onTaskSelect(task.id)}
                        aria-label={`Open task: ${title}`}
                        className="max-w-full truncate rounded-lg text-left outline-none hover:underline focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                      >
                        {title}
                      </button>
                    ) : (
                      <span className="block max-w-full truncate">{title}</span>
                    )}
                  </th>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-product-meta ${STATUS_STYLES[task.status]}`}
                    >
                      {TASK_STATUS_LABELS[task.status]}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {task.priority ? (
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-product-meta ${PRIORITY_STYLES[task.priority]}`}
                      >
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                    ) : (
                      <span className="text-product-meta text-text-muted">No priority</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-product-body text-text-secondary">
                    {due !== null ? (
                      <time dateTime={new Date(due).toISOString()}>
                        {DATE_FORMATTER.format(due)}
                      </time>
                    ) : (
                      "No due date"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-product-stat tabular-nums text-text-secondary">
                    {task.subtaskDone} / {task.subtaskTotal}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-product-stat tabular-nums text-text-secondary">
                    {String(task.fileCount).padStart(2, "0")}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-4 py-12 text-center text-product-meta text-text-muted"
                >
                  No tasks to display.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex shrink-0 items-center border-t border-border bg-paper px-4 py-2.5">
        <p className="text-product-meta tabular-nums text-text-muted">
          Count {rows.length}
        </p>
      </div>
    </div>
  );

  if (!fillHeight) {
    return tableContent;
  }

  return (
    <motion.div
      layout
      transition={layoutTransition}
      className="flex min-h-0 flex-1 flex-col"
    >
      {tableContent}
    </motion.div>
  );
}
