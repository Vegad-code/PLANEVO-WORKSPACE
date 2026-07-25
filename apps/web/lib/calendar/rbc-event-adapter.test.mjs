import assert from "node:assert/strict"
import { test } from "node:test"
import {
  getMonthItemInteraction,
  getEventColor,
  getPlanevoEventId,
  isMonthRbcEvent,
  toMonthRbcEvents,
  toRbcEvents,
} from "./rbc-event-adapter.ts"
import { toMonthItems } from "./month-items.ts"
import { MONTH_GRID_BEHAVIOR } from "./month-grid-behavior.ts"

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

test("toRbcEvents filters hidden calendars and maps fields", () => {
  const mapped = toRbcEvents(events, calendars)
  assert.equal(mapped.length, 1)
  assert.equal(mapped[0].id, "evt-1")
  assert.equal(mapped[0].planevoEventId, "evt-1")
  assert.equal(mapped[0].color, "ocean")
  assert.equal(mapped[0].title, "Standup")
  assert.equal(mapped[0].start.toISOString(), "2026-07-15T15:00:00.000Z")
  assert.equal(mapped[0].end.toISOString(), "2026-07-15T15:30:00.000Z")
})

test("getPlanevoEventId and getEventColor read adapter fields", () => {
  const [event] = toRbcEvents(events, calendars)
  assert.equal(getPlanevoEventId(event), "evt-1")
  assert.equal(getEventColor(event), "ocean")
})

test("Month adapter includes task dues so overflow uses one event list", () => {
  const monthItems = toMonthItems(
    events,
    [
      {
        taskId: "task-1",
        title: "Send agenda",
        dueAt: "2026-07-15T14:00:00.000Z",
        status: "not_started",
      },
    ],
    calendars,
  )
  const monthEvents = toMonthRbcEvents(monthItems)

  assert.deepEqual(
    monthEvents.map((event) => event.id),
    ["task:task-1", "event:evt-1"],
  )
  assert.equal(monthEvents.every(isMonthRbcEvent), true)
  assert.equal(monthEvents[0].end.getDate(), monthEvents[0].start.getDate() + 1)
})

test("Month item interactions dispatch event selection and task completion", () => {
  const [eventItem, taskItem] = toMonthItems(
    events,
    [
      {
        taskId: "task-1",
        title: "Send agenda",
        dueAt: "2026-07-15T14:00:00.000Z",
        status: "not_started",
      },
    ],
    calendars,
  ).sort((left, right) => left.kind.localeCompare(right.kind))

  assert.deepEqual(getMonthItemInteraction(eventItem), {
    kind: "event",
    event: events[0],
  })
  assert.deepEqual(getMonthItemInteraction(taskItem), {
    kind: "task",
    taskId: "task-1",
    nextCompleted: true,
  })
})

test("Month preserves the custom agenda and disables drag, resize, and implicit drill-down", () => {
  assert.deepEqual(MONTH_GRID_BEHAVIOR, {
    popup: false,
    doShowMoreDrillDown: false,
    draggable: false,
    resizable: false,
  })
})
