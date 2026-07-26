import * as chrono from "chrono-node/en"
import type { ParsedResult } from "chrono-node"

/**
 * Reads one freeform line ("Design review tomorrow 3-4pm") into an event.
 *
 * The product promise is that the parse is a visible suggestion, never a silent
 * commit: every field reports whether it was actually stated or merely assumed,
 * and `consumedRanges` says which characters became the date so the UI can
 * highlight them in place. Nothing is taken out of the title without showing it.
 */
export type EventCapture = {
  /** The line minus everything the parse claimed. */
  title: string
  startsAt: string
  endsAt: string
  /** Half-open `[start, end)` spans of the input the parse claimed. */
  consumedRanges: [number, number][]
  /** "parsed" = the line named a day. "fallback" = we kept the clicked slot's day. */
  dateSource: "parsed" | "fallback"
  /** "parsed" = the line named a time. "assumed" = we kept the clicked slot's time. */
  timeSource: "parsed" | "assumed"
  durationMinutes: number
  /** Canonical RFC 5545 rule when the line names a supported repeat phrase. */
  rrule: string | null
}

export type EventCaptureOptions = {
  /** "Now" for relative phrases. Injected so this stays testable. */
  reference: Date
  /** The slot the user clicked, used for whatever the line does not state. */
  fallbackStartsAt: string
  fallbackEndsAt: string
}

/**
 * `every <weekday>` — matched independently of chrono so the phrase becomes an
 * RRULE and never leaks into the title.
 */
const RECURRENCE_PATTERN =
  /\bevery\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i
const RRULE_WEEKDAYS: Record<string, string> = {
  sunday: "SU",
  monday: "MO",
  tuesday: "TU",
  wednesday: "WE",
  thursday: "TH",
  friday: "FR",
  saturday: "SA",
}

/**
 * A bare `3/4` or `7.20`. chrono reads these as month/day, so "Ticket 3/4 done"
 * would schedule an event in March — and because we ask for forward dates, in
 * *next* year's March. Only trust the number when a date word introduces it.
 */
const NUMERIC_DATE_PATTERN = /^\d{1,2}[./]\d{1,2}$/
const DATE_SIGNAL_PATTERN = /(?:^|\s)(?:due|on|by|at|deadline|from)$/i

/**
 * The preposition that introduced a date, which chrono leaves behind. Without
 * this, "Lunch with Sam at noon" yields the title "Lunch with Sam at".
 */
const TRAILING_DATE_PREPOSITION = /(?:^|\s)(due|on|by|at|from|starting)\s*$/i

const DEFAULT_DURATION_MINUTES = 60
const MINUTES_PER_MS = 1 / 60_000

/** The line named a day — as a weekday ("Friday") or a calendar date ("Jul 4"). */
function statesDate(components: ParsedResult["start"]): boolean {
  return components.isCertain("day") || components.isCertain("weekday")
}

/** The line named a clock time. False for vague words like "evening". */
function statesTime(components: ParsedResult["start"]): boolean {
  return components.isCertain("hour")
}

/**
 * chrono happily returns a match for "in the evening" with nothing known — it
 * invents 8pm from its own defaults. Trusting that is the single most-reported
 * complaint about natural-language calendars, and consuming the word would also
 * eat it out of the title, so a match that states nothing is no match at all.
 */
function isUsableResult(result: ParsedResult, line: string): boolean {
  if (!statesDate(result.start) && !statesTime(result.start)) return false

  const matched = result.text.trim()
  if (NUMERIC_DATE_PATTERN.test(matched)) {
    const precedingText = line.slice(0, result.index).trimEnd()
    if (!DATE_SIGNAL_PATTERN.test(precedingText)) return false
  }

  return true
}

/**
 * Widens a match to swallow the preposition that introduced it, so the title
 * reads as a phrase rather than trailing off mid-sentence.
 */
function withLeadingPreposition(
  line: string,
  matchIndex: number,
): number {
  const preceding = line.slice(0, matchIndex)
  const prepositionMatch = TRAILING_DATE_PREPOSITION.exec(preceding)
  if (!prepositionMatch) return matchIndex
  return preceding.lastIndexOf(prepositionMatch[1]!)
}

