import assert from "node:assert/strict"
import test from "node:test"
import { formatCompactMonthTime } from "./format-compact-month-time.ts"

test("formatCompactMonthTime omits minutes on the hour", () => {
  assert.equal(formatCompactMonthTime(new Date(2026, 6, 24, 9, 0)), "9a")
  assert.equal(formatCompactMonthTime(new Date(2026, 6, 24, 12, 0)), "12p")
  assert.equal(formatCompactMonthTime(new Date(2026, 6, 24, 0, 0)), "12a")
})

test("formatCompactMonthTime includes minutes when not on the hour", () => {
  assert.equal(formatCompactMonthTime(new Date(2026, 6, 24, 9, 30)), "9:30a")
  assert.equal(formatCompactMonthTime(new Date(2026, 6, 24, 15, 30)), "3:30p")
})
