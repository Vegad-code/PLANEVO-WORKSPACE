"use client"

import {
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type TaskStatus,
} from "@planevo/core/types/tasks"
import { Icon } from "@/components/ui/planevo-icon"
import { TaskStatusPill } from "../task-row/task-status-pill"
import { TaskInlinePopover } from "./task-inline-popover"

type TaskStatusPopoverProps = {
  status: TaskStatus
  onSelect: (status: TaskStatus) => void
}

export function TaskStatusPopover({
  status,
  onSelect,
}: TaskStatusPopoverProps) {
  return (
    <TaskInlinePopover
      label={`Change status. Current: ${TASK_STATUS_LABELS[status]}`}
      trigger={<TaskStatusPill status={status} />}
    >
      {(close) => (
        <ul className="flex flex-col">
          {TASK_STATUSES.filter((entry) => entry !== "cancelled").map(
            (option) => {
              const selected = option === status
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
                    <TaskStatusPill status={option} />
                    {selected ? (
                      <Icon name="check" className="size-4 text-text-secondary" />
                    ) : null}
                  </button>
                </li>
              )
            },
          )}
        </ul>
      )}
    </TaskInlinePopover>
  )
}
