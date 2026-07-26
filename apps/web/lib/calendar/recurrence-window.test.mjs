import assert from "node:assert/strict"
import { test } from "node:test"
import { materializeCalendarEvents } from "./recurrence-window.ts"

function event(overrides = {}) {
  return {
    id: "event-1",
    calendar_id: "calendar-1",
    user_id: "user-1",
    title: "Event",
    starts_at: "2026-03-10T12:00:00.000Z",
    ends_at: "2026-03-10T13:00:00.000Z",
    starts_at_local: null,
    ends_at_local: null,
    timezone: null,
    duration_minutes: null,
    rrule: null,
    recurrence_end: null,
    parent_event_id: null,
    recurrence_id: null,
    is_exception: false,
    is_cancelled: false,
    deleted_at: null,
    color: null,
    conference_url: null,
    all_day: false,
    location: null,
    description_json: {},
    task_id: null,
    google_event_id: null,
    source: "planevo",
    created_at: "2026-03-01T00:00:00.000Z",
    updated_at: "2026-03-01T00:00:00.000Z",
    ...overrides,
  }
}

function master(overrides = {}) {
  return event({
    id: "master-1",
    title: "Weekly planning",
    starts_at: "2026-03-02T17:00:00.000Z",
    ends_at: "2026-03-02T18:00:00.000Z",
    starts_at_local: "2026-03-02T09:00:00",
    ends_at_local: "2026-03-02T10:00:00",
    timezone: "America/Los_Angeles",
    duration_minutes: 60,
    rrule: "FREQ=WEEKLY;BYDAY=MO",
    ...overrides,
  })
}

const WINDOW = {
  windowStart: new Date("2026-03-08T00:00:00.000Z"),
  windowEnd: new Date("2026-03-18T00:00:00.000Z"),
}

test("merges standalone rows, expanded instances, and moved-in overrides once in time order", () => {
  const movedIn = event({
    id: "override-moved-in",
    title: "Moved planning",
    starts_at: "2026-03-12T15:00:00.000Z",
    ends_at: "2026-03-12T16:00:00.000Z",
    starts_at_local: "2026-03-12T08:00:00",
    ends_at_local: "2026-03-12T09:00:00",
    timezone: "America/Los_Angeles",
    duration_minutes: 60,
    parent_event_id: "master-1",
    recurrence_id: "2026-03-23T16:00:00.000Z",
    is_exception: true,
  })

  const rows = materializeCalendarEvents({
    standalone: [event({ id: "standalone" })],
    masters: [master()],
    exceptions: [movedIn],
    eventRange: "starts-in",
    ...WINDOW,
  })

  assert.deepEqual(
    rows.map(({ id }) => id),
    [
      "master-1::2026-03-09T16:00:00.000Z",
      "standalone",
      "override-moved-in",
      "master-1::2026-03-16T16:00:00.000Z",
    ],
  )
  assert.equal(rows.filter(({ id }) => id === "override-moved-in").length, 1)
  assert.equal(rows.some(({ id }) => id === "master-1"), false)
})

test("overlap mode looks back by series duration while starts-in mode does not", () => {
  const overnight = master({
    id: "overnight-master",
    starts_at: "2026-03-08T23:30:00.000Z",
    ends_at: "2026-03-09T01:30:00.000Z",
    starts_at_local: "2026-03-08T23:30:00",
    ends_at_local: "2026-03-09T01:30:00",
    timezone: "UTC",
    duration_minutes: 120,
    rrule: "FREQ=DAILY",
  })
  const input = {
    standalone: [],
    masters: [overnight],
    exceptions: [],
    windowStart: new Date("2026-03-09T00:00:00.000Z"),
    windowEnd: new Date("2026-03-09T12:00:00.000Z"),
  }

  const startsIn = materializeCalendarEvents({
    ...input,
    eventRange: "starts-in",
  })
  const overlaps = materializeCalendarEvents({
    ...input,
    eventRange: "overlaps",
  })

  assert.deepEqual(startsIn, [])
  assert.deepEqual(overlaps.map(({ starts_at }) => starts_at), [
    "2026-03-08T23:30:00.000Z",
  ])
})

test("filters deleted, cancelled, out-of-range, and malformed concrete rows", () => {
  const rows = materializeCalendarEvents({
    standalone: [
      event({ id: "live" }),
      event({ id: "deleted", deleted_at: "2026-03-09T00:00:00.000Z" }),
      event({ id: "cancelled", is_cancelled: true }),
      event({ id: "outside", starts_at: "2026-03-20T12:00:00.000Z" }),
      event({ id: "malformed", starts_at: "not-an-instant" }),
    ],
    masters: [],
    exceptions: [],
    eventRange: "starts-in",
    ...WINDOW,
  })

  assert.deepEqual(rows.map(({ id }) => id), ["live"])
})
