"use client"

import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react"
import type { EventWrapperProps } from "react-big-calendar"
import {
  DRAFT_CREATE_EVENT_ID,
  isDraftCreateEvent,
  type PlanevoRbcEvent,
} from "@/lib/calendar/rbc-event-adapter"

/**
 * RBC's eventPropGetter only applies className/style — not data attributes.
 * Nest outside the DnD wrapper so the `.rbc-event` root gets a stable id for
 * draft-create anchoring and debugging.
 */
export function RbcPlanevoEventWrapper(
  props: EventWrapperProps<PlanevoRbcEvent> & { children?: ReactNode },
) {
  const { event, children } = props
  if (!children || !isValidElement(children)) return children ?? null

  const eventId = isDraftCreateEvent(event) ? DRAFT_CREATE_EVENT_ID : event.id

  return cloneElement(children as ReactElement<Record<string, unknown>>, {
    "data-event-id": eventId,
  })
}
