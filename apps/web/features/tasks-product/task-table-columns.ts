import type { IconName } from "@/components/ui/planevo-icon"
import type { TaskTableSortKey } from "@/lib/tasks/task-view-prefs"

export const TASK_TABLE_COLUMNS = [
  { key: "title", label: "Title", icon: "tasks" },
  { key: "status", label: "Status", icon: "check" },
  { key: "priority", label: "Priority", icon: "star" },
  { key: "due", label: "Due", icon: "calendar" },
  { key: "subtasks", label: "Subtasks", icon: "tasks" },
  { key: "files", label: "Files", icon: "document" },
] as const satisfies ReadonlyArray<{
  key: TaskTableSortKey
  label: string
  icon: IconName
}>

export type TaskTableColumn = (typeof TASK_TABLE_COLUMNS)[number]
