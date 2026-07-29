"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ListTodo } from "lucide-react"
import type { CalendarEventRow } from "@planevo/core/types/calendar"
import { formatDayHeaderAccessibleLabel } from "@/lib/calendar/day-header-model"
import {
  monthItemsForCalendarDay,
  type MonthItem,
} from "@/lib/calendar/month-items"
import { openMonthDayFromAgenda } from "@/lib/calendar/month-day-open"
import { getMonthDayAgendaPosition } from "@/lib/calendar/month-day-agenda-position"
import { cn } from "@/lib/utils"
import {
  calendarColorStyle,
  CALENDAR_EVENT_BLOCK_CLASS,
} from "./calendar-color-dot"
import { formatTimeLabel } from "./time-axis"

type MonthDayAgendaPopoverProps = {
  date: Date
  items: MonthItem[]
  anchorRect: DOMRect | null
  onClose: () => void
  onOpenDay: (date: Date) => void
  onCreateEvent: (date: Date, anchor: HTMLElement) => void
  onSelectEvent: (event: CalendarEventRow, anchor: HTMLElement) => void
  onToggleTask: (taskId: string, done: boolean) => void
}

export function MonthDayAgendaPopover({
  date,
  items,
  anchorRect,
  onClose,
  onOpenDay,
  onCreateEvent,
  onSelectEvent,
  onToggleTask,
}: MonthDayAgendaPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [isNarrow, setIsNarrow] = useState(false)
  const [desktopPosition, setDesktopPosition] = useState<{
    top: number
    left: number
  } | null>(null)
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

  useLayoutEffect(() => {
    if (isNarrow) return

    const updatePosition = () => {
      const panel = panelRef.current?.getBoundingClientRect()
      if (!panel) return
      const nextPosition = getMonthDayAgendaPosition({
        anchor: anchorRect,
        panel,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      })
      setDesktopPosition((current) =>
        current?.top === nextPosition.top && current.left === nextPosition.left
          ? current
          : nextPosition,
      )
    }

    updatePosition()
    window.addEventListener("resize", updatePosition)
    const observer = new ResizeObserver(updatePosition)
    if (panelRef.current) observer.observe(panelRef.current)

    return () => {
      window.removeEventListener("resize", updatePosition)
      observer.disconnect()
    }
  }, [anchorRect, dayItems.length, isNarrow])

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={formatDayHeaderAccessibleLabel(date)}
      tabIndex={-1}
      className={cn(
        "calendar-month-agenda-panel fixed z-40 overflow-y-auto border border-border bg-paper shadow-spotlight outline-none",
        isNarrow
          ? "inset-x-0 bottom-0 rounded-t-lg"
          : "rounded-lg",
      )}
      style={
        isNarrow
          ? undefined
          : {
              ...desktopPosition,
            }
      }
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
                    className={`calendar-month-task-checkbox border outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
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
                        className="calendar-month-task-check-icon"
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
                  style={calendarColorStyle(item.calendarColor)}
                  className={cn(
                    "calendar-event-block calendar-month-agenda-event flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:brightness-95 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink",
                    CALENDAR_EVENT_BLOCK_CLASS[item.calendarColor],
                  )}
                  onClick={(clickEvent) =>
                    onSelectEvent(item.event, clickEvent.currentTarget)
                  }
                >
                  <span className="w-12 shrink-0 text-product-meta text-text-secondary">
                    {timeLabel}
                  </span>
                  {item.linkedTask ? (
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-text-secondary"
                    >
                      <ListTodo aria-hidden="true" className="size-4" />
                    </span>
                  ) : null}
                  {item.linkedTask ? (
                    <span className="sr-only">
                      {item.isTaskComplete
                        ? "Completed task block: "
                        : "Scheduled task block: "}
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-product-body",
                      item.isTaskComplete
                        ? "text-text-muted line-through"
                        : "text-ink",
                    )}
                  >
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
      <div className="mt-3 flex gap-1.5">
        <button
          type="button"
          className="flex-1 rounded-[var(--radius-calendar-control)] bg-ink px-3 py-1.5 text-product-body font-medium text-paper outline-none hover:opacity-85 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          onClick={(clickEvent) =>
            onCreateEvent(date, clickEvent.currentTarget)
          }
        >
          New event
        </button>
        <button
          type="button"
          className="flex-1 rounded-[var(--radius-calendar-control)] border border-border bg-surface-raised px-3 py-1.5 text-product-body font-medium text-ink outline-none hover:bg-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          onClick={() => openMonthDayFromAgenda(date, onOpenDay)}
        >
          Open day
        </button>
      </div>
    </div>
  )
}
