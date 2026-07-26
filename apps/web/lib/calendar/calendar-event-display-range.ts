import type { CalendarEventRow } from "@planevo/core/types/calendar"

type DisplayRangeEvent = Pick<
  CalendarEventRow,
  "starts_at" | "ends_at" | "all_day" | "source"
>

function validDate(date: Date): boolean {
  return Number.isFinite(date.getTime())
}

function externalAllDayDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return null
  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return validDate(date) ? date : null
}

/**
 * Provider all-day values are date-only concepts. Rebuilding their ISO date
 * in local time prevents UTC midnight from appearing on the previous day.
 */
export function calendarEventDisplayRange(
  event: DisplayRangeEvent,
): { start: Date; end: Date } | null {
  const externalAllDay = event.all_day && event.source !== "planevo"
  const start = externalAllDay
    ? externalAllDayDate(event.starts_at)
    : new Date(event.starts_at)
  const end = externalAllDay
    ? externalAllDayDate(event.ends_at)
    : new Date(event.ends_at)
  if (!start || !end || !validDate(start) || !validDate(end)) {
    return null
  }
  return { start, end }
}
