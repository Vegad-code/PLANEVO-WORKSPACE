"use client"

import { useId } from "react"
import { Dialog } from "@/components/ui/dialog"
import type { RecurrenceMutationScope } from "@/app/(workspace)/calendar/actions"

export function EventRecurrenceScopeDialog({
  open,
  action,
  isPending,
  onClose,
  onChoose,
}: {
  open: boolean
  action: "edit" | "delete" | "move"
  isPending: boolean
  onClose: () => void
  onChoose: (scope: RecurrenceMutationScope) => void
}) {
  const titleId = useId()
  if (!open) return null

  const verb =
    action === "delete" ? "Delete" : action === "move" ? "Move" : "Save"

  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      className="m-auto w-full max-w-sm rounded-card border border-border bg-paper p-0 text-ink backdrop:bg-ink/30"
    >
      <div className="flex flex-col gap-4 p-6">
        <div>
          <h2 id={titleId} className="text-h3">
            {verb} recurring event
          </h2>
          <p className="mt-2 text-body text-text-secondary">
            Choose how much of the series this change should affect.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {(
            [
              ["this", "This event"],
              ["following", "This and following"],
              ["all", "All events"],
            ] as const
          ).map(([scope, label]) => (
            <button
              key={scope}
              type="button"
              disabled={isPending}
              onClick={() => onChoose(scope)}
              className="rounded-lg border border-border-strong px-4 py-3 text-left text-body font-medium outline-none hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={onClose}
          className="self-end rounded-lg px-3 py-2 text-small font-medium text-text-secondary outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </Dialog>
  )
}
