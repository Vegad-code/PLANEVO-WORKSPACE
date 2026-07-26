import type { CalendarEventRow } from "@planevo/core/types/calendar"
import { expandRecurrence } from "./recurrence.ts"

export type CalendarEventRangeMode = "starts-in" | "overlaps"

export type MaterializeCalendarEventsInput = {
  standalone: CalendarEventRow[]
  masters: CalendarEventRow[]
  exceptions: CalendarEventRow[]
  windowStart: Date
  windowEnd: Date
  eventRange: CalendarEventRangeMode
}

/**
 * Converts the query layer's persisted rows into the concrete event list every
 * renderer consumes. Moving an override can move it independently of its
 * original occurrence, so overrides are merged once after normal expansion.
 */
export function materializeCalendarEvents({
  standalone,
  masters,
  exceptions,
  windowStart,
  windowEnd,
  eventRange,
}: MaterializeCalendarEventsInput): CalendarEventRow[] {
  if (
    !isValidDate(windowStart) ||
    !isValidDate(windowEnd) ||
    windowStart >= windowEnd
  ) {
    return []
  }

  const rowsById = new Map<string, CalendarEventRow>()
  const masterIds = new Set(masters.map(({ id }) => id))
  const mastersById = new Map(masters.map((master) => [master.id, master]))

  for (const row of standalone) {
    if (matchesWindow({ row, windowStart, windowEnd, eventRange })) {
      rowsById.set(row.id, row)
    }
  }

  for (const master of masters) {
    const durationMinutes =
      typeof master.duration_minutes === "number" &&
      Number.isFinite(master.duration_minutes) &&
      master.duration_minutes > 0
        ? master.duration_minutes
        : 0
    const expansionStart =
      eventRange === "overlaps" && durationMinutes > 0
        ? new Date(windowStart.getTime() - durationMinutes * 60_000)
        : windowStart
    const masterExceptions = exceptions.filter(
      ({ parent_event_id }) => parent_event_id === master.id,
    )

    const instances = expandRecurrence({
      master,
      exceptions: masterExceptions,
      windowStart: expansionStart,
      windowEnd,
    })
    for (const instance of instances) {
      if (
        matchesWindow({
          row: instance,
          windowStart,
          windowEnd,
          eventRange,
        })
      ) {
        rowsById.set(instance.id, instance)
      }
    }
  }

  for (const exception of exceptions) {
    if (
      !exception.parent_event_id ||
      !masterIds.has(exception.parent_event_id) ||
      !exception.recurrence_id ||
      !exception.is_exception ||
      exception.is_cancelled ||
      !matchesWindow({
        row: exception,
        windowStart,
        windowEnd,
        eventRange,
      })
    ) {
      continue
    }
    const master = mastersById.get(exception.parent_event_id)
    rowsById.set(exception.id, {
      ...exception,
      rrule: master?.rrule ?? null,
      recurrence_end: master?.recurrence_end ?? null,
    })
  }

  return [...rowsById.values()].sort((left, right) => {
    const timeDifference =
      new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime()
    return timeDifference || left.id.localeCompare(right.id)
  })
}

function matchesWindow({
  row,
  windowStart,
  windowEnd,
  eventRange,
}: {
  row: CalendarEventRow
  windowStart: Date
  windowEnd: Date
  eventRange: CalendarEventRangeMode
}): boolean {
  if (row.deleted_at !== null || row.is_cancelled) {
    return false
  }

  const startsAt = new Date(row.starts_at)
  const endsAt = new Date(row.ends_at)
  if (
    !isValidDate(startsAt) ||
    !isValidDate(endsAt) ||
    startsAt >= endsAt
  ) {
    return false
  }

  return eventRange === "overlaps"
    ? startsAt < windowEnd && endsAt > windowStart
    : startsAt >= windowStart && startsAt < windowEnd
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime())
}
