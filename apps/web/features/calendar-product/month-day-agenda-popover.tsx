"use client"

import { useEffect, useMemo, useRef } from "react"
import type { CalendarEventRow, CalendarRow } from "@planevo/core/types/calendar"
import { formatDayHeaderAccessibleLabel } from "@/lib/calendar/day-header-model"
import { eventsForCalendarDay } from "@/lib/calendar/month-day-events"
import { cn } from "@/lib/utils"
import { formatTimeLabel } from "./time-axis"

type MonthDayAgendaPopoverProps = {
  date: Date
  events: CalendarEventRow[]
  calendars: CalendarRow[]
  anchorRect: DOMRect | null
  onClose: () => void
  onOpenDay: (date: Date) => void
  onSelectEvent: (event: CalendarEventRow, anchor: HTMLElement) => void
}

export function MonthDayAgendaPopover({
  date,
  events,
  calendars,
  anchorRect,
  onClose,
  onOpenDay,
  onSelectEvent,
}: MonthDayAgendaPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const colorByCalendarId = useMemo(
    () => new Map(calendars.map((c) => [c.id, c.color] as const)),
    [calendars],
  )
  const dayEvents = useMemo(
    () => eventsForCalendarDay(events, date),
    [events, date],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  useEffect(() => {
    panelRef.current?.focus()
  }, [date])

  const top = anchorRect ? anchorRect.bottom + 8 : 80
  const left = anchorRect
    ? Math.min(anchorRect.left, window.innerWidth - 280)
    : 80

  return (
    <>
      <button
        type="button"
        aria-label="Close day agenda"
        className="fixed inset-0 z-30 cursor-default bg-ink/20"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={formatDayHeaderAccessibleLabel(date)}
        tabIndex={-1}
        className="fixed z-40 w-72 rounded-lg border border-border bg-paper p-3 shadow-spotlight outline-none"
        style={{ top, left }}
      >
        <p className="text-product-body font-medium text-ink">
          {formatDayHeaderAccessibleLabel(date)}
        </p>
        <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
          {dayEvents.length === 0 ? (
            <li className="text-product-meta text-text-secondary">
              No events
            </li>
          ) : (
            dayEvents.map((event) => {
              const color = colorByCalendarId.get(event.calendar_id) ?? "slate"
              const timeLabel = event.all_day
                ? "All day"
                : formatTimeLabel(new Date(event.starts_at))
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink",
                      `planevo-rbc-event--${color}`,
                    )}
                    onClick={(e) => onSelectEvent(event, e.currentTarget)}
                  >
                    <span className="w-12 shrink-0 text-product-meta text-text-secondary">
                      {timeLabel}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-product-body text-ink">
                      {event.title}
                    </span>
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
    </>
  )
}
