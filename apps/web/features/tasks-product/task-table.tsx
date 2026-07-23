"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { ChevronDown, ChevronUp } from "lucide-react"
import type { TaskWithMeta } from "@planevo/core/queries/product-tasks"
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "@planevo/core/types/tasks"
import { resolveTaskIcon } from "@planevo/core/tasks/task-icon-classifier"
import { Icon } from "@/components/ui/planevo-icon"
import { getShellLayoutTransition } from "@/lib/motion/shell-spring"
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion"
import type {
  TaskTableSortDirection,
  TaskTableSortKey,
} from "@/lib/tasks/task-view-prefs"
import { TaskIconRender } from "./task-icon-render"
import { TaskDuePopover } from "./task-inline-edit/task-due-popover"
import { TaskPriorityPopover } from "./task-inline-edit/task-priority-popover"
import { TaskStatusPopover } from "./task-inline-edit/task-status-popover"
import {
  TaskDueLabel,
  TaskFileBadge,
  TaskPriorityPill,
  TaskRowCheckbox,
  TaskStatusPill,
  TaskSubtaskProgress,
  type TaskPatch,
} from "./task-row"
import {
  TASK_TABLE_COLUMNS,
  type TaskTableColumn,
} from "./task-table-columns"

type SortState = {
  key: TaskTableSortKey
  direction: TaskTableSortDirection
}

type TaskTableProps = {
  tasks: TaskWithMeta[]
  sort?: SortState
  onSortChange?: (sort: SortState) => void
  hideDone?: boolean
  onHideDoneChange?: (hideDone: boolean) => void
  onTaskSelect?: (taskId: string) => void
  onTaskPatch?: (taskId: string, patch: TaskPatch) => void
  onToggleComplete?: (taskId: string) => void
  fillHeight?: boolean
}

const TITLE_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
})

const STATUS_ORDER = new Map(TASK_STATUSES.map((status, index) => [status, index]))
const PRIORITY_ORDER = new Map(
  [...TASK_PRIORITIES].reverse().map((priority, index) => [priority, index]),
)

function compareNullableNumbers(left: number | null, right: number | null): number {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  return left - right
}

function dueTimestamp(dueAt: string | null): number | null {
  if (!dueAt) return null
  const timestamp = new Date(dueAt).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

function compareTasks(left: TaskWithMeta, right: TaskWithMeta, key: TaskTableSortKey): number {
  switch (key) {
    case "title":
      return TITLE_COLLATOR.compare(left.title.trim(), right.title.trim())
    case "status":
      return (
        (STATUS_ORDER.get(left.status) ?? Number.MAX_SAFE_INTEGER) -
        (STATUS_ORDER.get(right.status) ?? Number.MAX_SAFE_INTEGER)
      )
    case "priority":
      return compareNullableNumbers(
        left.priority ? (PRIORITY_ORDER.get(left.priority) ?? null) : null,
        right.priority ? (PRIORITY_ORDER.get(right.priority) ?? null) : null,
      )
    case "due":
      return compareNullableNumbers(dueTimestamp(left.due_at), dueTimestamp(right.due_at))
    case "subtasks":
      return left.subtaskTotal - right.subtaskTotal || left.subtaskDone - right.subtaskDone
    case "files":
      return left.fileCount - right.fileCount
    default: {
      const _exhaustive: never = key
      return _exhaustive
    }
  }
}

function sortedTasks(tasks: TaskWithMeta[], sort: SortState): TaskWithMeta[] {
  const direction = sort.direction === "ascending" ? 1 : -1
  return [...tasks].sort((left, right) => {
    const primary = compareTasks(left, right, sort.key)
    return primary === 0 ? left.id.localeCompare(right.id) : primary * direction
  })
}

function ColumnHeader({
  column,
  sort,
  onSelectSort,
}: {
  column: TaskTableColumn
  sort: SortState
  onSelectSort: (key: TaskTableSortKey) => void
}) {
  const isActive = sort.key === column.key
  const ariaSort = isActive ? sort.direction : "none"
  const SortIcon = sort.direction === "ascending" ? ChevronUp : ChevronDown

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`sticky top-0 z-10 border-b border-border bg-paper px-4 py-2.5 text-left ${
        column.key === "title"
          ? "left-0 z-20 min-w-64 bg-paper"
          : "whitespace-nowrap"
      }`}
    >
      <button
        type="button"
        onClick={() => onSelectSort(column.key)}
        className="inline-flex items-center gap-2 rounded-lg text-product-column text-text-muted outline-none transition-colors hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
      >
        <Icon name={column.icon} className="size-3.5 shrink-0 text-text-muted" />
        {column.label}
        {isActive ? (
          <SortIcon aria-hidden="true" className="size-3.5 text-ink" />
        ) : null}
        <span className="sr-only">
          {isActive
            ? `, sorted ${sort.direction}. Activate to sort ${sort.direction === "ascending" ? "descending" : "ascending"}.`
            : ", not sorted. Activate to sort ascending."}
        </span>
      </button>
    </th>
  )
}

