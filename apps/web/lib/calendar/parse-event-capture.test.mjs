process.env.TZ = "America/New_York"

import assert from "node:assert/strict"
import test from "node:test"
import { parseEventCapture } from "./parse-event-capture.ts"

// Wed 2026-07-22 09:00 local, with a clicked slot of Thu 2026-07-23 15:00-17:00.
const REFERENCE = new Date(2026, 6, 22, 9, 0)
const OPTIONS = {
  reference: REFERENCE,
  fallbackStartsAt: new Date(2026, 6, 23, 15, 0).toISOString(),
  fallbackEndsAt: new Date(2026, 6, 23, 17, 0).toISOString(),
}

function capture(line, overrides = {}) {
  return parseEventCapture(line, { ...OPTIONS, ...overrides })
}

/** Local wall-clock view of an ISO string, so assertions read like a calendar. */
function local(iso) {
  const date = new Date(iso)
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  }
}

test("parseEventCapture reads a date and time range and strips it from the title", () => {
  const result = capture("Design review tomorrow 3-4pm")

  assert.equal(result.title, "Design review")
  assert.deepEqual(local(result.startsAt), {
    year: 2026,
    month: 7,
    day: 23,
    hour: 15,
    minute: 0,
  })
  assert.deepEqual(local(result.endsAt), {
    year: 2026,
    month: 7,
    day: 23,
    hour: 16,
    minute: 0,
  })
  assert.equal(result.dateSource, "parsed")
  assert.equal(result.timeSource, "parsed")
  assert.equal(result.durationMinutes, 60)
  assert.deepEqual(result.consumedRanges, [[14, 28]])
})

test("parseEventCapture keeps the clicked day when the line names only a time", () => {
  // chrono resolves "noon" against its own reference (Jul 22). The clicked slot
  // is Jul 23, and that is the day the user meant.
  const result = capture("Lunch with Sam at noon")

  assert.equal(result.title, "Lunch with Sam")
  assert.deepEqual(local(result.startsAt), {
    year: 2026,
    month: 7,
    day: 23,
    hour: 12,
    minute: 0,
  })
  assert.equal(result.dateSource, "fallback")
  assert.equal(result.timeSource, "parsed")
  // The clicked slot was two hours long, so the event stays two hours long.
  assert.equal(result.durationMinutes, 120)
})

test("parseEventCapture keeps the clicked time when the line names only a weekday", () => {
  const result = capture("Sync Friday")

  assert.equal(result.title, "Sync")
  assert.deepEqual(local(result.startsAt), {
    year: 2026,
    month: 7,
    day: 24,
    hour: 15,
    minute: 0,
  })
  assert.equal(result.dateSource, "parsed")
  assert.equal(result.timeSource, "assumed")
})

test("parseEventCapture falls back entirely when the line names no date or time", () => {
  const result = capture("Standup")

  assert.equal(result.title, "Standup")
  assert.equal(result.startsAt, OPTIONS.fallbackStartsAt)
  assert.equal(result.endsAt, OPTIONS.fallbackEndsAt)
  assert.equal(result.dateSource, "fallback")
  assert.equal(result.timeSource, "assumed")
  assert.deepEqual(result.consumedRanges, [])
})

test("parseEventCapture ignores a vague time word instead of inventing a clock time", () => {
  // chrono offers 8pm for "evening" with nothing actually known. Accepting it
  // would both invent a time and eat the word out of the title.
  const result = capture("Meet manager in evening")

  assert.equal(result.title, "Meet manager in evening")
  assert.equal(result.startsAt, OPTIONS.fallbackStartsAt)
  assert.equal(result.timeSource, "assumed")
  assert.deepEqual(result.consumedRanges, [])
})

test("parseEventCapture leaves a bare numeric fraction alone", () => {
  // "3/4" reads as March 4 to chrono — and with forward dates, next year's.
  const result = capture("Ticket 3/4 done")

  assert.equal(result.title, "Ticket 3/4 done")
  assert.equal(result.dateSource, "fallback")
  assert.deepEqual(result.consumedRanges, [])
})

test("parseEventCapture trusts a numeric date once a date word introduces it", () => {
  const result = capture("Dentist on 7/20")

  assert.equal(result.title, "Dentist")
  assert.equal(result.dateSource, "parsed")
  assert.equal(local(result.startsAt).month, 7)
  assert.equal(local(result.startsAt).day, 20)
})

test("parseEventCapture does not read a proper noun that looks like a month", () => {
  const result = capture("Coffee at Cafe May")

  assert.equal(result.title, "Coffee at Cafe May")
  assert.equal(result.dateSource, "fallback")
})

