import type { CalendarEventRow } from "@planevo/core/types/calendar"
import type { EventPanelSavePayload } from "@/features/calendar-product/event-detail-panel"
import { instantToLocalDateTime } from "./recurrence.ts"

export type RecurringEventMutationDraft =
  | {
      kind: "save"
      event: CalendarEventRow
      payload: EventPanelSavePayload
    }
  | {
      kind: "move"
      operation: "move" | "resize"
      event: CalendarEventRow
      startsAt: string
      endsAt: string
    }

function eventDescription(event: CalendarEventRow): string {
  const text = event.description_json.text
  return typeof text === "string" ? text : ""
}

/** Preserves every non-time field when a recurring instance is dragged. */
export function recurrenceMutationPayload(
  pending: RecurringEventMutationDraft,
): EventPanelSavePayload {
  if (pending.kind === "save") return pending.payload

  const timezone =
    pending.event.timezone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    "UTC"
  const startsAtLocal =
    instantToLocalDateTime(pending.startsAt, timezone) ??
    pending.startsAt.slice(0, 19)
  const endsAtLocal =
    instantToLocalDateTime(pending.endsAt, timezone) ??
    pending.endsAt.slice(0, 19)
  const durationMinutes = Math.max(
    1,
    Math.round(
      (new Date(pending.endsAt).getTime() -
        new Date(pending.startsAt).getTime()) /
        60_000,
    ),
  )

  return {
    calendarId: pending.event.calendar_id,
    title: pending.event.title,
    startsAt: pending.startsAt,
    endsAt: pending.endsAt,
    startsAtLocal,
    endsAtLocal,
    timezone,
    durationMinutes,
    rrule: pending.event.rrule,
    location: pending.event.location,
    description: eventDescription(pending.event),
    reminderOffsetMinutes: null,
    allDay: pending.event.all_day,
    color: pending.event.color,
  }
}
