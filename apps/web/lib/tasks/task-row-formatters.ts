import type { TaskWithMeta } from "@planevo/core/queries/product-tasks"
import type { TaskPriority, TaskStatus } from "@planevo/core/types/tasks"
import { taskDueState } from "./task-due-state.ts"
import type { TaskListGrouping } from "./task-view-state.ts"

export type TaskMetadataContext = {
  view: "list" | "table"
  grouping?: TaskListGrouping
}

export type VisibleTaskMetadata = {
  showStatus: boolean
  showPriority: boolean
  showDue: boolean
  showSubtasks: boolean
  showFiles: boolean
}

export type RelativeDueKind =
  | "overdue"
  | "today"
  | "tomorrow"
  | "weekday"
  | "date"

export type RelativeDueLabel = {
  kind: RelativeDueKind
  label: string
  date: Date
  isOverdue: boolean
}

const SHORT_DATE = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
})

const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: "short" })

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function dayDiff(from: Date, to: Date): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime()
  return Math.round(ms / 86_400_000)
}

export function getVisibleMetadata(
  task: Pick<
    TaskWithMeta,
    "status" | "priority" | "due_at" | "subtaskTotal" | "fileCount"
  >,
  context: TaskMetadataContext,
): VisibleTaskMetadata {
  const showStatus =
    context.view === "table" ||
    (context.view === "list" && context.grouping === "priority")

  return {
    showStatus,
    showPriority: task.priority != null,
    showDue: Boolean(task.due_at),
    showSubtasks: task.subtaskTotal > 0,
    showFiles: task.fileCount > 0,
  }
}

export function getRelativeDueLabel(
  dueAt: string | null,
  status: TaskStatus,
  now = new Date(),
): RelativeDueLabel | null {
  const due = taskDueState(dueAt, status, now)
  if (!due) return null

  if (due.kind === "overdue") {
    return {
      kind: "overdue",
      label: "Overdue",
      date: due.date,
      isOverdue: true,
    }
  }

  const diff = dayDiff(now, due.date)
  if (diff === 0) {
    return { kind: "today", label: "Today", date: due.date, isOverdue: false }
  }
  if (diff === 1) {
    return {
      kind: "tomorrow",
      label: "Tomorrow",
      date: due.date,
      isOverdue: false,
    }
  }
  if (diff > 1 && diff <= 7) {
    return {
      kind: "weekday",
      label: WEEKDAY.format(due.date),
      date: due.date,
      isOverdue: false,
    }
  }

  return {
    kind: "date",
    label: SHORT_DATE.format(due.date),
    date: due.date,
    isOverdue: false,
  }
}

export function descriptionTextFromTask(
  task: Pick<TaskWithMeta, "description_json">,
): string {
  const text = task.description_json.text
  return typeof text === "string" ? text : ""
}

export function tagsFromTask(
  task: Pick<TaskWithMeta, "description_json">,
): string[] {
  const tags = task.description_json.tags
  if (!Array.isArray(tags)) return []
  return tags.filter((tag): tag is string => typeof tag === "string")
}

export function buildTaskUpdatePayload(
  task: TaskWithMeta,
  patch: {
    status?: TaskStatus
    priority?: TaskPriority | null
    dueAt?: string | null
    title?: string
  },
) {
  return {
    taskId: task.id,
    title: patch.title ?? task.title,
    status: patch.status ?? task.status,
    priority: patch.priority !== undefined ? patch.priority : task.priority,
    dueAt: patch.dueAt !== undefined ? patch.dueAt : task.due_at,
    description: descriptionTextFromTask(task),
    tags: tagsFromTask(task),
  }
}

export function toggleDoneStatus(
  current: TaskStatus,
  previousNonDone: TaskStatus | null = null,
): TaskStatus {
  if (current === "done") {
    const fallback = previousNonDone ?? "not_started"
    return fallback === "done" || fallback === "cancelled"
      ? "not_started"
      : fallback
  }
  return "done"
}
