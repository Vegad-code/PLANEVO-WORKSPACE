"use client"

import type { EventProps } from "react-big-calendar"
import type { PlanevoRbcEvent } from "@/lib/calendar/rbc-event-adapter"
import { formatTimeLabel } from "./time-axis"

export function RbcEventContent({ event }: EventProps<PlanevoRbcEvent>) {
  const timeLabel = event.allDay
    ? null
    : `${formatTimeLabel(event.start)} - ${formatTimeLabel(event.end)}`

  return (
    <>
      {timeLabel ? (
        <span className="truncate text-product-meta text-text-secondary">
          {timeLabel}
        </span>
      ) : null}
      <span className="truncate text-product-meta font-medium text-ink">
        {event.title}
      </span>
    </>
  )
}
