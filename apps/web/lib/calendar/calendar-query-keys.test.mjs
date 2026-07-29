import assert from "node:assert/strict"
import { test } from "node:test"
import {
  calendarMetaQueryKey,
  calendarMetaScopePrefix,
  calendarQueryKey,
  calendarQueryScopePrefix,
} from "./calendar-query-keys.ts"

const anchor = new Date(2026, 6, 24)

test("calendarQueryKey is stable for same anchor and view", () => {
  const a = calendarQueryKey("all", { kind: "main" }, "week", anchor)
  const b = calendarQueryKey(
    "all",
    { kind: "main" },
    "week",
    new Date(2026, 6, 24),
  )
  assert.deepEqual(a, b)
})

test("calendarQueryKey differs for adjacent weeks", () => {
  const current = calendarQueryKey("all", { kind: "main" }, "week", anchor)
  const next = calendarQueryKey(
    "all",
    { kind: "main" },
    "week",
    new Date(2026, 6, 31),
  )
  assert.notDeepEqual(current, next)
})

test("calendarQueryKey differs by scope", () => {
  const all = calendarQueryKey("all", { kind: "main" }, "week", anchor)
  const workspace = calendarQueryKey(
    "workspace",
    { kind: "main" },
    "week",
    anchor,
  )
  assert.notDeepEqual(all, workspace)
})

test("calendarQueryKey differs between Main and an isolated calendar", () => {
  const main = calendarQueryKey(
    "all",
    { kind: "main" },
    "week",
    anchor,
  )
  const work = calendarQueryKey(
    "all",
    { kind: "calendar", calendarId: "work" },
    "week",
    anchor,
  )
  assert.notDeepEqual(main, work)
})

test("year view key spans full calendar year range", () => {
  const key = calendarQueryKey("all", { kind: "main" }, "year", anchor)
  assert.equal(key[4], "2026-01-01")
  assert.equal(key[5], "2027-01-01")
})

test("day view key is single-day window", () => {
  const key = calendarQueryKey("all", { kind: "main" }, "day", anchor)
  assert.equal(key[4], "2026-07-24")
  assert.equal(key[5], "2026-07-25")
})

test("month view key spans 42-day grid window", () => {
  const key = calendarQueryKey("all", { kind: "main" }, "month", anchor)
  assert.equal(key[3], "month")
  assert.equal(key[4], "2026-06-28")
  assert.equal(key[5], "2026-08-09")
})

test("calendarQueryScopePrefix targets scope bucket", () => {
  assert.deepEqual(calendarQueryScopePrefix("workspace"), ["calendar", "workspace"])
})

test("calendar metadata has one user-global cache identity", () => {
  assert.deepEqual(
    calendarMetaQueryKey("all", { kind: "main" }),
    calendarMetaQueryKey("workspace", {
      kind: "calendar",
      calendarId: "work",
    }),
  )
  assert.deepEqual(calendarMetaScopePrefix("workspace"), ["calendar-meta"])
})