/** Merges overlapping/adjacent spans so the title is removed in one pass. */
function mergeRanges(ranges: [number, number][]): [number, number][] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []

  for (const [start, end] of sorted) {
    const previous = merged[merged.length - 1]
    if (previous && start <= previous[1]) {
      previous[1] = Math.max(previous[1], end)
      continue
    }
    merged.push([start, end])
  }

  return merged
}

function titleWithoutRanges(line: string, ranges: [number, number][]): string {
  let remaining = ""
  let cursor = 0

  for (const [start, end] of ranges) {
    remaining += line.slice(cursor, start)
    cursor = end
  }
  remaining += line.slice(cursor)

  return remaining.replace(/\s+/g, " ").trim()
}

/**
 * Builds a timestamp from a day and a wall-clock time that may come from
 * different places — the parsed date with the clicked slot's time, say. Taking
 * chrono's own `Date` wholesale would silently move "Lunch at noon" to today,
 * because chrono fills the day it wasn't told from its reference date.
 */
function combineDayAndTime(day: Date, time: Date): Date {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    time.getHours(),
    time.getMinutes(),
    0,
    0,
  )
}

function minutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) * MINUTES_PER_MS)
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000)
}

export function parseEventCapture(
  line: string,
  options: EventCaptureOptions,
): EventCapture {
  const fallbackStart = new Date(options.fallbackStartsAt)
  const fallbackEnd = new Date(options.fallbackEndsAt)
  const fallbackDuration = Math.max(
    1,
    minutesBetween(fallbackStart, fallbackEnd) || DEFAULT_DURATION_MINUTES,
  )

  const fallbackCapture = (
    overrides: Partial<EventCapture> = {},
  ): EventCapture => ({
    title: line.replace(/\s+/g, " ").trim(),
    startsAt: fallbackStart.toISOString(),
    endsAt: fallbackEnd.toISOString(),
    consumedRanges: [],
    dateSource: "fallback",
    timeSource: "assumed",
    durationMinutes: fallbackDuration,
    rrule: null,
    ...overrides,
  })

  if (!line.trim()) return fallbackCapture({ title: "" })

  const recurrenceMatch = RECURRENCE_PATTERN.exec(line)
  const recurrenceWeekday = recurrenceMatch?.[1]?.toLowerCase()
  const rrule = recurrenceWeekday
    ? `FREQ=WEEKLY;BYDAY=${RRULE_WEEKDAYS[recurrenceWeekday]}`
    : null
  const recurrenceRange: [number, number][] = recurrenceMatch
    ? [[recurrenceMatch.index, recurrenceMatch.index + recurrenceMatch[0].length]]
    : []

  const match = chrono
    .parse(line, options.reference, { forwardDate: true })
    .find((result) => isUsableResult(result, line))

  if (!match) {
    const consumedRanges = mergeRanges(recurrenceRange)
    return fallbackCapture({
      title: titleWithoutRanges(line, consumedRanges),
      consumedRanges,
      rrule,
    })
  }

  const dateStated = statesDate(match.start)
  const timeStated = statesTime(match.start)
  const parsedStart = match.start.date()

  const startsAt = combineDayAndTime(
    dateStated ? parsedStart : fallbackStart,
    timeStated ? parsedStart : fallbackStart,
  )

  // An explicit range ("3-4pm") sets the duration; otherwise keep the length of
  // the slot the user clicked, so a dragged 30-minute block stays 30 minutes.
  const parsedEnd =
    match.end && match.end.isCertain("hour")
      ? combineDayAndTime(startsAt, match.end.date())
      : null
  const durationMinutes =
    parsedEnd && parsedEnd > startsAt
      ? minutesBetween(startsAt, parsedEnd)
      : fallbackDuration

  const consumedRanges = mergeRanges([
    ...recurrenceRange,
    [
      withLeadingPreposition(line, match.index),
      match.index + match.text.length,
    ],
  ])

  return {
    title: titleWithoutRanges(line, consumedRanges),
    startsAt: startsAt.toISOString(),
    endsAt: addMinutes(startsAt, durationMinutes).toISOString(),
    consumedRanges,
    dateSource: dateStated ? "parsed" : "fallback",
    timeSource: timeStated ? "parsed" : "assumed",
    durationMinutes,
    rrule,
  }
}
