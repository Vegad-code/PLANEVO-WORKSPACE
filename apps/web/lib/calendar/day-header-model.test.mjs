import assert from "node:assert/strict"
import test from "node:test"
import {
  formatDayHeaderAccessibleLabel,
  formatDayHeaderDayNumber,
  formatDayHeaderWeekday,
  isCalendarToday,
  isSameCalendarDay,
} from "./day-header-model.ts"

test("isSameCalendarDay ignores time-of-day", () => {
  const a = new Date(2026, 6, 24, 9, 0, 0)
  const b = new Date(2026, 6, 24, 23, 59, 59)
  assert.equal(isSameCalendarDay(a, b), true)
  assert.equal(isSameCalendarDay(a, new Date(2026, 6, 25)), false)
})

test("formatDayHeaderWeekday returns uppercase short weekday", () => {
  assert.equal(formatDayHeaderWeekday(new Date(2026, 6, 24), "en-US"), "FRI")
})

test("formatDayHeaderDayNumber returns day of month", () => {
  assert.equal(formatDayHeaderDayNumber(new Date(2026, 6, 24)), "24")
})

test("isCalendarToday uses local calendar day", () => {
  const now = new Date(2026, 6, 24, 15, 0, 0)
  assert.equal(isCalendarToday(new Date(2026, 6, 24, 0, 0, 0), now), true)
  assert.equal(isCalendarToday(new Date(2026, 6, 23), now), false)
})

test("formatDayHeaderAccessibleLabel includes weekday and date parts", () => {
  const label = formatDayHeaderAccessibleLabel(new Date(2026, 6, 24), "en-US")
  assert.match(label, /Friday/i)
  assert.match(label, /July/i)
  assert.match(label, /24/)
  assert.match(label, /2026/)
})
