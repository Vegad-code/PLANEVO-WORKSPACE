import assert from "node:assert/strict"
import test from "node:test"
import { calendarDays } from "@planevo/core/state/calendar-state"
import {
  focusDateAfterPageKey,
  focusDateKeyInGrid,
} from "./month-keyboard-focus.ts"

test("page down preserves weekday column across months", () => {
  const active = new Date(2026, 6, 24)

  const next = focusDateAfterPageKey(active, "PageDown")

  assert.equal(next.getDay(), 5)
  assert.equal(next.getMonth(), 7)
})

test("page up preserves weekday column across months", () => {
  const active = new Date(2026, 6, 24)

  const previous = focusDateAfterPageKey(active, "PageUp")

  assert.equal(previous.getDay(), 5)
  assert.equal(previous.getMonth(), 5)
})

test("returns the exact key when the target day is visible", () => {
  const anchor = new Date(2026, 6, 1)
  const days = calendarDays(anchor)

  const key = focusDateKeyInGrid(new Date(2026, 6, 15), days)

  assert.equal(key, "2026-07-15")
})

test("falls back to the closest same-weekday cell when the target is outside the grid", () => {
  const anchor = new Date(2026, 6, 1)
  const days = calendarDays(anchor)
  const target = new Date(2026, 7, 31)

  const key = focusDateKeyInGrid(target, days)
  const [year, month, day] = key.split("-").map(Number)

  assert.equal(new Date(year, month - 1, day).getDay(), target.getDay())
})
