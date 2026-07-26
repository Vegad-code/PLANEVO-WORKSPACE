import * as RRulePackage from "rrule"
import type { CalendarEventRow } from "@planevo/core/types/calendar"

const { RRule } =
  "RRule" in RRulePackage
    ? RRulePackage
    : (RRulePackage as unknown as { default: typeof import("rrule") }).default

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
const MAX_FINITE_OCCURRENCES = 10_000

export type RecurrenceBoundaryResult =
  | { valid: true; recurrenceEnd: string | null }
  | { valid: false; recurrenceEnd: null }

export type RecurrenceIdentityMap = {
  oldRecurrenceId: string
  newRecurrenceId: string
}

export type RemapRecurrenceIdentitiesResult = {
  exceptionRecurrenceIdMap: RecurrenceIdentityMap[]
  recurrenceEnd: string | null
}

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

  const queryLimit = earliestInstant(recurrenceEnd, builtRule.until)
  if (
    (recurrenceEnd && recurrenceEnd <= windowStart) ||
    (builtRule.until && builtRule.until < windowStart)
  ) {
    return []
  }

  const queryEnd = queryLimit && queryLimit < windowEnd ? queryLimit : windowEnd
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
          (recurrenceEnd && occurrenceStart >= recurrenceEnd) ||
          (builtRule.until && occurrenceStart > builtRule.until)
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

          return [
            {
              ...exception.row,
              rrule: master.rrule,
              recurrence_end: master.recurrence_end,
            },
          ]
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

export function localDateTimeToInstant(
  value: string,
  timezone: string,
): string | null {
  const local = parseLocalDateTime(value)
  if (!local || !timezone) return null
  const instant = fromFloatingDate({
    floatingDate: toFloatingDate(local),
    timezone,
  })
  return instant?.toISOString() ?? null
}

export function instantToLocalDateTime(
  value: string,
  timezone: string,
): string | null {
  const instant = parseInstant(value)
  if (!instant || !timezone) return null
  return formatLocalDateTime({ date: instant, timezone })
}

/**
 * Persists a cheap SQL-query boundary for finite RFC rules. The extra
 * millisecond keeps recurrence_end exclusive while retaining the rule's last
 * inclusive COUNT/UNTIL occurrence.
 */
export function deriveRecurrenceBoundary(input: {
  rrule: string
  startsAtLocal: string
  timezone: string
}): RecurrenceBoundaryResult {
  const localStart = parseLocalDateTime(input.startsAtLocal)
  if (!localStart || !input.timezone) {
    return { valid: false, recurrenceEnd: null }
  }

  const floatingStart = toFloatingDate(localStart)
  const builtRule = buildRule({
    rrule: input.rrule,
    dtstart: floatingStart,
  })
  if (!builtRule) {
    return { valid: false, recurrenceEnd: null }
  }
  if (!datesEqual(builtRule.rule.after(floatingStart, true), floatingStart)) {
    return { valid: false, recurrenceEnd: null }
  }

  const count = builtRule.rule.options.count
  if (
    count != null &&
    (!Number.isSafeInteger(count) || count <= 0 || count > MAX_FINITE_OCCURRENCES)
  ) {
    return { valid: false, recurrenceEnd: null }
  }
  if (count == null && builtRule.until === null) {
    return { valid: true, recurrenceEnd: null }
  }

  const localUntil = builtRule.until
    ? toLocalDateTime({ date: builtRule.until, timezone: input.timezone })
    : null
  if (builtRule.until && !localUntil) {
    return { valid: false, recurrenceEnd: null }
  }
  const floatingUntil = localUntil ? toFloatingDate(localUntil) : null
  const floatingOccurrences = builtRule.rule.all((occurrence, index) => {
    return (
      index < MAX_FINITE_OCCURRENCES &&
      (!floatingUntil || occurrence <= floatingUntil)
    )
  })
  const lastFloating = floatingOccurrences.at(-1)
  if (!lastFloating) {
    return { valid: false, recurrenceEnd: null }
  }

  const nextFloating = builtRule.rule.after(lastFloating, false)
  if (nextFloating && (!floatingUntil || nextFloating <= floatingUntil)) {
    return { valid: false, recurrenceEnd: null }
  }

  const lastInstant = fromFloatingDate({
    floatingDate: lastFloating,
    timezone: input.timezone,
  })
  if (!lastInstant) {
    return { valid: false, recurrenceEnd: null }
  }

  return {
    valid: true,
    recurrenceEnd: new Date(lastInstant.getTime() + 1).toISOString(),
  }
}

