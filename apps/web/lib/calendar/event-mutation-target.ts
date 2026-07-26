import type { CalendarEventRow } from "@planevo/core/types/calendar"
import { parseInstanceId } from "./recurrence.ts"

export type EventMutationTarget =
  | { kind: "standalone"; eventId: string }
  | { kind: "series-master"; masterId: string }
  | {
      kind: "series-instance"
      masterId: string
      recurrenceId: string
      exceptionId: string | null
    }

/**
 * Keeps synthetic occurrence ids at the renderer boundary. Every server-facing
 * id returned here is a persisted UUID; recurrence identity travels separately.
 */
export function resolveEventMutationTarget(
  event: Pick<
    CalendarEventRow,
    "id" | "parent_event_id" | "recurrence_id" | "rrule"
  >,
): EventMutationTarget | null {
  if (event.parent_event_id && event.recurrence_id) {
    if (Number.isNaN(new Date(event.recurrence_id).getTime())) return null
    return {
      kind: "series-instance",
      masterId: event.parent_event_id,
      recurrenceId: event.recurrence_id,
      exceptionId: event.id,
    }
  }

  const instance = parseInstanceId(event.id)
  if (instance) {
    if (event.recurrence_id !== instance.recurrenceId) return null
    return {
      kind: "series-instance",
      masterId: instance.masterId,
      recurrenceId: instance.recurrenceId,
      exceptionId: null,
    }
  }

  if (event.recurrence_id !== null) return null
  return event.rrule
    ? { kind: "series-master", masterId: event.id }
    : { kind: "standalone", eventId: event.id }
}
