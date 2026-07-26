import assert from "node:assert/strict"
import { test } from "node:test"
import {
  RBC_EVENT_CLICK_MAX_DISTANCE_PX,
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
