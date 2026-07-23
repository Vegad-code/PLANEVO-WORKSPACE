"use client"

import type { TaskWithMeta } from "@planevo/core/queries/product-tasks"
import {
  TASK_STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@planevo/core/types/tasks"
import { Icon } from "@/components/ui/planevo-icon"
import type { TaskListGrouping, TaskListGroupKey } from "@/lib/tasks/task-view-state"
import type { TaskPatch } from "./task-row"
import { TaskListRow } from "./task-list-row"

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
}

const GROUP_TINT: Partial<Record<TaskListGroupKey, string>> = {
  not_started: "bg-sidebar/50",
  in_progress: "bg-sidebar/70",
  in_review: "bg-surface-raised/80",
  done: "bg-meadow-tint/40",
  high: "bg-brick-tint/35",
  medium: "bg-sidebar/60",
  low: "bg-meadow-tint/35",
  none: "bg-sidebar/50",
}

function groupLabel(key: TaskListGroupKey, grouping: TaskListGrouping): string {
  if (grouping === "status") {
    return TASK_STATUS_LABELS[key as TaskStatus]
  }
  return key === "none" ? "No priority" : PRIORITY_LABELS[key as TaskPriority]
}

type TaskListGroupProps = {
  groupKey: TaskListGroupKey
  grouping: TaskListGrouping
  tasks: TaskWithMeta[]
  collapsed: boolean
  onToggleCollapsed: () => void
  onTaskSelect?: (taskId: string) => void
  onTaskPatch?: (taskId: string, patch: TaskPatch) => void
  onToggleComplete?: (taskId: string) => void
}

export function TaskListGroup({
  groupKey,
  grouping,
  tasks,
  collapsed,
  onToggleCollapsed,
  onTaskSelect,
  onTaskPatch,
  onToggleComplete,
}: TaskListGroupProps) {
  const headingId = `task-list-${grouping}-${groupKey}`
  const panelId = `${headingId}-panel`
  const countLabel = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`
  const tint = GROUP_TINT[groupKey] ?? "bg-sidebar/50"

  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId} className="sr-only">
        {groupLabel(groupKey, grouping)}
      </h3>
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls={panelId}
        onClick={onToggleCollapsed}
        className={`flex w-full items-center justify-between gap-3 border-b border-border px-4 py-2.5 text-left outline-none transition-colors hover:bg-sidebar/80 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${tint}`}
      >
        <span className="inline-flex items-center gap-2">
          <Icon
            name="chevron-down"
            className={`size-3.5 text-text-muted transition-transform motion-reduce:transition-none ${
              collapsed ? "-rotate-90" : "rotate-0"
            }`}
          />
          <span className="text-product-column text-text-muted">
            {groupLabel(groupKey, grouping)}
          </span>
        </span>
        <span
          aria-label={countLabel}
          className="text-product-stat tabular-nums text-text-muted"
        >
          {String(tasks.length).padStart(2, "0")}
        </span>
      </button>
      <div id={panelId} hidden={collapsed}>
        {tasks.length > 0 ? (
          <ul>
            {tasks.map((task) => (
              <TaskListRow
                key={task.id}
                task={task}
                grouping={grouping}
                onTaskSelect={onTaskSelect}
                onTaskPatch={onTaskPatch}
                onToggleComplete={onToggleComplete}
              />
            ))}
          </ul>
        ) : (
          <p className="border-b border-border px-4 py-4 text-product-meta text-text-muted">
            No tasks in this group.
          </p>
        )}
      </div>
    </section>
  )
}
