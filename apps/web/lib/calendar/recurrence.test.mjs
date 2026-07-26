import assert from "node:assert/strict"
import { test } from "node:test"
import {
  deriveRecurrenceBoundary,
  expandRecurrence,
  instantToLocalDateTime,
  localDateTimeToInstant,
  parseInstanceId,
  remapRecurrenceIdentitiesForSplit,
} from "./recurrence.ts"

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

function expand({
  master = event(),
  exceptions = [],
  windowStart = new Date("2026-03-08T00:00:00.000Z"),
  windowEnd = new Date("2026-03-17T23:59:59.999Z"),
} = {}) {
  return expandRecurrence({
    master,
    exceptions,
    windowStart,
    windowEnd,
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

test("treats RFC UNTIL as an inclusive cap in instant time", () => {
  const beforeOccurrence = expand({
    master: event({ rrule: "FREQ=WEEKLY;BYDAY=MO;UNTIL=20260309T150000Z" }),
  })
  const atOccurrence = expand({
    master: event({ rrule: "FREQ=WEEKLY;BYDAY=MO;UNTIL=20260309T160000Z" }),
  })

  assert.deepEqual(beforeOccurrence, [])
  assert.deepEqual(atOccurrence.map(({ starts_at }) => starts_at), [
    "2026-03-09T16:00:00.000Z",
  ])
})

test("excludes an occurrence exactly at the controller window end", () => {
  const instances = expand({
    windowEnd: new Date("2026-03-09T16:00:00.000Z"),
  })

  assert.deepEqual(instances, [])
})

test("treats recurrence_end as an exclusive series cutoff", () => {
  const instances = expand({
    master: event({ recurrence_end: "2026-03-09T16:00:00.000Z" }),
  })

  assert.deepEqual(instances, [])
})

test("fails closed when supplied exception rows are malformed", () => {
  const recurrenceId = "2026-03-09T16:00:00.000Z"
  const malformedExceptions = [
    event({
      id: "wrong-parent",
      parent_event_id: "another-master",
      recurrence_id: recurrenceId,
      is_exception: true,
    }),
    event({
      id: "missing-recurrence-id",
      parent_event_id: "master-1",
      recurrence_id: null,
      is_exception: true,
      is_cancelled: true,
    }),
    event({
      id: "not-an-exception",
      parent_event_id: "master-1",
      recurrence_id: recurrenceId,
      is_exception: false,
    }),
    event({
      id: "deleted-override",
      parent_event_id: "master-1",
      recurrence_id: recurrenceId,
      is_exception: true,
      deleted_at: "2026-03-08T00:00:00.000Z",
    }),
    event({
      id: "bad-start",
      parent_event_id: "master-1",
      recurrence_id: recurrenceId,
      is_exception: true,
      starts_at: "not-an-instant",
    }),
    event({
      id: "reversed-range",
      parent_event_id: "master-1",
      recurrence_id: recurrenceId,
      is_exception: true,
      starts_at: "2026-03-09T19:00:00.000Z",
      ends_at: "2026-03-09T18:00:00.000Z",
    }),
  ]

  for (const malformedException of malformedExceptions) {
    assert.deepEqual(expand({ exceptions: [malformedException] }), [])
  }
})

test("does not return an override moved outside the requested window", () => {
  const movedOutOverride = event({
    id: "moved-out",
    parent_event_id: "master-1",
    recurrence_id: "2026-03-09T16:00:00.000Z",
    is_exception: true,
    starts_at: "2026-03-18T18:00:00.000Z",
    ends_at: "2026-03-18T19:00:00.000Z",
  })

  const instances = expand({ exceptions: [movedOutOverride] })

  assert.deepEqual(instances.map(({ id }) => id), [
    "master-1::2026-03-16T16:00:00.000Z",
  ])
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

test("round-trips authored wall time through an IANA timezone", () => {
  const instant = localDateTimeToInstant(
    "2026-03-08T09:00:00",
    "America/Los_Angeles",
  )

  assert.equal(instant, "2026-03-08T16:00:00.000Z")
  assert.equal(
    instantToLocalDateTime(instant, "America/Los_Angeles"),
    "2026-03-08T09:00:00",
  )
  assert.equal(localDateTimeToInstant("bad", "America/Los_Angeles"), null)
  assert.equal(instantToLocalDateTime("bad", "America/Los_Angeles"), null)
})

test("derives an exclusive query boundary for COUNT and UNTIL rules", () => {
  assert.deepEqual(
    deriveRecurrenceBoundary({
      rrule: "FREQ=WEEKLY;BYDAY=MO;COUNT=3",
      startsAtLocal: "2026-03-02T09:00:00",
      timezone: "America/Los_Angeles",
    }),
    {
      valid: true,
      recurrenceEnd: "2026-03-16T16:00:00.001Z",
    },
  )
  assert.deepEqual(
    deriveRecurrenceBoundary({
      rrule: "FREQ=WEEKLY;BYDAY=MO;UNTIL=20260316T160000Z",
      startsAtLocal: "2026-03-02T09:00:00",
      timezone: "America/Los_Angeles",
    }),
    {
      valid: true,
      recurrenceEnd: "2026-03-16T16:00:00.001Z",
    },
  )
  assert.deepEqual(
    deriveRecurrenceBoundary({
      rrule: "FREQ=WEEKLY;BYDAY=MO",
      startsAtLocal: "2026-03-02T09:00:00",
      timezone: "America/Los_Angeles",
    }),
    { valid: true, recurrenceEnd: null },
  )
})

test("rejects finite recurrence rules that exceed the expansion safety cap", () => {
  assert.deepEqual(
    deriveRecurrenceBoundary({
      rrule: "FREQ=DAILY;COUNT=10001",
      startsAtLocal: "2026-03-02T09:00:00",
      timezone: "America/Los_Angeles",
    }),
    { valid: false, recurrenceEnd: null },
  )
})

test("rejects a custom rule that omits the event's authored start", () => {
  assert.deepEqual(
    deriveRecurrenceBoundary({
      rrule: "FREQ=WEEKLY;BYDAY=TU",
      startsAtLocal: "2026-03-02T09:00:00",
      timezone: "America/Los_Angeles",
    }),
    { valid: false, recurrenceEnd: null },
  )
})

test("remaps split exceptions by ordinal when the future frequency changes", () => {
  const result = remapRecurrenceIdentitiesForSplit({
    master: event(),
    splitRecurrenceId: "2026-03-09T16:00:00.000Z",
    newStartsAtLocal: "2026-03-09T10:00:00",
    newTimezone: "America/Los_Angeles",
    newRrule: "FREQ=MONTHLY;BYMONTHDAY=9",
    exceptionRecurrenceIds: [
      "2026-03-16T16:00:00.000Z",
      "2026-03-23T16:00:00.000Z",
    ],
  })

  assert.deepEqual(result, {
    exceptionRecurrenceIdMap: [
      {
        oldRecurrenceId: "2026-03-16T16:00:00.000Z",
        newRecurrenceId: "2026-04-09T17:00:00.000Z",
      },
      {
        oldRecurrenceId: "2026-03-23T16:00:00.000Z",
        newRecurrenceId: "2026-05-09T17:00:00.000Z",
      },
    ],
    recurrenceEnd: null,
  })
})

test("maps an explicit controller cutoff but replaces a native finite boundary", () => {
  const explicit = remapRecurrenceIdentitiesForSplit({
    master: event({ recurrence_end: "2026-03-23T16:00:00.000Z" }),
    splitRecurrenceId: "2026-03-09T16:00:00.000Z",
    newStartsAtLocal: "2026-03-09T10:00:00",
    newTimezone: "America/Los_Angeles",
    newRrule: "FREQ=WEEKLY;BYDAY=MO",
    exceptionRecurrenceIds: [],
  })
  assert.equal(explicit?.recurrenceEnd, "2026-03-23T17:00:00.000Z")

  const finite = remapRecurrenceIdentitiesForSplit({
    master: event({
      rrule: "FREQ=WEEKLY;BYDAY=MO;COUNT=3",
      recurrence_end: "2026-03-16T16:00:00.001+00:00",
    }),
    splitRecurrenceId: "2026-03-09T16:00:00.000Z",
    newStartsAtLocal: "2026-03-09T10:00:00",
    newTimezone: "America/Los_Angeles",
    newRrule: "FREQ=WEEKLY;BYDAY=MO;COUNT=2",
    exceptionRecurrenceIds: [],
  })
  assert.equal(finite?.recurrenceEnd, "2026-03-16T17:00:00.001Z")
})

test("keeps only the remaining occurrences when an unchanged COUNT series splits", () => {
  const result = remapRecurrenceIdentitiesForSplit({
    master: event({
      rrule: "FREQ=WEEKLY;BYDAY=MO;COUNT=3",
      recurrence_end: "2026-03-16T16:00:00.001Z",
    }),
    splitRecurrenceId: "2026-03-09T16:00:00.000Z",
    newStartsAtLocal: "2026-03-09T10:00:00",
    newTimezone: "America/Los_Angeles",
    newRrule: "FREQ=WEEKLY;BYDAY=MO;COUNT=3",
    exceptionRecurrenceIds: [],
  })

  assert.equal(result?.recurrenceEnd, "2026-03-16T17:00:00.001Z")
})

test("fails closed when a custom split rule does not include its new DTSTART", () => {
  assert.equal(
    remapRecurrenceIdentitiesForSplit({
      master: event(),
      splitRecurrenceId: "2026-03-09T16:00:00.000Z",
      newStartsAtLocal: "2026-03-09T10:00:00",
      newTimezone: "America/Los_Angeles",
      newRrule: "FREQ=WEEKLY;BYDAY=TU",
      exceptionRecurrenceIds: [],
    }),
    null,
  )
})