/**
 * Maps exception identities by occurrence ordinal when a series is split.
 * A date delta is insufficient when the future rule changes frequency or day.
 */
export function remapRecurrenceIdentitiesForSplit(input: {
  master: CalendarEventRow
  splitRecurrenceId: string
  newStartsAtLocal: string
  newTimezone: string
  newRrule: string
  exceptionRecurrenceIds: string[]
}): RemapRecurrenceIdentitiesResult | null {
  const oldLocalStart = parseLocalDateTime(input.master.starts_at_local)
  const newLocalStart = parseLocalDateTime(input.newStartsAtLocal)
  const oldTimezone = input.master.timezone
  const oldRrule = input.master.rrule
  if (!oldLocalStart || !newLocalStart || !oldTimezone || !oldRrule) {
    return null
  }

  const oldRule = buildRule({
    rrule: oldRrule,
    dtstart: toFloatingDate(oldLocalStart),
  })
  const newRule = buildRule({
    rrule: input.newRrule,
    dtstart: toFloatingDate(newLocalStart),
  })
  const splitLocal = instantToLocalDateTime(
    input.splitRecurrenceId,
    oldTimezone,
  )
  const splitLocalParts = splitLocal ? parseLocalDateTime(splitLocal) : null
  if (!oldRule || !newRule || !splitLocalParts) {
    return null
  }

  const splitFloating = toFloatingDate(splitLocalParts)
  const newStartFloating = toFloatingDate(newLocalStart)
  if (
    !datesEqual(oldRule.rule.after(splitFloating, true), splitFloating) ||
    !datesEqual(newRule.rule.after(newStartFloating, true), newStartFloating)
  ) {
    return null
  }

  const mapped: RecurrenceIdentityMap[] = []
  const seenOld = new Set<string>()
  const seenNew = new Set<string>()
  for (const oldRecurrenceId of input.exceptionRecurrenceIds) {
    if (seenOld.has(oldRecurrenceId)) return null
    seenOld.add(oldRecurrenceId)

    const oldLocal = instantToLocalDateTime(oldRecurrenceId, oldTimezone)
    const oldLocalParts = oldLocal ? parseLocalDateTime(oldLocal) : null
    if (!oldLocalParts) return null

    const ordinal = recurrenceOrdinal({
      rule: oldRule.rule,
      first: splitFloating,
      target: toFloatingDate(oldLocalParts),
    })
    if (ordinal === null) return null

    const newFloating = occurrenceAtOrdinal({
      rule: newRule.rule,
      first: newStartFloating,
      ordinal,
    })
    if (!newFloating) return null
    const newInstant = fromFloatingDate({
      floatingDate: newFloating,
      timezone: input.newTimezone,
    })
    const newRecurrenceId = newInstant?.toISOString()
    if (!newRecurrenceId || seenNew.has(newRecurrenceId)) return null
    seenNew.add(newRecurrenceId)
    mapped.push({ oldRecurrenceId, newRecurrenceId })
  }

  const newNativeBoundary = deriveRecurrenceBoundary({
    rrule: input.newRrule,
    startsAtLocal: input.newStartsAtLocal,
    timezone: input.newTimezone,
  })
  if (!newNativeBoundary.valid) return null

  let recurrenceEnd = newNativeBoundary.recurrenceEnd
  const oldNativeBoundary = deriveRecurrenceBoundary({
    rrule: oldRrule,
    startsAtLocal: input.master.starts_at_local!,
    timezone: oldTimezone,
  })
  const persistedBoundaryMatchesNative =
    input.master.recurrence_end !== null &&
    oldNativeBoundary.valid &&
    oldNativeBoundary.recurrenceEnd !== null &&
    instantStringsEqual(
      oldNativeBoundary.recurrenceEnd,
      input.master.recurrence_end,
    )
  const preservesCountRule =
    /(^|;)COUNT=/i.test(oldRrule) &&
    input.newRrule.trim().toUpperCase() === oldRrule.trim().toUpperCase() &&
    persistedBoundaryMatchesNative
  const hasExplicitControllerBoundary =
    input.master.recurrence_end !== null &&
    !persistedBoundaryMatchesNative

  if (hasExplicitControllerBoundary || preservesCountRule) {
    const oldBoundaryInstant = preservesCountRule
      ? new Date(
          new Date(input.master.recurrence_end!).getTime() - 1,
        ).toISOString()
      : input.master.recurrence_end!
    const oldBoundaryLocal = instantToLocalDateTime(
      oldBoundaryInstant,
      oldTimezone,
    )
    const oldBoundaryParts = oldBoundaryLocal
      ? parseLocalDateTime(oldBoundaryLocal)
      : null
    if (!oldBoundaryParts) return null

    const boundaryOrdinal = recurrenceOrdinal({
      rule: oldRule.rule,
      first: splitFloating,
      target: toFloatingDate(oldBoundaryParts),
    })
    if (boundaryOrdinal === null) return null
    const newBoundaryFloating = occurrenceAtOrdinal({
      rule: newRule.rule,
      first: newStartFloating,
      ordinal: boundaryOrdinal,
    })
    if (!newBoundaryFloating) return null
    const mappedBoundary = fromFloatingDate({
      floatingDate: newBoundaryFloating,
      timezone: input.newTimezone,
    })
    const mappedBoundaryIso = mappedBoundary
      ? new Date(
          mappedBoundary.getTime() + (preservesCountRule ? 1 : 0),
        ).toISOString()
      : null
    if (!mappedBoundaryIso) return null
    if (!recurrenceEnd || mappedBoundaryIso < recurrenceEnd) {
      recurrenceEnd = mappedBoundaryIso
    }
  }

  return {
    exceptionRecurrenceIdMap: mapped,
    recurrenceEnd,
  }
}

