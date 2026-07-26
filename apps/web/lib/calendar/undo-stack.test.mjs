import assert from "node:assert/strict"
import { test } from "node:test"
import {
  DEFAULT_CALENDAR_UNDO_TTL_MS,
  createUndoStack,
  expireUndo,
  popUndo,
  pushUndo,
} from "./undo-stack.ts"

function deletePayload(eventId = "event-1") {
  return {
    kind: "restore-event",
    operation: "delete",
    eventId,
    deletedAt: null,
  }
}

function movePayload(operation = "move") {
  return {
    kind: "restore-times",
    operation,
    eventId: "event-1",
    startsAt: "2026-07-26T16:00:00.000Z",
    endsAt: "2026-07-26T17:15:00.000Z",
    startsAtLocal: "2026-07-26T09:00:00",
    endsAtLocal: "2026-07-26T10:15:00",
    durationMinutes: 75,
    linkedTask: {
      taskId: "task-1",
      dueAt: "2026-07-26T16:00:00.000Z",
    },
  }
}

test("creates an eight-second undo window by default", () => {
  const stack = createUndoStack()
  assert.equal(stack.ttlMs, DEFAULT_CALENDAR_UNDO_TTL_MS)
  assert.deepEqual(stack.entries, [])
})

test("pushes and pops a restore payload without mutating prior stack state", () => {
  const empty = createUndoStack()
  const payload = deletePayload()
  const pushed = pushUndo({
    stack: empty,
    id: "delete-event-1",
    payload,
    now: 1_000,
  })

  assert.deepEqual(empty.entries, [])
  assert.equal(pushed.entries.length, 1)
  assert.deepEqual(pushed.entries[0], {
    id: "delete-event-1",
    recordedAt: 1_000,
    expiresAt: 9_000,
    payload,
  })

  const popped = popUndo({
    stack: pushed,
    id: "delete-event-1",
    now: 8_999,
  })
  assert.deepEqual(popped.entry?.payload, payload)
  assert.deepEqual(popped.stack.entries, [])
  assert.equal(pushed.entries.length, 1)
})

test("expires an undo exactly when its eight-second deadline is reached", () => {
  const pushed = pushUndo({
    stack: createUndoStack(),
    id: "delete-event-1",
    payload: deletePayload(),
    now: 500,
  })

  assert.equal(expireUndo({ stack: pushed, now: 8_499 }), pushed)
  const expired = expireUndo({ stack: pushed, now: 8_500 })
  assert.deepEqual(expired.entries, [])
  assert.equal(pushed.entries.length, 1)
})

test("restores the exact prior instant, local time, duration, and linked task due date", () => {
  const prior = movePayload()
  const pushed = pushUndo({
    stack: createUndoStack(),
    id: "move-event-1",
    payload: prior,
    now: 10,
  })

  // A caller mutating its source object cannot corrupt the saved restore point.
  prior.startsAt = "changed-after-push"
  prior.linkedTask.dueAt = null

  const popped = popUndo({
    stack: pushed,
    id: "move-event-1",
    now: 20,
  })
  assert.deepEqual(popped.entry?.payload, {
    kind: "restore-times",
    operation: "move",
    eventId: "event-1",
    startsAt: "2026-07-26T16:00:00.000Z",
    endsAt: "2026-07-26T17:15:00.000Z",
    startsAtLocal: "2026-07-26T09:00:00",
    endsAtLocal: "2026-07-26T10:15:00",
    durationMinutes: 75,
    linkedTask: {
      taskId: "task-1",
      dueAt: "2026-07-26T16:00:00.000Z",
    },
  })
})

test("keeps resize and unschedule restoration data discriminated", () => {
  const resize = movePayload("resize")
  const unschedule = {
    kind: "restore-event",
    operation: "unschedule",
    eventId: "event-2",
    deletedAt: null,
    linkedTask: {
      taskId: "task-2",
      dueAt: "2026-07-27T18:30:00.000Z",
    },
  }
  let stack = createUndoStack()
  stack = pushUndo({ stack, id: "resize", payload: resize, now: 100 })
  stack = pushUndo({ stack, id: "unschedule", payload: unschedule, now: 200 })

  assert.deepEqual(
    popUndo({ stack, id: "resize", now: 300 }).entry?.payload,
    resize,
  )
  assert.deepEqual(
    popUndo({ stack, id: "unschedule", now: 300 }).entry?.payload,
    unschedule,
  )
})

test("keeps a recurring family snapshot isolated from later cache mutation", () => {
  const eventRows = [
    {
      id: "master-1",
      title: "Before",
      description_json: { text: "Original" },
    },
  ]
  const pushed = pushUndo({
    stack: createUndoStack(),
    id: "recurrence-move",
    payload: {
      kind: "restore-series",
      operation: "recurrence-move",
      masterEventId: "master-1",
      guardEventId: "new-master-1",
      newMasterEventId: "new-master-1",
      eventRows,
    },
    now: 100,
  })

  eventRows[0].title = "Mutated"
  eventRows[0].description_json.text = "Changed"

  const payload = popUndo({
    stack: pushed,
    id: "recurrence-move",
    now: 200,
  }).entry?.payload
  assert.equal(payload.kind, "restore-series")
  assert.equal(payload.eventRows[0].title, "Before")
  assert.deepEqual(payload.eventRows[0].description_json, { text: "Original" })
})

test("an expired, unknown, or invalid pop fails closed without returning a restore", () => {
  const pushed = pushUndo({
    stack: createUndoStack(),
    id: "delete-event-1",
    payload: deletePayload(),
    now: 0,
  })

  const unknown = popUndo({ stack: pushed, id: "missing", now: 1 })
  assert.equal(unknown.entry, null)
  assert.equal(unknown.stack, pushed)

  const expired = popUndo({
    stack: pushed,
    id: "delete-event-1",
    now: DEFAULT_CALENDAR_UNDO_TTL_MS,
  })
  assert.equal(expired.entry, null)
  assert.deepEqual(expired.stack.entries, [])

  const invalid = popUndo({
    stack: pushed,
    id: "delete-event-1",
    now: Number.NaN,
  })
  assert.equal(invalid.entry, null)
  assert.equal(invalid.stack, pushed)
})

test("invalid pushes are no-ops and duplicate ids replace stale restore points", () => {
  const empty = createUndoStack()
  assert.equal(
    pushUndo({
      stack: empty,
      id: " ",
      payload: deletePayload(),
      now: 1,
    }),
    empty,
  )
  assert.equal(
    pushUndo({
      stack: empty,
      id: "delete-event-1",
      payload: deletePayload(),
      now: Number.POSITIVE_INFINITY,
    }),
    empty,
  )

  const first = pushUndo({
    stack: empty,
    id: "same-toast",
    payload: deletePayload("event-1"),
    now: 1,
  })
  const replaced = pushUndo({
    stack: first,
    id: "same-toast",
    payload: deletePayload("event-2"),
    now: 2,
  })
  assert.equal(replaced.entries.length, 1)
  assert.equal(replaced.entries[0]?.payload.eventId, "event-2")
})

test("invalid custom time-to-live falls back to the safe default", () => {
  assert.equal(createUndoStack({ ttlMs: 0 }).ttlMs, 8_000)
  assert.equal(createUndoStack({ ttlMs: Number.NaN }).ttlMs, 8_000)
  assert.equal(createUndoStack({ ttlMs: 250 }).ttlMs, 250)
})
