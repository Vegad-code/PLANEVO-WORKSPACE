import assert from "node:assert/strict"
import { test } from "node:test"
import { calendarQueryKey, calendarQueryScopePrefix } from "./calendar-query-keys.ts"

const anchor = new Date(2026, 6, 24)

test("calendarQueryKey is stable for same anchor and view", () => {
  const a = calendarQueryKey("all", "week", anchor)
  const b = calendarQueryKey("all", "week", new Date(2026, 6, 24))
  assert.deepEqual(a, b)
})

test("calendarQueryKey differs for adjacent weeks", () => {
  const current = calendarQueryKey("all", "week", anchor)
  const next = calendarQueryKey(
    "all",
    "week",
    new Date(2026, 6, 31),
  )
  assert.notDeepEqual(current, next)
})

test("calendarQueryKey differs by scope", () => {
  const all = calendarQueryKey("all", "week", anchor)
  const workspace = calendarQueryKey("workspace", "week", anchor)
  assert.notDeepEqual(all, workspace)
})

test("year view key spans full calendar year range", () => {
  const key = calendarQueryKey("all", "year", anchor)
  assert.equal(key[3], "2026-01-01")
  assert.equal(key[4], "2027-01-01")
})

test("day view key is single-day window", () => {
  const key = calendarQueryKey("all", "day", anchor)
  assert.equal(key[3], "2026-07-24")
  assert.equal(key[4], "2026-07-25")
})

test("month view key spans 42-day grid window", () => {
  const key = calendarQueryKey("all", "month", anchor)
  assert.equal(key[2], "month")
  assert.equal(key[3], "2026-06-28")
  assert.equal(key[4], "2026-08-09")
})

test("calendarQueryScopePrefix targets scope bucket", () => {
  assert.deepEqual(calendarQueryScopePrefix("workspace"), ["calendar", "workspace"])
})
