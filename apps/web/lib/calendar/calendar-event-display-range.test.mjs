process.env.TZ = "America/Los_Angeles"

import assert from "node:assert/strict"
import test from "node:test"
import { calendarEventDisplayRange } from "./calendar-event-display-range.ts"

test("external all-day dates stay on their authored local calendar day", () => {
  const range = calendarEventDisplayRange({
    starts_at: "2026-07-27T00:00:00.000Z",
    ends_at: "2026-07-28T00:00:00.000Z",
    all_day: true,
    source: "google",
  })

  assert.ok(range)
  assert.equal(range.start.getFullYear(), 2026)
  assert.equal(range.start.getMonth(), 6)
  assert.equal(range.start.getDate(), 27)
  assert.equal(range.start.getHours(), 0)
  assert.equal(range.end.getDate(), 28)
})

test("timed and Planevo events preserve their exact instants", () => {
  const range = calendarEventDisplayRange({
    starts_at: "2026-07-27T00:00:00.000Z",
    ends_at: "2026-07-27T01:00:00.000Z",
    all_day: false,
    source: "ics",
  })

  assert.equal(range.start.toISOString(), "2026-07-27T00:00:00.000Z")
  assert.equal(range.end.toISOString(), "2026-07-27T01:00:00.000Z")
})