function recurrenceOrdinal(input: {
  rule: InstanceType<typeof RRule>
  first: Date
  target: Date
}): number | null {
  if (input.target < input.first) return null
  const occurrences = input.rule.between(input.first, input.target, true)
  if (
    occurrences.length === 0 ||
    occurrences.length > MAX_FINITE_OCCURRENCES ||
    !datesEqual(occurrences[0] ?? null, input.first) ||
    !datesEqual(occurrences.at(-1) ?? null, input.target)
  ) {
    return null
  }
  return occurrences.length - 1
}

function occurrenceAtOrdinal(input: {
  rule: InstanceType<typeof RRule>
  first: Date
  ordinal: number
}): Date | null {
  if (
    !Number.isSafeInteger(input.ordinal) ||
    input.ordinal < 0 ||
    input.ordinal >= MAX_FINITE_OCCURRENCES
  ) {
    return null
  }

  let occurrence = input.first
  for (let index = 0; index < input.ordinal; index += 1) {
    const next = input.rule.after(occurrence, false)
    if (!next) return null
    occurrence = next
  }
  return occurrence
}

function datesEqual(left: Date | null, right: Date | null): boolean {
  return left?.getTime() === right?.getTime()
}

function instantStringsEqual(left: string, right: string): boolean {
  const leftInstant = parseInstant(left)
  const rightInstant = parseInstant(right)
  return datesEqual(leftInstant, rightInstant)
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
