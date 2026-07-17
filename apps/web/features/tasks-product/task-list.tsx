"use client";

import type { TaskWithMeta } from "@planevo/core/queries/product-tasks";
import {
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from "@planevo/core/types/tasks";
import { Icon } from "@/components/ui/planevo-icon";

type TaskListProps = {
  tasks: TaskWithMeta[];
  onTaskSelect?: (taskId: string) => void;
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
  high: "border-brick bg-brick-tint text-brick",
  medium: "border-border-strong bg-paper text-ink",
  low: "border-meadow bg-meadow-tint text-meadow",
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
    : `Due ${DATE_FORMATTER.format(date)}`;
}

function TaskListRow({
  task,
  onTaskSelect,
}: {
  task: TaskWithMeta;
  onTaskSelect?: (taskId: string) => void;
}) {
  const title = task.title.trim() || "Untitled task";
  const fileLabel = task.fileCount === 1 ? "file" : "files";
  const rowContent = (
    <>
      <span className="min-w-0 flex-1 truncate text-left text-body font-medium text-ink">
        {title}
      </span>
      {task.priority ? (
        <span
          className={`shrink-0 rounded-full border px-2 py-1 text-label ${PRIORITY_STYLES[task.priority]}`}
        >
          <span className="sr-only">Priority: </span>
          {PRIORITY_LABELS[task.priority]}
        </span>
      ) : (
        <span className="shrink-0 rounded-full border border-border bg-paper px-2 py-1 text-label text-text-muted">
          No priority
        </span>
      )}
      <span className="flex shrink-0 items-center gap-1.5 text-small text-text-secondary">
        <Icon name="calendar" className="size-4 text-text-muted" />
        {formatDueDate(task.due_at)}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-small text-text-secondary">
        <Icon name="tasks" className="size-4 text-text-muted" />
        {task.subtaskDone} of {task.subtaskTotal}
        <span className="sr-only"> subtasks complete</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-small text-text-secondary">
        <Icon name="document" className="size-4 text-text-muted" />
        {task.fileCount} {fileLabel}
      </span>
    </>
  );

  return (
    <li className="border-t border-border first:border-t-0">
      {onTaskSelect ? (
        <button
          type="button"
          onClick={() => onTaskSelect(task.id)}
          aria-label={`Open task: ${title}`}
          className="flex w-full min-w-max items-center gap-4 px-4 py-3 text-left outline-none transition-colors hover:bg-paper focus-visible:bg-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
        >
          {rowContent}
        </button>
      ) : (
        <div className="flex min-w-max items-center gap-4 px-4 py-3">
          {rowContent}
        </div>
      )}
    </li>
  );
}

function TaskStatusGroup({
  status,
  tasks,
  onTaskSelect,
}: {
  status: TaskStatus;
  tasks: TaskWithMeta[];
  onTaskSelect?: (taskId: string) => void;
}) {
  const headingId = `task-list-${status}`;
  const countLabel = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;

  return (
    <section aria-labelledby={headingId}>
      <div className="flex items-center justify-between gap-3 border-b border-border bg-paper px-4 py-2">
        <h3 id={headingId} className="text-small font-medium text-ink">
          {TASK_STATUS_LABELS[status]}
        </h3>
        <span
          aria-label={countLabel}
          className="font-mono text-mono text-text-muted"
        >
          {tasks.length}
        </span>
      </div>
      {tasks.length > 0 ? (
        <ul>{tasks.map((task) => <TaskListRow key={task.id} task={task} onTaskSelect={onTaskSelect} />)}</ul>
      ) : (
        <p className="px-4 py-3 text-small text-text-muted">No tasks in this group.</p>
      )}
    </section>
  );
}

export function TaskList({ tasks, onTaskSelect }: TaskListProps) {
  return (
    <div
      role="region"
      aria-label="Tasks list"
      className="overflow-x-auto rounded-card border border-border bg-surface-raised"
    >
      <div className="min-w-max">
        {TASK_STATUSES.map((status) => (
          <TaskStatusGroup
            key={status}
            status={status}
            tasks={orderedTasks(tasks.filter((task) => task.status === status))}
            onTaskSelect={onTaskSelect}
          />
        ))}
      </div>
    </div>
  );
}
