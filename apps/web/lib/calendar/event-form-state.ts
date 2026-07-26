import type { CalendarEventRow } from "@planevo/core/types/calendar"
import type { EventCapture } from "./parse-event-capture.ts"
import {
  fromDateAndTimeInputValues,
  toDateInputValue,
  toTimeInputValue,
} from "./datetime-local.ts"

/**
 * The event card's form, held as the four values the native date/time inputs
 * actually carry rather than two timestamps. Any of them can be transiently
 * empty while the user retypes, which is why resolving to ISO can fail.
 */
export type EventFormState = {
  title: string
  calendarId: string
  startsDate: string
  startsTime: string
  endsDate: string
  endsTime: string
  timezone: string
  rrule: string | null
  location: string
  description: string
}

export type EventFormTimes =
  | {
      ok: true
      startsAt: string
      endsAt: string
      startsAtLocal: string
      endsAtLocal: string
      timezone: string
      durationMinutes: number
    }
  | { ok: false; error: string }

const DEFAULT_DURATION_MS = 60 * 60 * 1000
const RRULE_DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const

function eventDescriptionText(event: CalendarEventRow): string {
  const text = event.description_json.text
  return typeof text === "string" ? text : ""
}

export function buildEventFormState(input: {
  mode: "create" | "edit"
  event?: CalendarEventRow | null
  initialRange?: { startsAt: string; endsAt: string }
  defaultCalendarId: string
}): EventFormState {
  if (input.mode === "edit" && input.event) {
    return {
      title: input.event.title,
      calendarId: input.event.calendar_id,
      startsDate: toDateInputValue(input.event.starts_at),
      startsTime: toTimeInputValue(input.event.starts_at),
      endsDate: toDateInputValue(input.event.ends_at),
      endsTime: toTimeInputValue(input.event.ends_at),
      timezone: input.event.timezone ?? localTimezone(),
      rrule: input.event.rrule,
      location: input.event.location ?? "",
      description: eventDescriptionText(input.event),
    }
  }

  const startsAt = input.initialRange?.startsAt ?? new Date().toISOString()
  const endsAt =
    input.initialRange?.endsAt ??
    new Date(new Date(startsAt).getTime() + DEFAULT_DURATION_MS).toISOString()

  return {
    title: "",
    calendarId: input.defaultCalendarId,
    startsDate: toDateInputValue(startsAt),
    startsTime: toTimeInputValue(startsAt),
    endsDate: toDateInputValue(endsAt),
    endsTime: toTimeInputValue(endsAt),
    timezone: localTimezone(),
    rrule: null,
    location: "",
    description: "",
  }
}

export function eventFormStatesEqual(
  a: EventFormState,
  b: EventFormState,
): boolean {
  return (
    a.title === b.title &&
    a.calendarId === b.calendarId &&
    a.startsDate === b.startsDate &&
    a.startsTime === b.startsTime &&
    a.endsDate === b.endsDate &&
    a.endsTime === b.endsTime &&
    a.timezone === b.timezone &&
    a.rrule === b.rrule &&
    a.location === b.location &&
    a.description === b.description
  )
}

/**
 * Validates the form and resolves it to timestamps. Every failure returns the
 * message shown to the user, so there is one place where "can this be saved?"
 * is decided — the panel does not re-check anything.
 */
export function resolveEventFormTimes(form: EventFormState): EventFormTimes {
  const startsAt = fromDateAndTimeInputValues(form.startsDate, form.startsTime)
  const endsAt = fromDateAndTimeInputValues(form.endsDate, form.endsTime)

  if (!startsAt || !endsAt) {
    return { ok: false, error: "Add a start and end time before saving." }
  }

  const durationMs = new Date(endsAt).getTime() - new Date(startsAt).getTime()
  if (durationMs <= 0) {
    return { ok: false, error: "The event must end after it starts." }
  }

  return {
    ok: true,
    startsAt,
    endsAt,
    startsAtLocal: `${form.startsDate}T${form.startsTime}:00`,
    endsAtLocal: `${form.endsDate}T${form.endsTime}:00`,
    timezone: form.timezone,
    durationMinutes: Math.round(durationMs / 60_000),
  }
}

function localTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

/** Human duration for the card ("1h 30m"). Null while the times are unusable. */
export function formatEventFormDuration(form: EventFormState): string | null {
  const times = resolveEventFormTimes(form)
  if (!times.ok) return null

  const hours = Math.floor(times.durationMinutes / 60)
  const minutes = times.durationMinutes % 60
  if (hours === 0) return `${minutes} minutes`
  if (minutes === 0) return hours === 1 ? "1 hour" : `${hours} hours`
  return `${hours}h ${minutes}m`
}

/**
 * Folds a quick-capture read into the form. The title is only overwritten while
 * quick capture owns it; times always are, because the capture already decided
 * what to keep from the clicked slot.
 */
export function applyCaptureToForm(
  form: EventFormState,
  capture: EventCapture,
): EventFormState {
  return {
    ...form,
    title: capture.title,
    startsDate: toDateInputValue(capture.startsAt),
    startsTime: toTimeInputValue(capture.startsAt),
    endsDate: toDateInputValue(capture.endsAt),
    endsTime: toTimeInputValue(capture.endsAt),
    rrule: capture.rrule,
  }
}

/**
 * Moving the start date drags the end with it, so a two-day shift of a one-hour
 * meeting stays a one-hour meeting instead of ending before it begins.
 */
export function applyFormPatch(
  form: EventFormState,
  patch: Partial<EventFormState>,
): EventFormState {
  let next = { ...form, ...patch }
  if (patch.startsDate === undefined || patch.startsDate === form.startsDate) {
    return next
  }

  if (/^FREQ=WEEKLY;BYDAY=(?:SU|MO|TU|WE|TH|FR|SA)$/.test(form.rrule ?? "")) {
    next = { ...next, rrule: weeklyRruleForDate(next.startsDate) }
  }

  const previousStart = new Date(`${form.startsDate}T00:00`)
  const nextStart = new Date(`${next.startsDate}T00:00`)
  const previousEnd = new Date(`${form.endsDate}T00:00`)
  if (
    Number.isNaN(previousStart.getTime()) ||
    Number.isNaN(nextStart.getTime()) ||
    Number.isNaN(previousEnd.getTime())
  ) {
    return next
  }

  const shiftedEnd = new Date(
    previousEnd.getTime() + (nextStart.getTime() - previousStart.getTime()),
  )
  return { ...next, endsDate: toDateInputValue(shiftedEnd.toISOString()) }
}

export function weeklyRruleForDate(dateValue: string): string {
  const date = new Date(`${dateValue}T12:00:00`)
  if (Number.isNaN(date.getTime())) return "FREQ=WEEKLY"
  return `FREQ=WEEKLY;BYDAY=${RRULE_DAY_CODES[date.getDay()]}`
}
