"use client"

import type { EventProps } from "react-big-calendar"
import {
  DRAFT_CREATE_EVENT_ID,
  isDraftCreateEvent,
  type PlanevoRbcEvent,
} from "@/lib/calendar/rbc-event-adapter"
import { formatTimeLabel } from "./time-axis"

export function RbcEventContent({ event }: EventProps<PlanevoRbcEvent>) {
  const timeLabel = event.allDay
    ? null
    : `${formatTimeLabel(event.start)} - ${formatTimeLabel(event.end)}`
  const eventId = isDraftCreateEvent(event) ? DRAFT_CREATE_EVENT_ID : event.id

  return (
    <span className="flex min-w-0 flex-col" data-event-id={eventId}>
      {timeLabel ? (
        <span className="truncate text-product-meta text-text-secondary">
          {timeLabel}
        </span>
      ) : null}
      <span className="truncate text-product-meta font-medium text-ink">
        {event.title}
      </span>
    </span>
  )
}
