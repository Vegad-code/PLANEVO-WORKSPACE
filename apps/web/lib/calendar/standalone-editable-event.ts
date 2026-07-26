import type { CalendarEventRow } from "@planevo/core/types/calendar"

export type StandaloneEditableEvent = Pick<
  CalendarEventRow,
  "id" | "task_id" | "starts_at" | "ends_at" | "timezone" | "source" | "rrule" | "parent_event_id"
>

export class StandaloneEditableEventError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StandaloneEditableEventError"
  }
}

/**
 * Standalone update actions may only target one-off Planevo rows. Series masters
 * and recurrence exceptions must go through scope RPCs.
 */
export function assertStandaloneEditableEvent(
  event: StandaloneEditableEvent,
): void {
  if (event.rrule) {
    throw new StandaloneEditableEventError(
      "Repeating events must be edited with a recurrence scope.",
    )
  }
  if (event.parent_event_id) {
    throw new StandaloneEditableEventError(
      "This occurrence must be edited with a recurrence scope.",
    )
  }
}
