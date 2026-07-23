import {
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type TaskStatus,
} from "@planevo/core/types/tasks"

const STATUS_STYLES: Record<(typeof TASK_STATUSES)[number], string> = {
  not_started: "border-border bg-paper text-text-secondary",
  in_progress: "border-border-strong bg-sidebar text-ink",
  in_review: "border-border bg-surface-raised text-ink",
  done: "border-meadow bg-meadow-tint text-ink",
  cancelled: "border-border bg-paper text-text-muted",
}

type TaskStatusPillProps = {
  status: TaskStatus
  className?: string
}

export function TaskStatusPill({ status, className = "" }: TaskStatusPillProps) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-product-meta ${STATUS_STYLES[status]} ${className}`}
    >
      <span className="sr-only">Status: </span>
      {TASK_STATUS_LABELS[status]}
    </span>
  )
}
