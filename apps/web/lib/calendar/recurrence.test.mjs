import assert from "node:assert/strict"
import { test } from "node:test"
import { expandRecurrence, parseInstanceId } from "./recurrence.ts"

function event(overrides = {}) {
  return {
    id: "master-1",
    calendar_id: "calendar-1",
    user_id: "user-1",
    title: "Weekly planning",
    starts_at: "2026-03-02T17:00:00.000Z",
    ends_at: "2026-03-02T18:00:00.000Z",
    starts_at_local: "2026-03-02T09:00:00",
    ends_at_local: "2026-03-02T10:00:00",
    timezone: "America/Los_Angeles",
    duration_minutes: 60,
    rrule: "FREQ=WEEKLY;BYDAY=MO",
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

function expand({ master = event(), exceptions = [] } = {}) {
  return expandRecurrence({
    master,
    exceptions,
    windowStart: new Date("2026-03-08T00:00:00.000Z"),
    windowEnd: new Date("2026-03-17T23:59:59.999Z"),
  })
}

test("expands matching weekly occurrences inside a later window", () => {
  const instances = expand()

  assert.deepEqual(
    instances.map(({ id, starts_at, ends_at }) => ({ id, starts_at, ends_at })),
    [
      {
        id: "master-1::2026-03-09T16:00:00.000Z",
        starts_at: "2026-03-09T16:00:00.000Z",
        ends_at: "2026-03-09T17:00:00.000Z",
      },
      {
        id: "master-1::2026-03-16T16:00:00.000Z",
        starts_at: "2026-03-16T16:00:00.000Z",
        ends_at: "2026-03-16T17:00:00.000Z",
      },
    ],
  )
})

test("omits a cancelled exception without removing other occurrences", () => {
  const instances = expand({
    exceptions: [
      event({
        id: "cancelled-1",
        parent_event_id: "master-1",
        recurrence_id: "2026-03-09T16:00:00.000Z",
        is_exception: true,
        is_cancelled: true,
      }),
    ],
  })

  assert.deepEqual(instances.map(({ id }) => id), ["master-1::2026-03-16T16:00:00.000Z"])
})

test("replaces only the occurrence identified by a non-cancelled override", () => {
  const override = event({
    id: "override-1",
    title: "Moved planning",
    starts_at: "2026-03-09T18:00:00.000Z",
    ends_at: "2026-03-09T19:00:00.000Z",
    starts_at_local: "2026-03-09T11:00:00",
    ends_at_local: "2026-03-09T12:00:00",
    parent_event_id: "master-1",
    recurrence_id: "2026-03-09T16:00:00.000Z",
    is_exception: true,
  })

  const instances = expand({ exceptions: [override] })

  assert.deepEqual(
    instances.map(({ id, title }) => ({ id, title })),
    [
      { id: "override-1", title: "Moved planning" },
      { id: "master-1::2026-03-16T16:00:00.000Z", title: "Weekly planning" },
    ],
  )
})

test("keeps the authored duration when an occurrence crosses daylight saving time", () => {
  const master = event({
    starts_at: "2026-03-01T09:30:00.000Z",
    ends_at: "2026-03-01T11:30:00.000Z",
    starts_at_local: "2026-03-01T01:30:00",
    ends_at_local: "2026-03-01T03:30:00",
    duration_minutes: 120,
    rrule: "FREQ=WEEKLY;BYDAY=SU",
  })

  const instances = expand({ master })
  const dstInstance = instances.find(
    ({ starts_at }) => starts_at === "2026-03-08T09:30:00.000Z",
  )

  assert.ok(dstInstance)
  assert.equal(
    new Date(dstInstance.ends_at).getTime() - new Date(dstInstance.starts_at).getTime(),
    120 * 60_000,
  )
})

test("does not emit dtstart when it does not match the rule", () => {
  const instances = expand({
    master: event({ rrule: "FREQ=WEEKLY;BYDAY=WE" }),
  })

  assert.deepEqual(instances.map(({ starts_at }) => starts_at), ["2026-03-11T16:00:00.000Z"])
})

test("fails closed for malformed recurrence data and malformed instance ids", () => {
  assert.deepEqual(expand({ master: event({ timezone: "not/a-timezone" }) }), [])
  assert.deepEqual(expand({ master: event({ duration_minutes: null }) }), [])
  assert.deepEqual(expand({ master: event({ duration_minutes: 0 }) }), [])
  assert.deepEqual(expand({ master: event({ rrule: "FREQ=NOT_A_RULE" }) }), [])
  assert.equal(parseInstanceId("master-1"), null)
  assert.equal(parseInstanceId("master-1::"), null)
  assert.equal(parseInstanceId("master-1::2026-03-09T16:00:00.000Z::extra"), null)
})

test("round-trips a synthetic instance id without treating real ids as synthetic", () => {
  assert.deepEqual(parseInstanceId("master-1::2026-03-09T16:00:00.000Z"), {
    masterId: "master-1",
    recurrenceId: "2026-03-09T16:00:00.000Z",
  })
})
