import rrule from "rrule"
import type { CalendarEventRow } from "@planevo/core/types/calendar"

const { RRule } = rrule

/**
 * Expands wall-clock recurrence rules only within a supplied window. RRule is
 * deliberately fed floating UTC dates, then each occurrence is resolved in the
 * event timezone so local times survive daylight-saving changes.
 */
export type ExpandInput = {
  master: CalendarEventRow
  exceptions: CalendarEventRow[]
  windowStart: Date
  windowEnd: Date
}

type LocalDateTime = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  millisecond: number
}

type BuiltRule = {
  rule: InstanceType<typeof RRule>
  until: Date | null
}

type IndexedException = {
  row: CalendarEventRow
  startsAt: Date | null
}

const INSTANCE_SEPARATOR = "::"

export function expandRecurrence({
  master,
  exceptions,
  windowStart,
  windowEnd,
}: ExpandInput): CalendarEventRow[] {
  const localStart = parseLocalDateTime(master.starts_at_local)
  const { rrule: rruleValue, timezone, duration_minutes: durationMinutes } = master
  if (
    !localStart ||
    !rruleValue ||
    !timezone ||
    !isDuration(durationMinutes) ||
    !isValidDate(windowStart) ||
    !isValidDate(windowEnd) ||
    windowStart >= windowEnd
  ) {
    return []
  }

  const recurrenceEnd = parseInstant(master.recurrence_end)
  if (master.recurrence_end !== null && !recurrenceEnd) {
    return []
  }

  const builtRule = buildRule({ rrule: rruleValue, dtstart: toFloatingDate(localStart) })
  if (!builtRule) {
    return []
  }

  const inclusiveEnd = earliestInstant(recurrenceEnd, builtRule.until)
  if (inclusiveEnd && inclusiveEnd < windowStart) {
    return []
  }

  const queryEnd = inclusiveEnd && inclusiveEnd < windowEnd ? inclusiveEnd : windowEnd
  const localWindowStart = toLocalDateTime({ date: windowStart, timezone })
  const localQueryEnd = toLocalDateTime({ date: queryEnd, timezone })
  if (!localWindowStart || !localQueryEnd) {
    return []
  }

  const exceptionsByRecurrenceId = indexExceptions({ exceptions, masterId: master.id })
  if (!exceptionsByRecurrenceId) {
    return []
  }

  try {
    return builtRule.rule
      .between(toFloatingDate(localWindowStart), toFloatingDate(localQueryEnd), true)
      .flatMap((floatingOccurrence) => {
        const occurrenceStart = fromFloatingDate({
          floatingDate: floatingOccurrence,
          timezone,
        })
        if (
          !occurrenceStart ||
          occurrenceStart < windowStart ||
          occurrenceStart >= windowEnd ||
          (inclusiveEnd && occurrenceStart > inclusiveEnd)
        ) {
          return []
        }

        const recurrenceId = occurrenceStart.toISOString()
        const exception = exceptionsByRecurrenceId.get(recurrenceId)
        if (exception) {
          if (
            exception.row.is_cancelled ||
            !exception.startsAt ||
            exception.startsAt < windowStart ||
            exception.startsAt >= windowEnd
          ) {
            return []
          }

          return [exception.row]
        }

        const occurrenceEnd = new Date(
          occurrenceStart.getTime() + durationMinutes * 60_000,
        )
        const endsAtLocal = formatLocalDateTime({ date: occurrenceEnd, timezone })
        if (!endsAtLocal) {
          return []
        }

        return [
          {
            ...master,
            id: `${master.id}${INSTANCE_SEPARATOR}${recurrenceId}`,
            starts_at: occurrenceStart.toISOString(),
            ends_at: occurrenceEnd.toISOString(),
            starts_at_local: formatFloatingDate(floatingOccurrence),
            ends_at_local: endsAtLocal,
            recurrence_id: recurrenceId,
          },
        ]
      })
  } catch {
    return []
  }
}

export function parseInstanceId(id: string): { masterId: string; recurrenceId: string } | null {
  const parts = id.split(INSTANCE_SEPARATOR)
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null
  }

  const recurrenceDate = parseInstant(parts[1])
  if (!recurrenceDate || recurrenceDate.toISOString() !== parts[1]) {
    return null
  }

  return { masterId: parts[0], recurrenceId: parts[1] }
}

function buildRule({
  rrule,
  dtstart,
}: {
  rrule: string
  dtstart: Date
}): BuiltRule | null {
  try {
    const parsed = RRule.parseString(rrule.trim())
    if (parsed.freq === undefined) {
      return null
    }

    const { until, ...floatingOptions } = parsed
    if (until && !isValidDate(until)) {
      return null
    }

    return {
      rule: new RRule({ ...floatingOptions, dtstart }),
      until: until ?? null,
    }
  } catch {
    return null
  }
}

