import assert from "node:assert/strict"
import { test } from "node:test"
import {
  getEventColor,
  getPlanevoEventId,
  toFullCalendarEvents,
} from "./calendar-event-adapter.ts"

const calendars = [
  {
    id: "cal-1",
    user_id: "u1",
    name: "Work",
    color: "ocean",
    is_visible: true,
    position: 0,
    created_at: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "cal-2",
    user_id: "u1",
    name: "Hidden",
    color: "brick",
    is_visible: false,
    position: 1,
    created_at: "2026-07-01T00:00:00.000Z",
  },
]

const events = [
  {
    id: "evt-1",
    calendar_id: "cal-1",
    user_id: "u1",
    title: "Standup",
    starts_at: "2026-07-15T15:00:00.000Z",
    ends_at: "2026-07-15T15:30:00.000Z",
    all_day: false,
    location: null,
    description_json: {},
    task_id: null,
    google_event_id: null,
    source: "planevo",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "evt-2",
    calendar_id: "cal-2",
    user_id: "u1",
    title: "Hidden event",
    starts_at: "2026-07-15T16:00:00.000Z",
    ends_at: "2026-07-15T17:00:00.000Z",
    all_day: false,
    location: null,
    description_json: {},
    task_id: null,
    google_event_id: null,
    source: "planevo",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  },
]

test("toFullCalendarEvents filters hidden calendars and maps fields", () => {
  const mapped = toFullCalendarEvents(events, calendars)
  assert.equal(mapped.length, 1)
  assert.equal(mapped[0].id, "evt-1")
  assert.equal(mapped[0].title, "Standup")
  assert.equal(mapped[0].start, "2026-07-15T15:00:00.000Z")
  assert.equal(mapped[0].end, "2026-07-15T15:30:00.000Z")
  assert.equal(mapped[0].allDay, false)
  assert.equal(mapped[0].extendedProps.color, "ocean")
  assert.equal(mapped[0].extendedProps.planevoEventId, "evt-1")
})

test("getPlanevoEventId prefers extendedProps", () => {
  assert.equal(
    getPlanevoEventId({
      id: "fc-temp",
      extendedProps: { planevoEventId: "evt-1" },
    }),
    "evt-1",
  )
  assert.equal(getPlanevoEventId({ id: "evt-1" }), "evt-1")
})

test("getEventColor falls back to slate", () => {
  assert.equal(getEventColor({ extendedProps: { color: "meadow" } }), "meadow")
  assert.equal(getEventColor({ extendedProps: {} }), "slate")
})
