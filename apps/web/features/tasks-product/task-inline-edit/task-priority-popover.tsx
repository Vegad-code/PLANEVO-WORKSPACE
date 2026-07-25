"use client"

import {
  TASK_PRIORITIES,
  type TaskPriority,
} from "@planevo/core/types/tasks"
import { Icon } from "@/components/ui/planevo-icon"
import { TaskPriorityPill } from "../task-row/task-priority-pill"
import { TaskInlinePopover } from "./task-inline-popover"

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
}

type TaskPriorityPopoverProps = {
  priority: TaskPriority | null
  onSelect: (priority: TaskPriority | null) => void
  emptyLabel?: string
}

export function TaskPriorityPopover({
  priority,
  onSelect,
  emptyLabel = "Set priority",
}: TaskPriorityPopoverProps) {
  return (
    <TaskInlinePopover
      label={
        priority
          ? `Change priority. Current: ${PRIORITY_LABELS[priority]}`
          : "Set priority"
      }
      trigger={
        priority ? (
          <TaskPriorityPill priority={priority} />
        ) : (
          <span className="inline-flex min-h-6 min-w-12 items-center rounded-md px-1.5 text-product-meta text-text-muted/0 transition-colors hover:bg-sidebar/50 hover:text-text-muted motion-reduce:transition-none">
            {emptyLabel || "Set"}
          </span>
        )
      }
    >
      {(close) => (
        <ul className="flex flex-col">
          {([...TASK_PRIORITIES].reverse() as TaskPriority[]).map((option) => {
            const selected = option === priority
            return (
              <li key={option}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(option)
                    close()
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-product-body text-ink outline-none hover:bg-sidebar/60 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  <TaskPriorityPill priority={option} />
                  {selected ? (
                    <Icon name="check" className="size-4 text-text-secondary" />
                  ) : null}
                </button>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={() => {
                onSelect(null)
                close()
              }}
              className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-product-body text-text-secondary outline-none hover:bg-sidebar/60 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              No priority
              {priority === null ? (
                <Icon name="check" className="size-4 text-text-secondary" />
              ) : null}
            </button>
          </li>
        </ul>
      )}
    </TaskInlinePopover>
  )
}
