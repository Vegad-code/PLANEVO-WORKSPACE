import type {
  CalendarDisplayEvent,
  CalendarEventRow,
} from "@planevo/core/types/calendar"
import type { EventCapture } from "./parse-event-capture.ts"
import {
  fromDateAndTimeInputValues,
  toDateInputValue,
  toTimeInputValue,
} from "./datetime-local.ts"
import {
  instantToLocalDateTime,
  localDateTimeToInstant,
} from "./recurrence.ts"

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
  allDay: boolean
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
      allDay: boolean
    }
  | { ok: false; error: string }

const DEFAULT_DURATION_MS = 60 * 60 * 1000
const RRULE_DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const

function eventDescriptionText(event: CalendarEventRow): string {
  const text = event.description_json.text
  return typeof text === "string" ? text : ""
}

function eventDisplayTitle(
  event: CalendarEventRow | CalendarDisplayEvent,
): string {
  if (event.task_id && "linked_task" in event && event.linked_task?.title) {
    return event.linked_task.title
  }
  return event.title
}

function localDateTimeParts(value: string): { date: string; time: string } | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value)
  if (!match) return null
  return { date: match[1]!, time: match[2]! }
}

function eventFormDateTime(
  event: CalendarEventRow,
): Pick<EventFormState, "startsDate" | "startsTime" | "endsDate" | "endsTime"> {
  const timezone = event.timezone ?? localTimezone()

  if (event.starts_at_local && event.ends_at_local) {
    const starts = localDateTimeParts(event.starts_at_local)
    const ends = localDateTimeParts(event.ends_at_local)
    if (starts && ends) {
      return {
        startsDate: starts.date,
        startsTime: starts.time,
        endsDate: ends.date,
        endsTime: ends.time,
      }
    }
  }

  const startsLocal = instantToLocalDateTime(event.starts_at, timezone)
  const endsLocal = instantToLocalDateTime(event.ends_at, timezone)
  if (startsLocal && endsLocal) {
    const starts = localDateTimeParts(startsLocal)
    const ends = localDateTimeParts(endsLocal)
    if (starts && ends) {
      return {
        startsDate: starts.date,
        startsTime: starts.time,
        endsDate: ends.date,
        endsTime: ends.time,
      }
    }
  }

  return {
    startsDate: toDateInputValue(event.starts_at),
    startsTime: toTimeInputValue(event.starts_at),
    endsDate: toDateInputValue(event.ends_at),
    endsTime: toTimeInputValue(event.ends_at),
  }
}

export function buildEventFormState(input: {
  mode: "create" | "edit"
  event?: CalendarEventRow | CalendarDisplayEvent | null
  initialRange?: { startsAt: string; endsAt: string }
  defaultCalendarId: string
}): EventFormState {
  if (input.mode === "edit" && input.event) {
    const dateTime = eventFormDateTime(input.event)
    return {
      title: eventDisplayTitle(input.event),
      calendarId: input.event.calendar_id,
      ...dateTime,
      timezone: input.event.timezone ?? localTimezone(),
      allDay: input.event.all_day,
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
    allDay: false,
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
    a.allDay === b.allDay &&
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
  if (form.allDay) {
    if (!form.startsDate.trim() || !form.endsDate.trim()) {
      return { ok: false, error: "Add a start and end date before saving." }
    }

    const startsAtLocal = `${form.startsDate}T00:00:00`
    const endsAtLocal = `${form.endsDate}T00:00:00`
    const startsAt = localDateTimeToInstant(startsAtLocal, form.timezone)
    const endsAt = localDateTimeToInstant(endsAtLocal, form.timezone)
    if (!startsAt || !endsAt) {
      return { ok: false, error: "Add a valid date range before saving." }
    }
    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      return { ok: false, error: "The event must end after it starts." }
    }

    const durationMs =
      new Date(endsAt).getTime() - new Date(startsAt).getTime()
    return {
      ok: true,
      startsAt,
      endsAt,
      startsAtLocal,
      endsAtLocal,
      timezone: form.timezone,
      durationMinutes: Math.round(durationMs / 60_000),
      allDay: true,
    }
  }

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
    allDay: false,
  }
}

function localTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
}

/** Human duration for the card ("1h 30m"). Null while the times are unusable. */
export function formatEventFormDuration(form: EventFormState): string | null {
  if (form.allDay) {
    if (!form.startsDate.trim() || !form.endsDate.trim()) return null
    const start = new Date(`${form.startsDate}T12:00:00`)
    const end = new Date(`${form.endsDate}T12:00:00`)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
    const dayCount = Math.max(
      1,
      Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1,
    )
    return dayCount === 1 ? "All day" : `${dayCount} days`
  }

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
    allDay: false,
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

  if (patch.allDay === true && !form.allDay) {
    next = {
      ...next,
      startsTime: "00:00",
      endsTime: "00:00",
    }
    const endDate = new Date(`${next.startsDate}T12:00:00`)
    if (!Number.isNaN(endDate.getTime())) {
      endDate.setDate(endDate.getDate() + 1)
      next.endsDate = toDateInputValue(endDate.toISOString())
    }
  }

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