function indexExceptions({
  exceptions,
  masterId,
}: {
  exceptions: CalendarEventRow[]
  masterId: string
}): Map<string, IndexedException> | null {
  const indexed = new Map<string, IndexedException>()
  for (const exception of exceptions) {
    if (
      exception.parent_event_id !== masterId ||
      !exception.recurrence_id ||
      !exception.is_exception ||
      exception.deleted_at !== null
    ) {
      return null
    }

    const recurrenceId = parseInstant(exception.recurrence_id)
    const recurrenceKey = recurrenceId?.toISOString()
    if (!recurrenceKey || indexed.has(recurrenceKey)) {
      return null
    }

    if (exception.is_cancelled) {
      indexed.set(recurrenceKey, { row: exception, startsAt: null })
      continue
    }

    const startsAt = parseInstant(exception.starts_at)
    const endsAt = parseInstant(exception.ends_at)
    if (!startsAt || !endsAt || startsAt >= endsAt) {
      return null
    }

    indexed.set(recurrenceKey, { row: exception, startsAt })
  }

  return indexed
}

function earliestInstant(left: Date | null, right: Date | null): Date | null {
  if (!left) {
    return right
  }
  if (!right) {
    return left
  }
  return left < right ? left : right
}

function isDuration(value: number | null): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

function parseInstant(value: string | null): Date | null {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  return isValidDate(parsed) ? parsed : null
}

function parseLocalDateTime(value: string | null): LocalDateTime | null {
  if (!value) {
    return null
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value)
  if (!match) {
    return null
  }

  const local = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? "0"),
    millisecond: Number((match[7] ?? "").padEnd(3, "0") || "0"),
  }
  const date = new Date(
    Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
      local.millisecond,
    ),
  )
  if (
    date.getUTCFullYear() !== local.year ||
    date.getUTCMonth() !== local.month - 1 ||
    date.getUTCDate() !== local.day ||
    date.getUTCHours() !== local.hour ||
    date.getUTCMinutes() !== local.minute ||
    date.getUTCSeconds() !== local.second ||
    date.getUTCMilliseconds() !== local.millisecond
  ) {
    return null
  }

  return local
}

function toFloatingDate(local: LocalDateTime): Date {
  return new Date(
    Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
      local.millisecond,
    ),
  )
}

function fromFloatingDate({
  floatingDate,
  timezone,
}: {
  floatingDate: Date
  timezone: string
}): Date | null {
  const local = {
    year: floatingDate.getUTCFullYear(),
    month: floatingDate.getUTCMonth() + 1,
    day: floatingDate.getUTCDate(),
    hour: floatingDate.getUTCHours(),
    minute: floatingDate.getUTCMinutes(),
    second: floatingDate.getUTCSeconds(),
    millisecond: floatingDate.getUTCMilliseconds(),
  }
  const intendedTimestamp = toFloatingDate(local).getTime()
  const initialOffset = timezoneOffsetMinutes({ date: new Date(intendedTimestamp), timezone })
  if (initialOffset === null) {
    return null
  }

  const firstCandidate = new Date(intendedTimestamp - initialOffset * 60_000)
  const resolvedOffset = timezoneOffsetMinutes({ date: firstCandidate, timezone })
  if (resolvedOffset === null) {
    return null
  }

  const candidate = new Date(intendedTimestamp - resolvedOffset * 60_000)
  const resolvedLocal = toLocalDateTime({ date: candidate, timezone })
  return resolvedLocal && localDateTimesEqual(resolvedLocal, local) ? candidate : null
}

function timezoneOffsetMinutes({ date, timezone }: { date: Date; timezone: string }): number | null {
  const local = toLocalDateTime({ date, timezone })
  if (!local) {
    return null
  }

  return (toFloatingDate(local).getTime() - date.getTime()) / 60_000
}

function toLocalDateTime({ date, timezone }: { date: Date; timezone: string }): LocalDateTime | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      calendar: "iso8601",
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date)
    const values = Object.fromEntries(
      parts
        .filter(({ type }) => type !== "literal")
        .map(({ type, value }) => [type, value]),
    )
    const year = Number(values.year)
    const month = Number(values.month)
    const day = Number(values.day)
    const hour = Number(values.hour)
    const minute = Number(values.minute)
    const second = Number(values.second)
    if (![year, month, day, hour, minute, second].every(Number.isFinite)) {
      return null
    }

    return { year, month, day, hour, minute, second, millisecond: date.getUTCMilliseconds() }
  } catch {
    return null
  }
}

function formatFloatingDate(date: Date): string {
  return formatLocalDateTimeParts({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
    second: date.getUTCSeconds(),
    millisecond: date.getUTCMilliseconds(),
  })
}

function formatLocalDateTime({ date, timezone }: { date: Date; timezone: string }): string | null {
  const local = toLocalDateTime({ date, timezone })
  return local ? formatLocalDateTimeParts(local) : null
}

function formatLocalDateTimeParts({
  year,
  month,
  day,
  hour,
  minute,
  second,
  millisecond,
}: LocalDateTime): string {
  const date = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`
  return millisecond === 0 ? `${date}T${time}` : `${date}T${time}.${String(millisecond).padStart(3, "0")}`
}

function localDateTimesEqual(left: LocalDateTime, right: LocalDateTime): boolean {
  return (
    left.year === right.year &&
    left.month === right.month &&
    left.day === right.day &&
    left.hour === right.hour &&
    left.minute === right.minute &&
    left.second === right.second &&
    left.millisecond === right.millisecond
  )
}
