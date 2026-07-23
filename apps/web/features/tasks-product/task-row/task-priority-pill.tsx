import type { TaskPriority } from "@planevo/core/types/tasks"
import { Badge } from "@/components/ui/badge"

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
}

type TaskPriorityPillProps = {
  priority: TaskPriority
}

export function TaskPriorityPill({ priority }: TaskPriorityPillProps) {
  return (
    <Badge variant={priority}>
      <span className="sr-only">Priority: </span>
      {PRIORITY_LABELS[priority]}
    </Badge>
  )
}
