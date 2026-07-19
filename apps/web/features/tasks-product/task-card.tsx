import type { TaskWithMeta } from "@planevo/core/queries/product-tasks";
import type { TaskPriority } from "@planevo/core/types/tasks";
import type { Ref } from "react";
import { ArchiveBoxIcon, TagIcon } from "@heroicons/react/24/outline";
import { Icon } from "@/components/ui/planevo-icon";

type TaskCardProps = {
  task: TaskWithMeta;
  isDragging?: boolean;
  dragHandleProps?: Record<string, unknown>;
  dragHandleRef?: Ref<HTMLButtonElement>;
  onOpen?: () => void;
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
    className: "border-brick bg-brick-tint text-ink",
  },
  medium: {
    label: "Medium",
    className: "border-border-strong bg-surface-raised text-ink",
  },
  low: {
    label: "Low",
    className: "border-meadow bg-meadow-tint text-ink",
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

function taskTags(task: TaskWithMeta): string[] {
  const tags = task.description_json.tags;
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag): tag is string => typeof tag === "string").slice(0, 6);
}

function taskMonogram(title: string): string {
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    return `${words[0]![0] ?? ""}${words[1]![0] ?? ""}`.toLocaleUpperCase();
  }
  return (words[0] ?? "T").slice(0, 2).toLocaleUpperCase();
}

export function TaskCard({
  task,
  isDragging = false,
  dragHandleProps,
  dragHandleRef,
  onOpen,
}: TaskCardProps) {
  const title = task.title.trim() || "Untitled task";
  const monogram = taskMonogram(title);
  const priority = task.priority ? PRIORITY_STYLES[task.priority] : null;
  const due = dueDateDetails(task);
  const tags = taskTags(task);
  const allSubtasksDone =
    task.subtaskTotal > 0 && task.subtaskDone >= task.subtaskTotal;
  const fileLabel = task.fileCount === 1 ? "file" : "files";

  return (
    <article
      className={`rounded-xl border border-border bg-surface-raised p-3 text-ink transition-colors hover:border-border-strong motion-reduce:transition-none ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-sidebar font-mono text-label text-text-secondary"
        >
          {monogram}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-small font-medium">
            {onOpen ? (
              <button
                type="button"
                onClick={onOpen}
                className="max-w-full truncate rounded-lg text-left outline-none hover:underline focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {title}
              </button>
            ) : (
              title
            )}
          </h3>
          <p
            className={`mt-0.5 text-label ${
              allSubtasksDone
                ? "font-medium text-ink"
                : "text-text-secondary"
            }`}
          >
            {task.subtaskTotal > 0
              ? `${task.subtaskDone} of ${task.subtaskTotal} subtasks`
              : "No subtasks"}
          </p>
        </div>
        {priority ? (
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-label ${priority.className}`}
          >
            <span className="sr-only">Priority: </span>
            {priority.label}
          </span>
        ) : null}
        {dragHandleProps ? (
          <button
            ref={dragHandleRef}
            type="button"
            {...dragHandleProps}
            aria-label={`Move task: ${title}`}
            className="touch-none flex size-7 shrink-0 cursor-grab items-center justify-center rounded-lg text-text-muted outline-none hover:bg-sidebar hover:text-ink active:cursor-grabbing focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Icon name="menu" className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex h-20 items-center justify-center rounded-lg border border-border bg-paper">
        <ArchiveBoxIcon
          aria-hidden="true"
          className={`size-12 ${
            task.fileCount > 0 ? "text-text-secondary" : "text-text-muted"
          }`}
        />
      </div>

      {tags.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Tags">
          {tags.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-paper px-2 py-0.5 text-label text-text-secondary"
            >
              <TagIcon aria-hidden="true" className="size-3 shrink-0" />
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-2 text-label">
        <span className="flex items-center gap-1.5 text-text-secondary">
          <Icon name="document" className="size-3.5 shrink-0" />
          {String(task.fileCount).padStart(2, "0")} {fileLabel}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-text-secondary">
          <Icon
            name="calendar"
            className={`size-3.5 shrink-0 ${due?.isOverdue ? "text-brick" : ""}`}
          />
          {due ? (
            <time
              dateTime={task.due_at ?? undefined}
              aria-label={`${due.isOverdue ? "Overdue. Due" : "Due"} ${LONG_DATE_FORMATTER.format(due.date)}`}
              className={due.isOverdue ? "font-medium text-ink" : ""}
            >
              {due.isOverdue ? "Overdue" : "Due"} {SHORT_DATE_FORMATTER.format(due.date)}
            </time>
          ) : (
            <span>No due date</span>
          )}
        </span>
      </div>
    </article>
  );
}