test("parseEventCapture does not read a bare year as a date", () => {
  const result = capture("Deadline for 2018 accounts submission")

  assert.equal(result.title, "Deadline for 2018 accounts submission")
  assert.equal(result.dateSource, "fallback")
})

test("parseEventCapture reports a recurrence phrase rather than dropping it silently", () => {
  const result = capture("Retro every Tuesday 9am")

  assert.equal(result.recurrenceDetected, true)
  assert.equal(result.title, "Retro")
  assert.deepEqual(local(result.startsAt), {
    year: 2026,
    month: 7,
    day: 28,
    hour: 9,
    minute: 0,
  })
})

test("parseEventCapture reports recurrence even when no date survives the parse", () => {
  const result = capture("Water plants every monday")

  assert.equal(result.recurrenceDetected, true)
  assert.equal(result.title, "Water plants")
})

test("parseEventCapture returns an empty title for a blank line", () => {
  for (const blank of ["", "   "]) {
    const result = capture(blank)
    assert.equal(result.title, "")
    assert.equal(result.startsAt, OPTIONS.fallbackStartsAt)
    assert.equal(result.endsAt, OPTIONS.fallbackEndsAt)
  }
})

test("parseEventCapture reads an ISO date with an explicit start and end time", () => {
  const result = capture("Flight 2026-08-03 06:15 to 09:40")

  assert.equal(result.title, "Flight")
  assert.deepEqual(local(result.startsAt), {
    year: 2026,
    month: 8,
    day: 3,
    hour: 6,
    minute: 15,
  })
  assert.deepEqual(local(result.endsAt), {
    year: 2026,
    month: 8,
    day: 3,
    hour: 9,
    minute: 40,
  })
  assert.equal(result.durationMinutes, 205)
})

test("parseEventCapture resolves a bare weekday forward, never into the past", () => {
  // Reference is a Wednesday; "Tuesday" must land next week, not yesterday.
  const result = capture("Sync Tuesday")

  assert.ok(new Date(result.startsAt) > REFERENCE)
  assert.equal(local(result.startsAt).day, 28)
})

test("parseEventCapture keeps the stated wall-clock hour across a DST transition", () => {
  // US DST ends Sun 2026-11-01. Parsing "tomorrow 3pm" from the day before must
  // still mean 3pm local, not 2pm shifted by the offset change.
  const result = capture("Handoff tomorrow 3pm", {
    reference: new Date(2026, 9, 31, 9, 0),
    fallbackStartsAt: new Date(2026, 9, 31, 15, 0).toISOString(),
    fallbackEndsAt: new Date(2026, 9, 31, 16, 0).toISOString(),
  })

  assert.deepEqual(local(result.startsAt), {
    year: 2026,
    month: 11,
    day: 1,
    hour: 15,
    minute: 0,
  })
})

test("parseEventCapture always ends after it starts", () => {
  const lines = [
    "Design review tomorrow 3-4pm",
    "Lunch with Sam at noon",
    "Standup",
    "Sync Friday",
    "Flight 2026-08-03 06:15 to 09:40",
    "Retro every Tuesday 9am",
    "",
  ]

  for (const line of lines) {
    const result = capture(line)
    assert.ok(
      new Date(result.endsAt) > new Date(result.startsAt),
      `expected endsAt after startsAt for ${JSON.stringify(line)}`,
    )
    assert.ok(result.durationMinutes > 0)
  }
})

test("parseEventCapture swallows the preposition that introduced the date", () => {
  // chrono matches only "noon"; the leftover "at" would trail off the title.
  assert.equal(capture("Lunch with Sam at noon").title, "Lunch with Sam")
  assert.equal(capture("Handoff on Friday").title, "Handoff")
  // A preposition that is not introducing the date must survive.
  assert.equal(capture("Standup at office 9am").title, "Standup at office")
})

test("parseEventCapture consumedRanges stay in bounds and never overlap", () => {
  const lines = [
    "Design review tomorrow 3-4pm",
    "Retro every Tuesday 9am",
    "Flight 2026-08-03 06:15 to 09:40",
    "Standup",
  ]

  for (const line of lines) {
    const { consumedRanges } = capture(line)
    let previousEnd = 0
    for (const [start, end] of consumedRanges) {
      assert.ok(start >= previousEnd, `overlap in ${JSON.stringify(line)}`)
      assert.ok(start >= 0 && end <= line.length, `out of bounds in ${line}`)
      assert.ok(end > start)
      previousEnd = end
    }
  }
})
