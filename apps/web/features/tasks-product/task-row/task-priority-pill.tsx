import type { TaskPriority } from "@planevo/core/types/tasks"
import { Badge } from "@/components/ui/badge"

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
}

const PRIORITY_VARIANTS: Record<
  TaskPriority,
  "destructive" | "secondary" | "outline"
> = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
}

type TaskPriorityPillProps = {
  priority: TaskPriority
}

export function TaskPriorityPill({ priority }: TaskPriorityPillProps) {
  return (
    <Badge variant={PRIORITY_VARIANTS[priority]}>
      <span className="sr-only">Priority: </span>
      {PRIORITY_LABELS[priority]}
    </Badge>
  )
}
