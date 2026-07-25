"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import type { TaskWithMeta } from "@planevo/core/queries/product-tasks"
import { getShellLayoutTransition } from "@/lib/motion/shell-spring"
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion"
import {
  groupTasksForList,
  type TaskListGrouping,
} from "@/lib/tasks/task-view-state"
import type { TaskPatch } from "./task-row"
import { TaskListGroup } from "./task-list-group"

type TaskListProps = {
  tasks: TaskWithMeta[]
  grouping?: TaskListGrouping
  onGroupingChange?: (grouping: TaskListGrouping) => void
  collapsedGroups?: string[]
  onCollapsedGroupsChange?: (keys: string[]) => void
  hideDone?: boolean
  onHideDoneChange?: (hideDone: boolean) => void
  onTaskSelect?: (taskId: string) => void
  onTaskPatch?: (taskId: string, patch: TaskPatch) => void
  onToggleComplete?: (taskId: string) => void
  fillHeight?: boolean
}

function orderedTasks(tasks: TaskWithMeta[]): TaskWithMeta[] {
  return [...tasks].sort(
    (left, right) =>
      left.position - right.position || left.id.localeCompare(right.id),
  )
}

function GroupByControl({
  grouping,
  onChange,
}: {
  grouping: TaskListGrouping
  onChange: (grouping: TaskListGrouping) => void
}) {
  return (
    <div
      role="group"
      aria-label="Group by"
      className="flex items-center gap-2"
    >
      <span className="text-product-body text-text-secondary">Group by</span>
      <div className="flex rounded-lg border border-border bg-surface-raised p-0.5">
        {(
          [
            { value: "status", label: "Status" },
            { value: "priority", label: "Priority" },
          ] as const
        ).map((option) => {
          const selected = grouping === option.value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`rounded-md px-2.5 py-1 text-product-body font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
                selected
                  ? "border border-border bg-paper text-ink"
                  : "border border-transparent text-text-secondary hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function TaskList({
  tasks,
  grouping: groupingProp,
  onGroupingChange,
  collapsedGroups: collapsedProp,
  onCollapsedGroupsChange,
  hideDone = false,
  onHideDoneChange,
  onTaskSelect,
  onTaskPatch,
  onToggleComplete,
  fillHeight = false,
}: TaskListProps) {
  const [localGrouping, setLocalGrouping] = useState<TaskListGrouping>("status")
  const [localCollapsed, setLocalCollapsed] = useState<string[]>([])
  const grouping = groupingProp ?? localGrouping
  const collapsedGroups = collapsedProp ?? localCollapsed
  const prefersReducedMotion = usePrefersReducedMotion()
  const layoutTransition = getShellLayoutTransition(prefersReducedMotion)

  const visibleTasks = useMemo(
    () => (hideDone ? tasks.filter((task) => task.status !== "done") : tasks),
    [hideDone, tasks],
  )
  const groups = groupTasksForList(visibleTasks, grouping)
  const collapsedSet = useMemo(
    () => new Set(collapsedGroups),
    [collapsedGroups],
  )

  function setGrouping(next: TaskListGrouping) {
    if (onGroupingChange) onGroupingChange(next)
    else setLocalGrouping(next)
  }

  function toggleCollapsed(key: string) {
    const next = collapsedSet.has(key)
      ? collapsedGroups.filter((entry) => entry !== key)
      : [...collapsedGroups, key]
    if (onCollapsedGroupsChange) onCollapsedGroupsChange(next)
    else setLocalCollapsed(next)
  }

  const listContent = (
    <div
      role="region"
      aria-label="Tasks list"
      className={`flex min-h-0 flex-col overflow-hidden border border-border bg-paper ${
        fillHeight ? "min-h-0 flex-1" : ""
      }`}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-paper px-4 py-2.5">
        {onHideDoneChange ? (
          <label className="inline-flex items-center gap-2 text-product-body text-text-secondary">
            <input
              type="checkbox"
              checked={hideDone}
              onChange={(event) => onHideDoneChange(event.target.checked)}
              className="size-3.5 rounded border-border-strong accent-ink"
            />
            Hide done
          </label>
        ) : (
          <span />
        )}
        <GroupByControl grouping={grouping} onChange={setGrouping} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {groups.map((group) => (
          <TaskListGroup
            key={group.key}
            groupKey={group.key}
            grouping={grouping}
            tasks={orderedTasks(group.tasks)}
            collapsed={collapsedSet.has(`${grouping}:${group.key}`)}
            onToggleCollapsed={() =>
              toggleCollapsed(`${grouping}:${group.key}`)
            }
            onTaskSelect={onTaskSelect}
            onTaskPatch={onTaskPatch}
            onToggleComplete={onToggleComplete}
          />
        ))}
      </div>
      <div className="flex shrink-0 items-center border-t border-border bg-paper px-4 py-2.5">
        <p className="text-product-meta tabular-nums text-text-muted">
          VALUES {visibleTasks.length}
        </p>
      </div>
    </div>
  )

  if (!fillHeight) return listContent

  return (
    <motion.div
      layout
      transition={layoutTransition}
      className="flex min-h-0 flex-1 flex-col"
    >
      {listContent}
    </motion.div>
  )
}
