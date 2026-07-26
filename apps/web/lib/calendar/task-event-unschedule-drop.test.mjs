import assert from "node:assert/strict"
import { test } from "node:test"
import {
  isPointOutsideRect,
  monthOffGridTaskEventId,
} from "./task-event-unschedule-drop.ts"

function eventDrag(linkedTask = { id: "task-1" }) {
  return {
    type: "month-move",
    originDateKey: "2026-07-25",
    item: {
      kind: "event",
      eventId: "event-1",
      linkedTask,
    },
  }
}

test("moving a task block off Month unschedules it", () => {
  assert.equal(monthOffGridTaskEventId(eventDrag(), undefined), "event-1")
})

test("ordinary events, resizes, and valid day drops never unschedule", () => {
  assert.equal(monthOffGridTaskEventId(eventDrag(null), undefined), null)
  assert.equal(
    monthOffGridTaskEventId(
      { type: "month-resize", item: eventDrag().item, edge: "end" },
      undefined,
    ),
    null,
  )
  assert.equal(
    monthOffGridTaskEventId(eventDrag(), {
      type: "month-day",
      dateKey: "2026-07-26",
    }),
    null,
  )
})

test("week and day release points must clear the grid bounds", () => {
  const rect = { left: 100, right: 900, top: 80, bottom: 700 }
  assert.equal(isPointOutsideRect({ clientX: 500, clientY: 200 }, rect), false)
  assert.equal(isPointOutsideRect({ clientX: 99, clientY: 200 }, rect), true)
  assert.equal(isPointOutsideRect({ clientX: 500, clientY: 701 }, rect), true)
})
