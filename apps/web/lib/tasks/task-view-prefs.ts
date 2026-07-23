import type { TaskListGrouping } from "@/lib/tasks/task-view-state"

export const TASKS_VIEW_PREFS_STORAGE_KEY = "planevo:tasks:view-prefs"

export type TasksPersistedView = "board" | "list" | "table"

export type TaskTableSortKey =
  | "title"
  | "status"
  | "priority"
  | "due"
  | "subtasks"
  | "files"

export type TaskTableSortDirection = "ascending" | "descending"

export type TasksViewPrefs = {
  view: TasksPersistedView
  grouping: TaskListGrouping
  sort: { key: TaskTableSortKey; direction: TaskTableSortDirection }
  collapsedGroups: string[]
  hideDone: boolean
}

export const DEFAULT_TASKS_VIEW_PREFS: TasksViewPrefs = {
  view: "board",
  grouping: "status",
  sort: { key: "title", direction: "ascending" },
  collapsedGroups: [],
  hideDone: false,
}

const VIEWS = new Set<TasksPersistedView>(["board", "list", "table"])
const GROUPINGS = new Set<TaskListGrouping>(["status", "priority"])
const SORT_KEYS = new Set<TaskTableSortKey>([
  "title",
  "status",
  "priority",
  "due",
  "subtasks",
  "files",
])
const SORT_DIRS = new Set<TaskTableSortDirection>(["ascending", "descending"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function parseTasksViewPrefs(value: unknown): TasksViewPrefs {
  if (!isRecord(value)) return { ...DEFAULT_TASKS_VIEW_PREFS }

  const view =
    typeof value.view === "string" &&
    VIEWS.has(value.view as TasksPersistedView)
      ? (value.view as TasksPersistedView)
      : DEFAULT_TASKS_VIEW_PREFS.view

  const grouping =
    typeof value.grouping === "string" &&
    GROUPINGS.has(value.grouping as TaskListGrouping)
      ? (value.grouping as TaskListGrouping)
      : DEFAULT_TASKS_VIEW_PREFS.grouping

  const sortRecord = isRecord(value.sort) ? value.sort : null
  const sortKey =
    sortRecord &&
    typeof sortRecord.key === "string" &&
    SORT_KEYS.has(sortRecord.key as TaskTableSortKey)
      ? (sortRecord.key as TaskTableSortKey)
      : DEFAULT_TASKS_VIEW_PREFS.sort.key
  const sortDirection =
    sortRecord &&
    typeof sortRecord.direction === "string" &&
    SORT_DIRS.has(sortRecord.direction as TaskTableSortDirection)
      ? (sortRecord.direction as TaskTableSortDirection)
      : DEFAULT_TASKS_VIEW_PREFS.sort.direction

  const collapsedGroups = Array.isArray(value.collapsedGroups)
    ? value.collapsedGroups.filter(
        (entry): entry is string => typeof entry === "string",
      )
    : []

  const hideDone =
    typeof value.hideDone === "boolean"
      ? value.hideDone
      : DEFAULT_TASKS_VIEW_PREFS.hideDone

  return {
    view,
    grouping,
    sort: { key: sortKey, direction: sortDirection },
    collapsedGroups,
    hideDone,
  }
}

export function getTasksViewPrefs(): TasksViewPrefs {
  if (typeof window === "undefined") return { ...DEFAULT_TASKS_VIEW_PREFS }

  try {
    const raw = window.localStorage.getItem(TASKS_VIEW_PREFS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_TASKS_VIEW_PREFS }
    return parseTasksViewPrefs(JSON.parse(raw) as unknown)
  } catch {
    return { ...DEFAULT_TASKS_VIEW_PREFS }
  }
}

export function setTasksViewPrefs(prefs: TasksViewPrefs): void {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(
      TASKS_VIEW_PREFS_STORAGE_KEY,
      JSON.stringify(prefs),
    )
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function updateTasksViewPrefs(
  patch: Partial<TasksViewPrefs>,
): TasksViewPrefs {
  const next = { ...getTasksViewPrefs(), ...patch }
  if (patch.sort) {
    next.sort = { ...getTasksViewPrefs().sort, ...patch.sort }
  }
  setTasksViewPrefs(next)
  return next
}
