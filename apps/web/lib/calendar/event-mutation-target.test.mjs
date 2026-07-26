import assert from "node:assert/strict"
import { test } from "node:test"
import { resolveEventMutationTarget } from "./event-mutation-target.ts"

function event(overrides = {}) {
  return {
    id: "event-1",
    parent_event_id: null,
    recurrence_id: null,
    rrule: null,
    ...overrides,
  }
}

test("resolves a standalone event without changing its persisted id", () => {
  assert.deepEqual(resolveEventMutationTarget(event()), {
    kind: "standalone",
    eventId: "event-1",
  })
})

test("resolves a persisted series master", () => {
  assert.deepEqual(
    resolveEventMutationTarget(event({ id: "master-1", rrule: "FREQ=DAILY" })),
    { kind: "series-master", masterId: "master-1" },
  )
})

test("resolves a synthetic occurrence to its master and recurrence identity", () => {
  assert.deepEqual(
    resolveEventMutationTarget(
      event({
        id: "master-1::2026-07-14T09:00:00.000Z",
        rrule: "FREQ=WEEKLY;BYDAY=TU",
        recurrence_id: "2026-07-14T09:00:00.000Z",
      }),
    ),
    {
      kind: "series-instance",
      masterId: "master-1",
      recurrenceId: "2026-07-14T09:00:00.000Z",
      exceptionId: null,
    },
  )
})

test("resolves a persisted override to its master instead of its row id", () => {
  assert.deepEqual(
    resolveEventMutationTarget(
      event({
        id: "exception-1",
        parent_event_id: "master-1",
        recurrence_id: "2026-07-14T09:00:00.000Z",
      }),
    ),
    {
      kind: "series-instance",
      masterId: "master-1",
      recurrenceId: "2026-07-14T09:00:00.000Z",
      exceptionId: "exception-1",
    },
  )
})

test("fails closed for a malformed synthetic id", () => {
  assert.equal(
    resolveEventMutationTarget(
      event({ id: "master-1::not-a-date", recurrence_id: "not-a-date" }),
    ),
    null,
  )
})

test("fails closed when recurrence_id is set without a parent event", () => {
  assert.equal(
    resolveEventMutationTarget(
      event({ recurrence_id: "2026-07-14T09:00:00.000Z" }),
    ),
    null,
  )
})

test("fails closed when a synthetic id disagrees with recurrence_id", () => {
  assert.equal(
    resolveEventMutationTarget(
      event({
        id: "master-1::2026-07-14T09:00:00.000Z",
        recurrence_id: "2026-07-15T09:00:00.000Z",
      }),
    ),
    null,
  )
})