export function TaskTable({
  tasks,
  sort: sortProp,
  onSortChange,
  hideDone = false,
  onHideDoneChange,
  onTaskSelect,
  onTaskPatch,
  onToggleComplete,
  fillHeight = false,
}: TaskTableProps) {
  const [localSort, setLocalSort] = useState<SortState>({
    key: "title",
    direction: "ascending",
  })
  const sort = sortProp ?? localSort
  const prefersReducedMotion = usePrefersReducedMotion()
  const layoutTransition = getShellLayoutTransition(prefersReducedMotion)

  const visibleTasks = useMemo(
    () => (hideDone ? tasks.filter((task) => task.status !== "done") : tasks),
    [hideDone, tasks],
  )
  const rows = useMemo(() => sortedTasks(visibleTasks, sort), [visibleTasks, sort])

  function selectSort(key: TaskTableSortKey) {
    const next: SortState = {
      key,
      direction:
        sort.key === key && sort.direction === "ascending"
          ? "descending"
          : "ascending",
    }
    if (onSortChange) onSortChange(next)
    else setLocalSort(next)
  }

  const tableContent = (
    <div
      role="region"
      aria-label="Tasks table. Scroll horizontally to see all columns."
      tabIndex={0}
      className={`flex min-h-0 flex-col overflow-hidden border border-border bg-paper outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
        fillHeight ? "min-h-0 flex-1" : ""
      }`}
    >
      {onHideDoneChange ? (
        <div className="flex shrink-0 items-center border-b border-border bg-paper px-4 py-2.5">
          <label className="inline-flex items-center gap-2 text-product-body text-text-secondary">
            <input
              type="checkbox"
              checked={hideDone}
              onChange={(event) => onHideDoneChange(event.target.checked)}
              className="size-3.5 rounded border-border-strong accent-ink"
            />
            Hide done
          </label>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full border-collapse text-left">
          <thead>
            <tr>
              {TASK_TABLE_COLUMNS.map((column) => (
                <ColumnHeader
                  key={column.key}
                  column={column}
                  sort={sort}
                  onSelectSort={selectSort}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((task) => {
              const title = task.title.trim() || "Untitled task"
              const isDone = task.status === "done"
              const icon = resolveTaskIcon(task, task.fileCount)

              return (
                <tr
                  key={task.id}
                  className="border-b border-border transition-colors hover:bg-sidebar/40 motion-reduce:transition-none"
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-[1] bg-paper px-4 py-2.5 text-product-title text-ink"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {onToggleComplete ? (
                        <TaskRowCheckbox
                          title={title}
                          checked={isDone}
                          onToggle={() => onToggleComplete(task.id)}
                        />
                      ) : null}
                      <span
                        aria-hidden="true"
                        className="flex size-6 shrink-0 items-center justify-center text-text-muted"
                      >
                        <TaskIconRender
                          definition={icon.definition}
                          style={icon.ref.style}
                          size="picker"
                          active={!isDone}
                        />
                      </span>
                      {onTaskSelect ? (
                        <button
                          type="button"
                          onClick={() => onTaskSelect(task.id)}
                          aria-label={`Open task: ${title}`}
                          className={`max-w-full truncate rounded-lg text-left outline-none hover:underline focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
                            isDone ? "text-text-muted line-through" : "text-ink"
                          }`}
                        >
                          {title}
                        </button>
                      ) : (
                        <span
                          className={`block max-w-full truncate ${
                            isDone ? "text-text-muted line-through" : ""
                          }`}
                        >
                          {title}
                        </span>
                      )}
                    </div>
                  </th>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {onTaskPatch ? (
                      <TaskStatusPopover
                        status={task.status}
                        onSelect={(status) => onTaskPatch(task.id, { status })}
                      />
                    ) : (
                      <TaskStatusPill status={task.status} />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {onTaskPatch ? (
                      <TaskPriorityPopover
                        priority={task.priority}
                        onSelect={(priority) =>
                          onTaskPatch(task.id, { priority })
                        }
                        emptyLabel=""
                      />
                    ) : task.priority ? (
                      <TaskPriorityPill priority={task.priority} />
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {onTaskPatch ? (
                      <TaskDuePopover
                        dueAt={task.due_at}
                        status={task.status}
                        onSelect={(dueAt) => onTaskPatch(task.id, { dueAt })}
                        emptyLabel=""
                      />
                    ) : (
                      <TaskDueLabel dueAt={task.due_at} status={task.status} />
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <TaskSubtaskProgress
                      done={task.subtaskDone}
                      total={task.subtaskTotal}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <TaskFileBadge count={task.fileCount} />
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={TASK_TABLE_COLUMNS.length}
                  className="px-4 py-12 text-center text-product-meta text-text-muted"
                >
                  No tasks to display.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex shrink-0 items-center border-t border-border bg-paper px-4 py-2.5">
        <p className="text-product-meta tabular-nums text-text-muted">
          VALUES {rows.length}
        </p>
      </div>
    </div>
  )

  if (!fillHeight) return tableContent

  return (
    <motion.div
      layout
      transition={layoutTransition}
      className="flex min-h-0 flex-1 flex-col"
    >
      {tableContent}
    </motion.div>
  )
}
