"use client"

import { useState } from "react"
import type { TaskStatus } from "@planevo/core/types/tasks"
import { Button } from "@/components/ui/button"
import { TaskDueLabel } from "../task-row/task-due-label"
import { TaskInlinePopover } from "./task-inline-popover"

function dateInputValue(dueAt: string | null): string {
  if (!dueAt) return ""
  const date = new Date(dueAt)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10)
}

function dueAtFromDateInput(value: string): string | null {
  if (!value) return null
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

type TaskDuePopoverProps = {
  dueAt: string | null
  status: TaskStatus
  onSelect: (dueAt: string | null) => void
  emptyLabel?: string
}

export function TaskDuePopover({
  dueAt,
  status,
  onSelect,
  emptyLabel = "Set due date",
}: TaskDuePopoverProps) {
  const [draft, setDraft] = useState(dateInputValue(dueAt))

  return (
    <TaskInlinePopover
      label={dueAt ? "Change due date" : "Set due date"}
      trigger={
        dueAt ? (
          <TaskDueLabel dueAt={dueAt} status={status} />
        ) : (
          <span className="inline-flex min-h-6 min-w-12 items-center rounded-md px-1.5 text-product-meta text-text-muted/0 transition-colors hover:bg-sidebar/50 hover:text-text-muted motion-reduce:transition-none">
            {emptyLabel || "Set"}
          </span>
        )
      }
    >
      {(close) => (
        <div className="flex w-56 flex-col gap-2 p-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-product-meta text-text-muted">Due date</span>
            <input
              type="date"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="h-10 rounded-lg border border-border bg-paper px-3 text-product-body text-ink outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
            />
          </label>
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onSelect(null)
                setDraft("")
                close()
              }}
            >
              Clear
            </Button>
            <Button
              type="button"
              variant="ink"
              size="sm"
              onClick={() => {
                onSelect(dueAtFromDateInput(draft))
                close()
              }}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </TaskInlinePopover>
  )
}
