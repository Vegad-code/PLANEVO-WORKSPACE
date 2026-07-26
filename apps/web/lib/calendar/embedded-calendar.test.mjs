import assert from "node:assert/strict"
import test from "node:test"
import { embeddedCalendarRequest } from "./embedded-calendar.ts"

const now = new Date(2026, 6, 26, 15, 30)

function view(overrides = {}) {
  return {
    id: "view-1",
    user_id: "user-1",
    name: "Embedded",
    preset: "classic",
    config: {},
    source_calendar_ids: [],
    include_task_dues: true,
    is_default: false,
    position: 0,
    created_at: "",
    updated_at: "",
    ...overrides,
  }
}

test("an embedded Flow lens requests exactly one shared-renderer day", () => {
  assert.deepEqual(
    embeddedCalendarRequest(view({ preset: "flow" }), now),
    { date: "2026-07-26", view: "day" },
  )
})

test("saved day-count overrides drive the same month and week request path", () => {
  assert.equal(
    embeddedCalendarRequest(
      view({ config: { dayCount: "month" } }),
      now,
    ).view,
    "month",
  )
  assert.equal(
    embeddedCalendarRequest(view({ config: { dayCount: 3 } }), now).view,
    "week",
  )
})

test("malformed saved config degrades to the built-in Classic request", () => {
  assert.deepEqual(
    embeddedCalendarRequest(
      view({ preset: "unknown", config: { dayCount: "garbage" } }),
      now,
    ),
    { date: "2026-07-26", view: "week" },
  )
})
