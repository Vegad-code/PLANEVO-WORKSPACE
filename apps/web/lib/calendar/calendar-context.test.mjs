import assert from "node:assert/strict"
import { test } from "node:test"
import {
  calendarContextKey,
  calendarHref,
  calendarSupportsView,
  filterCalendarsForContext,
  parseCalendarContext,
} from "./calendar-context.ts"

const calendars = [
  { id: "main", is_main: true, is_included_in_main: true },
  { id: "work", is_main: false, is_included_in_main: true },
  { id: "school", is_main: false, is_included_in_main: false },
]

test("main context includes Main and calendars selected for the unified view", () => {
  assert.deepEqual(
    filterCalendarsForContext(calendars, { kind: "main" }).map(({ id }) => id),
    ["main", "work"],
  )
})

test("isolated context ignores Main inclusion preferences", () => {
  assert.deepEqual(
    filterCalendarsForContext(calendars, {
      kind: "calendar",
      calendarId: "school",
    }).map(({ id }) => id),
    ["school"],
  )
})

test("calendar context has stable cache and route identities", () => {
  assert.equal(calendarContextKey({ kind: "main" }), "main")
  assert.equal(
    calendarContextKey({ kind: "calendar", calendarId: "work" }),
    "calendar:work",
  )
  assert.equal(calendarHref({ kind: "main" }), "/calendar")
  assert.equal(
    calendarHref({ kind: "calendar", calendarId: "work" }),
    "/calendar/c/work",
  )
})

test("calendar route links preserve the active range and workspace filter", () => {
  assert.equal(
    calendarHref(
      { kind: "calendar", calendarId: "work" },
      {
        scope: "workspace",
        date: new Date(2026, 6, 24),
        view: "week",
      },
    ),
    "/calendar/c/work?scope=workspace&date=2026-07-24&view=week",
  )
})

test("calendar route links downgrade Main-only Year when isolating a calendar", () => {
  assert.equal(
    calendarHref(
      { kind: "calendar", calendarId: "work" },
      {
        scope: "all",
        date: new Date(2026, 6, 24),
        view: "year",
      },
    ),
    "/calendar/c/work?date=2026-07-24&view=month",
  )
})

test("only Main supports Year", () => {
  assert.equal(calendarSupportsView({ kind: "main" }, "year"), true)
  assert.equal(
    calendarSupportsView({ kind: "calendar", calendarId: "work" }, "year"),
    false,
  )
  assert.equal(
    calendarSupportsView({ kind: "calendar", calendarId: "work" }, "month"),
    true,
  )
})

test("route parsing never broadens a missing calendar id to Main", () => {
  assert.deepEqual(parseCalendarContext(), { kind: "main" })
  assert.deepEqual(parseCalendarContext("work"), {
    kind: "calendar",
    calendarId: "work",
  })
  assert.equal(parseCalendarContext(""), null)
})
