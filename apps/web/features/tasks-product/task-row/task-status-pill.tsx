import {
  TASK_STATUS_LABELS,
  type TaskStatus,
} from "@planevo/core/types/tasks"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const STATUS_VARIANTS: Record<
  TaskStatus,
  "default" | "secondary" | "outline" | "ghost"
> = {
  not_started: "outline",
  in_progress: "default",
  in_review: "secondary",
  done: "secondary",
  cancelled: "ghost",
}

type TaskStatusPillProps = {
  status: TaskStatus
  className?: string
}

export function TaskStatusPill({ status, className = "" }: TaskStatusPillProps) {
  return (
    <Badge variant={STATUS_VARIANTS[status]} className={cn(className)}>
      <span className="sr-only">Status: </span>
      {TASK_STATUS_LABELS[status]}
    </Badge>
  )
}
