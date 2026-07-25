"use client"

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import {
  CALENDAR_VIEWS,
  VIEW_LABELS,
  type CalendarView,
} from "./calendar-toolbar"

type CalendarViewMenuProps = {
  view: CalendarView
  onViewChange: (view: CalendarView) => void
}

export function CalendarViewMenu({ view, onViewChange }: CalendarViewMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="calendar-view-menu"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-product-body font-medium text-ink outline-none hover:bg-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {VIEW_LABELS[view]}
        <ChevronDown
          aria-hidden="true"
          className={`size-4 text-text-secondary transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          id="calendar-view-menu"
          role="listbox"
          aria-label="Calendar view"
          className="absolute right-0 z-20 mt-2 min-w-[9.5rem] rounded-lg border border-border bg-paper p-1 shadow-spotlight"
        >
          {CALENDAR_VIEWS.map((option) => {
            const isSelected = view === option
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onViewChange(option)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-product-body text-ink outline-none hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <span>{VIEW_LABELS[option]}</span>
                {isSelected ? (
                  <Check aria-hidden="true" className="size-4 text-text-secondary" />
                ) : (
                  <span aria-hidden="true" className="size-4" />
                )}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
