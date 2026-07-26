import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const actions = readFileSync(
  new URL("../../app/(workspace)/calendar/actions.ts", import.meta.url),
  "utf8",
)
const view = readFileSync(
  new URL(
    "../../features/calendar-product/calendar-product-view.tsx",
    import.meta.url,
  ),
  "utf8",
)
const grid = readFileSync(
  new URL(
    "../../features/calendar-product/calendar-grid-engine.tsx",
    import.meta.url,
  ),
  "utf8",
)
const monthMutations = readFileSync(
  new URL(
    "../../features/calendar-product/use-month-mutations.ts",
    import.meta.url,
  ),
  "utf8",
)

test("shared calendar chrome offers Undo for delete, unschedule, move, and resize", () => {
  assert.match(view, /function offerUndo\(/)
  assert.match(view, /operation: "delete"/)
  assert.match(view, /operation: "unschedule"/)
  assert.match(view, /priorTimesUndo\(move\.event, move\.operation\)/)
  assert.match(view, /priorTimesUndo\(input\.event, input\.operation\)/)
  assert.match(view, /label: "Undo"/)
  assert.match(view, /operation: "recurrence-delete"/)
  assert.match(view, /"recurrence-resize" : "recurrence-move"/)
})

test("Undo restores soft-deleted events atomically and exact prior times", () => {
  assert.match(actions, /restoreCalendarEventUndo\(/)
  assert.match(view, /restoreCalendarEventAction\(\{ eventId: payload\.eventId \}\)/)
  assert.match(
    view,
    /restoreCalendarEventTimesAction\(\{[\s\S]*startsAt: payload\.startsAt,[\s\S]*endsAt: payload\.endsAt,[\s\S]*startsAtLocal: payload\.startsAtLocal,[\s\S]*durationMinutes: payload\.durationMinutes/,
  )
  assert.match(view, /restoreRecurringCalendarMutationAction\(/)
})

test("every renderer reports the committed interaction kind to shared chrome", () => {
  assert.match(grid, /onEventDrop=\{\(info\) => handleEventTimes\(info, "move"\)\}/)
  assert.match(
    grid,
    /onEventResize=\{\(info\) => handleEventTimes\(info, "resize"\)\}/,
  )
  assert.match(monthMutations, /onEventMoveCommitted\(move\)/)
})
