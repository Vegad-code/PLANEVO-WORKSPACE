"use client"

import type { EventProps } from "react-big-calendar"
import type { PlanevoRbcEvent } from "@/lib/calendar/rbc-event-adapter"
import { formatCompactMonthTime } from "@/lib/calendar/format-compact-month-time"

export function RbcMonthEventContent({ event }: EventProps<PlanevoRbcEvent>) {
  const timeLabel = event.allDay ? null : formatCompactMonthTime(event.start)

  return (
    <>
      {timeLabel ? (
        <span className="shrink-0 text-product-meta text-text-secondary">
          {timeLabel}
        </span>
      ) : null}
      <span className="min-w-0 truncate text-product-meta font-medium text-ink">
        {event.title}
      </span>
    </>
  )
}
