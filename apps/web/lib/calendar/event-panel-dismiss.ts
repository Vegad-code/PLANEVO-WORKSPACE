/**
 * GCal-parity dismiss for the event edit card: never confirm. Create discards;
 * dirty edit silent-saves when the draft is valid, otherwise closes quietly.
 */
import type { CalendarColorValue } from "@planevo/core/types/calendar"
import type { EventFormState, EventFormTimes } from "./event-form-state.ts"

export type EventPanelSavePayload = {
  calendarId: string
  title: string
  startsAt: string
  endsAt: string
  startsAtLocal: string
  endsAtLocal: string
  timezone: string
  durationMinutes: number
  rrule: string | null
  location: string | null
  description: string
  reminderOffsetMinutes: number | null
  allDay: boolean
  color: CalendarColorValue | null
}

export type EventPanelDismissDecision =
  | { kind: "close" }
  | { kind: "silent_save"; payload: EventPanelSavePayload }

export type BuildEventPanelSavePayloadInput = {
  form: EventFormState
  selectedCalendarId: string
  resolvedTimes: EventFormTimes
  reminderOffsetMinutes: number | null
  eventColor: CalendarColorValue | null
  /** When true, color must be set before a save can proceed. */
  colorRequired: boolean
  mutationBlocked: boolean
  isPending: boolean
}

/** Returns a save payload when the draft passes the same gates as explicit Save. */
export function buildEventPanelSavePayload(
  input: BuildEventPanelSavePayloadInput,
): EventPanelSavePayload | null {
  if (input.mutationBlocked || input.isPending) return null

  const trimmedTitle = input.form.title.trim()
  if (!trimmedTitle) return null
  if (!input.selectedCalendarId) return null
  if (!input.resolvedTimes.ok) return null
  if (input.colorRequired && input.eventColor === null) return null

  return {
    calendarId: input.selectedCalendarId,
    title: trimmedTitle,
    startsAt: input.resolvedTimes.startsAt,
    endsAt: input.resolvedTimes.endsAt,
    startsAtLocal: input.resolvedTimes.startsAtLocal,
    endsAtLocal: input.resolvedTimes.endsAtLocal,
    timezone: input.resolvedTimes.timezone,
    durationMinutes: input.resolvedTimes.durationMinutes,
    rrule: input.form.rrule,
    location: input.form.location.trim() || null,
    description: input.form.description.trim(),
    reminderOffsetMinutes: input.reminderOffsetMinutes,
    allDay: input.resolvedTimes.allDay,
    color: input.eventColor,
  }
}

export function resolveEventPanelDismiss(input: {
  mode: "create" | "edit"
  isDirty: boolean
  saveInput: BuildEventPanelSavePayloadInput
}): EventPanelDismissDecision {
  // Create always discards on dismiss (Google Calendar).
  if (input.mode === "create" || !input.isDirty) {
    return { kind: "close" }
  }

  const payload = buildEventPanelSavePayload(input.saveInput)
  if (payload) {
    return { kind: "silent_save", payload }
  }

  // Invalid dirty edit: close without a confirm nag — do not block the user.
  return { kind: "close" }
}
