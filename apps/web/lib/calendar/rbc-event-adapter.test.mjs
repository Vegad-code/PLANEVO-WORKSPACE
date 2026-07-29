import assert from "node:assert/strict"
import { test } from "node:test"
import {
  getEventColor,
  getPlanevoEventId,
  toRbcEvents,
} from "./rbc-event-adapter.ts"

const calendars = [
  {
    id: "cal-1",
    user_id: "u1",
    name: "Work",
    color: "blueberry",
    is_included_in_main: true,
    position: 0,
    created_at: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "cal-2",
    user_id: "u1",
    name: "Hidden",
    color: "tomato",
    is_included_in_main: false,
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

test("toRbcEvents maps the events supplied by the context query", () => {
  const mapped = toRbcEvents(events, calendars)
  assert.equal(mapped.length, 2)
  assert.equal(mapped[0].id, "evt-1")
  assert.equal(mapped[0].planevoEventId, "evt-1")
  assert.equal(mapped[0].color, "blueberry")
  assert.equal(mapped[0].title, "Standup")
  assert.equal(mapped[0].start.toISOString(), "2026-07-15T15:00:00.000Z")
  assert.equal(mapped[0].end.toISOString(), "2026-07-15T15:30:00.000Z")
})

test("getPlanevoEventId and getEventColor read adapter fields", () => {
  const [event] = toRbcEvents(events, calendars)
  assert.equal(getPlanevoEventId(event), "evt-1")
  assert.equal(getEventColor(event), "blueberry")
})

test("marks every connected provider as read-only", () => {
  const [event] = toRbcEvents(
    [{ ...events[0], source: "ics" }],
    calendars,
  )
  assert.equal(event.isReadOnly, true)
  assert.equal(event.source, "ics")
})

test("task blocks use the task's current title and completion state", () => {
  const [event] = toRbcEvents(
    [
      {
        ...events[0],
        task_id: "task-1",
        linked_task: {
          id: "task-1",
          title: "Current task title",
          status: "done",
          estimateMinutes: 30,
        },
      },
    ],
    calendars,
  )

  assert.equal(event.title, "Current task title")
  assert.equal(event.isTaskComplete, true)
})
