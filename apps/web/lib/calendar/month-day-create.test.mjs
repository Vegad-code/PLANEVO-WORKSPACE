process.env.TZ = "America/New_York"

import assert from "node:assert/strict"
import test from "node:test"
import { defaultMonthCreateRange } from "./month-day-create.ts"

test("defaultMonthCreateRange opens a one-hour 9am slot on the given day", () => {
  const { startsAt, endsAt } = defaultMonthCreateRange(new Date(2026, 6, 23, 18, 42))

  assert.equal(startsAt.getFullYear(), 2026)
  assert.equal(startsAt.getMonth(), 6)
  assert.equal(startsAt.getDate(), 23)
  assert.equal(startsAt.getHours(), 9)
  assert.equal(startsAt.getMinutes(), 0)
  assert.equal(endsAt.getHours(), 10)
})

test("defaultMonthCreateRange ignores the time of day it was handed", () => {
  const midnight = defaultMonthCreateRange(new Date(2026, 6, 23, 0, 0))
  const lateNight = defaultMonthCreateRange(new Date(2026, 6, 23, 23, 59))

  assert.equal(midnight.startsAt.getTime(), lateNight.startsAt.getTime())
})

test("defaultMonthCreateRange stays on the requested day across a DST change", () => {
  // US DST ends 2026-11-01; the slot must still be 9am local on Nov 1.
  const { startsAt, endsAt } = defaultMonthCreateRange(new Date(2026, 10, 1, 12, 0))

  assert.equal(startsAt.getDate(), 1)
  assert.equal(startsAt.getHours(), 9)
  assert.equal(endsAt.getHours(), 10)
})
