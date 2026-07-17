import type { TaskWithMeta } from "@planevo/core/queries/product-tasks";
import type { TaskPriority } from "@planevo/core/types/tasks";
import { Icon } from "@/components/ui/planevo-icon";

type TaskCardProps = {
  task: TaskWithMeta;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
};

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: "long",
  day: "numeric",
  year: "numeric",
});

const PRIORITY_STYLES: Record<
  TaskPriority,
  { label: string; className: string }
> = {
  high: {
    label: "High",
    className: "border-brick bg-brick-tint text-brick",
  },
  medium: {
    label: "Medium",
    className: "border-border-strong bg-surface-raised text-ink",
  },
  low: {
    label: "Low",
    className: "border-meadow bg-meadow-tint text-meadow",
  },
};

function dueDateDetails(task: TaskWithMeta): {
  date: Date;
  isOverdue: boolean;
} | null {
  if (!task.due_at) return null;

  const date = new Date(task.due_at);
  if (Number.isNaN(date.getTime())) return null;

  const isFinished = task.status === "done" || task.status === "cancelled";
  return {
    date,
    isOverdue: !isFinished && date.getTime() < Date.now(),
  };
}

export function TaskCard({
  task,
  isDragging = false,
  dragHandleProps,
}: TaskCardProps) {
  const title = task.title.trim() || "Untitled task";
  const priority = task.priority ? PRIORITY_STYLES[task.priority] : null;
  const due = dueDateDetails(task);
  const allSubtasksDone =
    task.subtaskTotal > 0 && task.subtaskDone >= task.subtaskTotal;
  const fileLabel = task.fileCount === 1 ? "file" : "files";

  return (
    <article
      {...dragHandleProps}
      className={`rounded-xl border border-border bg-paper p-4 text-ink ${
        isDragging ? "opacity-40" : ""
      } ${
        dragHandleProps
          ? "touch-none cursor-grab outline-none active:cursor-grabbing focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <h3 className="min-w-0 flex-1 text-body font-medium">{title}</h3>
        {priority ? (
          <span
            className={`shrink-0 rounded-full border px-2 py-1 text-label ${priority.className}`}
          >
            <span className="sr-only">Priority: </span>
            {priority.label}
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-border bg-paper px-2 py-1 text-label text-text-muted">
            No priority
          </span>
        )}
      </div>

      <div className="mt-5 flex items-center gap-2 text-small">
        <Icon
          name="calendar"
          className={`size-4 shrink-0 ${due?.isOverdue ? "text-brick" : "text-text-muted"}`}
        />
        {due ? (
          <time
            dateTime={task.due_at ?? undefined}
            aria-label={`${due.isOverdue ? "Overdue. Due" : "Due"} ${LONG_DATE_FORMATTER.format(due.date)}`}
            className={due.isOverdue ? "font-medium text-brick" : "text-text-secondary"}
          >
            {due.isOverdue ? "Overdue" : "Due"} {SHORT_DATE_FORMATTER.format(due.date)}
          </time>
        ) : (
          <span className="text-text-muted">No due date</span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-small">
        <span
          className={`flex items-center gap-2 ${
            allSubtasksDone ? "font-medium text-meadow" : "text-text-secondary"
          }`}
        >
          <Icon name={allSubtasksDone ? "check" : "tasks"} className="size-4 shrink-0" />
          {task.subtaskDone} of {task.subtaskTotal} Subtasks
        </span>
        <span className="flex items-center gap-2 text-text-secondary">
          <Icon name="document" className="size-4 shrink-0 text-text-muted" />
          {task.fileCount} {fileLabel}
        </span>
      </div>
    </article>
  );
}
