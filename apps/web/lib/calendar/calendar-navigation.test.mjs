import assert from "node:assert/strict"
import { test } from "node:test"
import {
  buildCalendarSearchParams,
  formatToolbarTitle,
  goToToday,
  parseCalendarSearchParams,
  startOfWeekSunday,
  stepAnchor,
  switchView,
} from "./calendar-navigation.ts"

const sunJul19 = new Date(2026, 6, 19)
const friJul24 = new Date(2026, 6, 24)

test("startOfWeekSunday returns Sunday for mid-week anchor", () => {
  const wed = new Date(2026, 6, 22)
  assert.equal(startOfWeekSunday(wed).getDate(), 19)
  assert.equal(startOfWeekSunday(wed).getDay(), 0)
})

test("week step moves anchor by 7 days", () => {
  const next = stepAnchor("week", sunJul19, 1)
  assert.equal(next.getDate(), 26)
  assert.equal(next.getMonth(), 6)
})

test("day step moves anchor by 1 day across month boundary", () => {
  const jul31 = new Date(2026, 6, 31)
  const next = stepAnchor("day", jul31, 1)
  assert.equal(next.getMonth(), 7)
  assert.equal(next.getDate(), 1)
})

test("year step moves anchor by 1 year", () => {
  const next = stepAnchor("year", friJul24, 1)
  assert.equal(next.getFullYear(), 2027)
  assert.equal(next.getMonth(), 6)
  assert.equal(next.getDate(), 24)
})

test("goToToday returns start of today", () => {
  const now = new Date(2026, 6, 24, 15, 30, 0)
  const today = goToToday(now)
  assert.equal(today.getHours(), 0)
  assert.equal(today.getDate(), 24)
})

test("switchView keeps the same calendar day", () => {
  const anchor = new Date(2026, 6, 22)
  assert.equal(switchView("week", anchor, "day").getDate(), 22)
  assert.equal(switchView("day", anchor, "week").getDate(), 22)
})

test("formatToolbarTitle week in one month", () => {
  const title = formatToolbarTitle(sunJul19, "week")
  assert.equal(title, "July 2026")
})

test("formatToolbarTitle week spanning months", () => {
  const anchor = new Date(2026, 5, 30)
  const title = formatToolbarTitle(anchor, "week")
  assert.equal(title, "Jun – Jul 2026")
})

test("formatToolbarTitle day includes year when not current year", () => {
  const anchor = new Date(2025, 6, 24)
  const now = new Date(2026, 6, 24)
  const title = formatToolbarTitle(anchor, "day", now)
  assert.match(title, /2025/)
})

test("formatToolbarTitle year", () => {
  assert.equal(formatToolbarTitle(friJul24, "year"), "2026")
})

test("month step moves anchor by 1 calendar month", () => {
  const anchor = new Date(2026, 6, 24)
  const next = stepAnchor("month", anchor, 1)
  assert.equal(next.getFullYear(), 2026)
  assert.equal(next.getMonth(), 7)
  assert.equal(next.getDate(), 24)
})

test("formatToolbarTitle month", () => {
  const title = formatToolbarTitle(friJul24, "month")
  assert.equal(title, "July 2026")
})

test("buildCalendarSearchParams encodes date and view", () => {
  const path = buildCalendarSearchParams({
    date: friJul24,
    view: "day",
  })
  assert.equal(path, "/calendar?date=2026-07-24&view=day")
})

test("buildCalendarSearchParams includes workspace scope", () => {
  const path = buildCalendarSearchParams({
    scope: "workspace",
    date: friJul24,
    view: "week",
  })
  assert.equal(path, "/calendar?scope=workspace&date=2026-07-24&view=week")
})

test("parseCalendarSearchParams round-trips date and view", () => {
  const parsed = parseCalendarSearchParams({
    date: "2026-07-24",
    view: "day",
  })
  assert.equal(parsed.view, "day")
  assert.equal(parsed.date.getFullYear(), 2026)
  assert.equal(parsed.date.getMonth(), 6)
  assert.equal(parsed.date.getDate(), 24)
})

test("parseCalendarSearchParams legacy week param", () => {
  const parsed = parseCalendarSearchParams({ week: "2026-W30" })
  assert.equal(parsed.view, "week")
  assert.ok(parsed.date instanceof Date)
  assert.equal(Number.isNaN(parsed.date.getTime()), false)
})

test("parseCalendarSearchParams defaults to today week view", () => {
  const parsed = parseCalendarSearchParams({})
  assert.equal(parsed.view, "week")
  assert.equal(parsed.date.getHours(), 0)
})
