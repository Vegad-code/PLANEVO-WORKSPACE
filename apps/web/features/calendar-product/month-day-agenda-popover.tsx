"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { CalendarEventRow } from "@planevo/core/types/calendar"
import { formatDayHeaderAccessibleLabel } from "@/lib/calendar/day-header-model"
import {
  monthItemsForCalendarDay,
  type MonthItem,
} from "@/lib/calendar/month-items"
import { cn } from "@/lib/utils"
import { formatTimeLabel } from "./time-axis"

type MonthDayAgendaPopoverProps = {
  date: Date
  items: MonthItem[]
  anchorRect: DOMRect | null
  onClose: () => void
  onOpenDay: (date: Date) => void
  onSelectEvent: (event: CalendarEventRow, anchor: HTMLElement) => void
  onToggleTask: (taskId: string, done: boolean) => void
}

const VIEWPORT_MARGIN = 16
const DESKTOP_PANEL_WIDTH = 288
const DESKTOP_PANEL_HEIGHT = 320

export function MonthDayAgendaPopover({
  date,
  items,
  anchorRect,
  onClose,
  onOpenDay,
  onSelectEvent,
  onToggleTask,
}: MonthDayAgendaPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [isNarrow, setIsNarrow] = useState(false)
  const dayItems = useMemo(
    () => monthItemsForCalendarDay(items, date),
    [items, date],
  )

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)")
    const updateViewport = () => setIsNarrow(media.matches)
    updateViewport()
    media.addEventListener("change", updateViewport)
    return () => media.removeEventListener("change", updateViewport)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return
      onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("pointerdown", handlePointerDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [onClose])

  useEffect(() => {
    panelRef.current?.focus()
  }, [date])

  const desktopPosition = useMemo(() => {
    if (isNarrow || typeof window === "undefined") return undefined

    const top = anchorRect
      ? Math.min(
          Math.max(anchorRect.bottom + VIEWPORT_MARGIN, VIEWPORT_MARGIN),
          window.innerHeight - DESKTOP_PANEL_HEIGHT - VIEWPORT_MARGIN,
        )
      : VIEWPORT_MARGIN
    const left = anchorRect
      ? Math.min(
          Math.max(anchorRect.left, VIEWPORT_MARGIN),
          window.innerWidth - DESKTOP_PANEL_WIDTH - VIEWPORT_MARGIN,
        )
      : VIEWPORT_MARGIN

    return { top, left }
  }, [anchorRect, isNarrow])

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={formatDayHeaderAccessibleLabel(date)}
      tabIndex={-1}
      className={cn(
        "fixed z-40 border border-border bg-paper p-3 shadow-spotlight outline-none",
        isNarrow
          ? "inset-x-0 bottom-0 max-h-80 rounded-t-lg"
          : "w-72 rounded-lg",
      )}
      style={desktopPosition}
    >
      <p className="text-product-body font-medium text-ink">
        {formatDayHeaderAccessibleLabel(date)}
      </p>
      <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
        {dayItems.length === 0 ? (
          <li className="text-product-meta text-text-secondary">No items</li>
        ) : (
          dayItems.map((item) => {
            if (item.kind === "task") {
              return (
                <li
                  key={item.id}
                  className="calendar-month-agenda-task flex items-center gap-2 rounded-md px-2 py-1.5"
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={item.completed}
                    aria-label={
                      item.completed
                        ? `Mark incomplete: ${item.title}`
                        : `Complete task: ${item.title}`
                    }
                    className={`calendar-month-task-checkbox flex size-4 shrink-0 items-center justify-center rounded-md border outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
                      item.completed
                        ? "border-ink bg-ink text-paper"
                        : "border-border-strong bg-transparent text-transparent hover:border-ink"
                    }`}
                    onClick={() =>
                      onToggleTask(item.taskId, item.toggle.nextCompleted)
                    }
                  >
                    {item.completed ? (
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 12 12"
                        className="size-2.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M2.5 6.2 4.8 8.5 9.5 3.5" />
                      </svg>
                    ) : null}
                  </button>
                  <span
                    className={`min-w-0 flex-1 truncate text-product-body ${
                      item.completed
                        ? "text-text-muted line-through"
                        : "text-ink"
                    }`}
                  >
                    {item.title}
                  </span>
                </li>
              )
            }

            const timeLabel = item.allDay
              ? "All day"
              : formatTimeLabel(item.start)
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={cn(
                    "calendar-month-agenda-event flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink",
                    `planevo-rbc-event--${item.calendarColor}`,
                  )}
                  onClick={(clickEvent) =>
                    onSelectEvent(item.event, clickEvent.currentTarget)
                  }
                >
                  <span className="w-12 shrink-0 text-product-meta text-text-secondary">
                    {timeLabel}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-product-body text-ink">
                    {item.title}
                  </span>
                  {item.isSyncedSource ? (
                    <span
                      aria-label="Synced calendar event"
                      className="calendar-month-event-synced shrink-0 text-product-meta text-text-secondary"
                    >
                      ↗
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })
        )}
      </ul>
      <button
        type="button"
        className="mt-3 w-full rounded-[var(--radius-calendar-control)] border border-border bg-surface-raised px-3 py-1.5 text-product-body font-medium text-ink outline-none hover:bg-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        onClick={() => onOpenDay(date)}
      >
        Open day
      </button>
    </div>
  )
}
