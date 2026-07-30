import assert from "node:assert/strict"
import { test } from "node:test"
import {
  RBC_EVENT_CLICK_MAX_DISTANCE_PX,
  capturePendingRbcEventSelect,
  consumePendingRbcEventSelect,
  resolveRbcEventPointerSelect,
} from "./rbc-event-pointer-select.ts"

test("keeps a press that stays within the drag threshold", () => {
  assert.equal(
    resolveRbcEventPointerSelect({
      pointerDown: { eventId: "event-1", clientX: 10, clientY: 20 },
      clientX: 10 + RBC_EVENT_CLICK_MAX_DISTANCE_PX,
      clientY: 20,
    }),
    "event-1",
  )
})

test("treats movement past the threshold as a drag, not a click", () => {
  assert.equal(
    resolveRbcEventPointerSelect({
      pointerDown: { eventId: "event-1", clientX: 10, clientY: 20 },
      clientX: 10 + RBC_EVENT_CLICK_MAX_DISTANCE_PX + 1,
      clientY: 20,
    }),
    null,
  )
})

test("returns null when there was no pointerdown on an event", () => {
  assert.equal(
    resolveRbcEventPointerSelect({
      pointerDown: null,
      clientX: 10,
      clientY: 20,
    }),
    null,
  )
})

test("regression: zero-distance press still selects after DnD remounts the node", () => {
  // Week/day RBC DnD remounts the event between mousedown and mouseup, so the
  // browser never emits click — pointerup at the same coordinates must still open.
  assert.equal(
    resolveRbcEventPointerSelect({
      pointerDown: { eventId: "event-1", clientX: 100, clientY: 200 },
      clientX: 100,
      clientY: 200,
    }),
    "event-1",
  )
})

test("regression: pending select survives a create-dismiss effect remount", () => {
  // Simulate the ref-held pending that must outlive useEffect teardown when
  // create popover closes on pointerdown and parent re-renders before pointerup.
  const pendingRef = {
    current: {
      eventId: "existing-event",
      clientX: 40,
      clientY: 80,
      anchor: null,
    },
  }
  // Teardown would previously `pending = null` on a closed-over let. Ref stays.
  const remountedPending = pendingRef.current
  const selected = consumePendingRbcEventSelect({
    pending: remountedPending,
    clientX: 40,
    clientY: 80,
  })
  assert.ok(selected)
  assert.equal(selected.eventId, "existing-event")
})

test("capturePendingRbcEventSelect returns null for non-event targets", () => {
  assert.equal(
    capturePendingRbcEventSelect({
      target: null,
      clientX: 0,
      clientY: 0,
    }),
    null,
  )
})

test("consumePendingRbcEventSelect returns null when pending was cleared", () => {
  assert.equal(
    consumePendingRbcEventSelect({
      pending: null,
      clientX: 10,
      clientY: 20,
    }),
    null,
  )
})
