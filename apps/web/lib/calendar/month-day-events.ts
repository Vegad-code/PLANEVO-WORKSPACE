import type { CalendarEventRow } from "@planevo/core/types/calendar"

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

/** Events that overlap [day 00:00, next day 00:00) in local time. */
export function eventsForCalendarDay(
  events: CalendarEventRow[],
  day: Date,
): CalendarEventRow[] {
  const windowStart = startOfDay(day)
  const windowEnd = addDays(windowStart, 1)
  return events
    .filter((event) => {
      const start = new Date(event.starts_at)
      const end = new Date(event.ends_at)
      return start < windowEnd && end > windowStart
    })
    .sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    )
}
