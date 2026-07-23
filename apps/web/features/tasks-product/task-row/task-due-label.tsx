import type { TaskStatus } from "@planevo/core/types/tasks"
import { Icon } from "@/components/ui/planevo-icon"
import { getRelativeDueLabel } from "@/lib/tasks/task-row-formatters"

type TaskDueLabelProps = {
  dueAt: string | null
  status: TaskStatus
  showIcon?: boolean
}

export function TaskDueLabel({
  dueAt,
  status,
  showIcon = true,
}: TaskDueLabelProps) {
  const due = getRelativeDueLabel(dueAt, status)
  if (!due) return null

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-product-meta ${
        due.isOverdue ? "text-brick" : "text-text-secondary"
      }`}
    >
      {showIcon ? (
        <Icon
          name="calendar"
          className={`size-3.5 ${due.isOverdue ? "text-brick" : "text-text-muted"}`}
        />
      ) : null}
      <time dateTime={due.date.toISOString()}>{due.label}</time>
    </span>
  )
}
