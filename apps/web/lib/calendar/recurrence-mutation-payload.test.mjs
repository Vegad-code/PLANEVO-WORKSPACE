import assert from "node:assert/strict"
import { test } from "node:test"
import { recurrenceMutationPayload } from "./recurrence-mutation-payload.ts"

function event(overrides = {}) {
  return {
    id: "event-1",
    calendar_id: "calendar-1",
    user_id: "user-1",
    title: "Planning",
    starts_at: "2026-07-14T16:00:00.000Z",
    ends_at: "2026-07-14T17:00:00.000Z",
    starts_at_local: "2026-07-14T09:00:00",
    ends_at_local: "2026-07-14T10:00:00",
    timezone: "America/Los_Angeles",
    duration_minutes: 60,
    rrule: "FREQ=WEEKLY",
    recurrence_end: null,
    parent_event_id: null,
    recurrence_id: null,
    is_exception: false,
    is_cancelled: false,
    deleted_at: null,
    color: "teal",
    conference_url: null,
    all_day: false,
    location: "Studio",
    description_json: { text: "Bring notes" },
    task_id: null,
    google_event_id: null,
    external_connection_id: null,
    external_event_id: null,
    external_etag: null,
    external_updated_at: null,
    source: "planevo",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  }
}

test("recurring drag preserves authored fields and derives local times", () => {
  const payload = recurrenceMutationPayload({
    kind: "move",
    operation: "move",
    event: event(),
    startsAt: "2026-07-14T18:00:00.000Z",
    endsAt: "2026-07-14T19:30:00.000Z",
  })

  assert.equal(payload.calendarId, "calendar-1")
  assert.equal(payload.title, "Planning")
  assert.equal(payload.startsAtLocal, "2026-07-14T11:00:00")
  assert.equal(payload.endsAtLocal, "2026-07-14T12:30:00")
  assert.equal(payload.durationMinutes, 90)
  assert.equal(payload.description, "Bring notes")
  assert.equal(payload.color, "teal")
})

test("recurring panel save passes the validated payload through", () => {
  const payload = {
    calendarId: "calendar-2",
    title: "Edited",
    startsAt: "2026-07-15T16:00:00.000Z",
    endsAt: "2026-07-15T17:00:00.000Z",
    startsAtLocal: "2026-07-15T09:00:00",
    endsAtLocal: "2026-07-15T10:00:00",
    timezone: "America/Los_Angeles",
    durationMinutes: 60,
    rrule: "FREQ=WEEKLY",
    location: null,
    description: "",
    reminderOffsetMinutes: null,
    allDay: false,
    color: null,
  }

  assert.equal(
    recurrenceMutationPayload({
      kind: "save",
      event: event(),
      payload,
    }),
    payload,
  )
})
