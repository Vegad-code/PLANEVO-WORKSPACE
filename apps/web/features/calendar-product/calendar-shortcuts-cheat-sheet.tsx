"use client"

import { X } from "lucide-react"
import { Dialog } from "@/components/ui/dialog"
import { CALENDAR_P0_SHORTCUTS } from "@/lib/calendar/calendar-shortcut-map"

type CalendarShortcutsCheatSheetProps = {
  open: boolean
  onClose: () => void
}

export function CalendarShortcutsCheatSheet({
  open,
  onClose,
}: CalendarShortcutsCheatSheetProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy="calendar-shortcuts-title"
      className="spotlight-glass-panel m-4 w-full max-w-lg overflow-hidden rounded-2xl p-0 text-ink backdrop:bg-ink/30 sm:m-auto"
    >
      <div className="flex flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <h2
              id="calendar-shortcuts-title"
              className="text-h3 font-medium text-ink"
            >
              Calendar shortcuts
            </h2>
            <p className="mt-0.5 text-product-meta text-text-muted">
              Single keys work when focus is not in a field
            </p>
          </div>
          <button
            type="button"
            aria-label="Close shortcuts"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </header>

        <div className="max-h-96 overflow-y-auto px-5 py-4">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">
              Keyboard shortcuts for the Calendar product
            </caption>
            <thead>
              <tr className="text-label uppercase text-text-muted">
                <th scope="col" className="pb-2 pr-3 font-medium">
                  Action
                </th>
                <th scope="col" className="pb-2 pr-3 font-medium">
                  Mac
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Windows
                </th>
              </tr>
            </thead>
            <tbody>
              {CALENDAR_P0_SHORTCUTS.map((entry) => (
                <tr
                  key={entry.key}
                  className="border-t border-border text-product-body text-ink"
                >
                  <td className="py-2.5 pr-3">{entry.label}</td>
                  <td className="py-2.5 pr-3">
                    <kbd className="rounded-md border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-product-meta text-ink">
                      {entry.mac}
                    </kbd>
                  </td>
                  <td className="py-2.5">
                    <kbd className="rounded-md border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-product-meta text-ink">
                      {entry.win}
                    </kbd>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-4 text-product-meta text-text-muted">
            Month grid still uses arrow keys, Home/End, Page Up/Down, and Enter
            for day focus and agenda.
          </p>
        </div>
      </div>
    </Dialog>
  )
}
