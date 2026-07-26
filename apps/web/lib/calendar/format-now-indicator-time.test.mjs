import assert from "node:assert/strict"
import test from "node:test"
import { formatNowIndicatorTime } from "./format-now-indicator-time.ts"

test("formatNowIndicatorTime uses GCal-style spaced colon", () => {
  assert.equal(
    formatNowIndicatorTime(new Date(2026, 6, 24, 11, 10, 0)),
    "11 : 10 AM",
  )
  assert.equal(
    formatNowIndicatorTime(new Date(2026, 6, 24, 9, 0, 0)),
    "9 : 00 AM",
  )
  assert.equal(
    formatNowIndicatorTime(new Date(2026, 6, 24, 12, 30, 0)),
    "12 : 30 PM",
  )
})
