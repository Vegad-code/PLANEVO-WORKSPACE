"use client"

import type { EventProps } from "react-big-calendar"
import type { MonthRbcEvent } from "@/lib/calendar/rbc-event-adapter"
import { formatCompactMonthTime } from "@/lib/calendar/format-compact-month-time"

type RbcMonthEventContentProps = EventProps<MonthRbcEvent> & {
  onToggleTask: (taskId: string, done: boolean) => void
}

export function RbcMonthEventContent({
  event,
  onToggleTask,
}: RbcMonthEventContentProps) {
  const item = event.monthItem

  if (item.kind === "task") {
    return (
      <>
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
          onMouseDown={(clickEvent) => clickEvent.stopPropagation()}
          onClick={(clickEvent) => {
            clickEvent.stopPropagation()
            onToggleTask(item.taskId, item.toggle.nextCompleted)
          }}
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
          className={`min-w-0 truncate text-product-meta ${
            item.completed ? "text-text-muted line-through" : "text-ink"
          }`}
        >
          {item.title}
        </span>
      </>
    )
  }

  const timeLabel =
    item.displayStyle === "timed"
      ? formatCompactMonthTime(event.start)
      : null

  return (
    <>
      {item.displayStyle === "timed" ? (
        <span
          aria-hidden="true"
          className="calendar-month-event-dot"
        />
      ) : null}
      {timeLabel ? (
        <span className="shrink-0 text-product-meta text-text-secondary">
          {timeLabel}
        </span>
      ) : null}
      <span className="min-w-0 truncate text-product-meta font-medium text-ink">
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
    </>
  )
}
