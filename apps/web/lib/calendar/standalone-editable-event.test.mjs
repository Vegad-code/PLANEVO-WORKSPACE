import assert from "node:assert/strict"
import test from "node:test"
import {
  assertStandaloneEditableEvent,
  StandaloneEditableEventError,
} from "./standalone-editable-event.ts"

function event(overrides = {}) {
  return {
    id: "event-1",
    task_id: null,
    starts_at: "2026-07-14T09:00:00.000Z",
    ends_at: "2026-07-14T10:00:00.000Z",
    timezone: "UTC",
    source: "planevo",
    rrule: null,
    parent_event_id: null,
    ...overrides,
  }
}

test("allows standalone Planevo events", () => {
  assert.doesNotThrow(() => assertStandaloneEditableEvent(event()))
})

test("rejects series masters", () => {
  assert.throws(
    () => assertStandaloneEditableEvent(event({ rrule: "FREQ=DAILY" })),
    StandaloneEditableEventError,
  )
})

test("rejects recurrence exceptions", () => {
  assert.throws(
    () =>
      assertStandaloneEditableEvent(
        event({ parent_event_id: "master-1", rrule: null }),
      ),
    StandaloneEditableEventError,
  )
})
