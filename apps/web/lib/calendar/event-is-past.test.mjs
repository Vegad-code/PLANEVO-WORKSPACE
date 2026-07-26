import assert from "node:assert/strict"
import test from "node:test"
import { isCalendarEventPast } from "./event-is-past.ts"

const now = new Date("2026-07-25T15:00:00.000Z")

test("isCalendarEventPast is true when end is before now", () => {
  assert.equal(isCalendarEventPast("2026-07-25T14:59:00.000Z", now), true)
})

test("isCalendarEventPast is false when end is now or later", () => {
  assert.equal(isCalendarEventPast("2026-07-25T15:00:00.000Z", now), false)
  assert.equal(isCalendarEventPast("2026-07-25T16:00:00.000Z", now), false)
})
