import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const actionsSource = readFileSync(
  new URL("../../app/(workspace)/calendar/actions.ts", import.meta.url),
  "utf8",
)

function actionSource(name) {
  const start = actionsSource.indexOf(`export async function ${name}`)
  assert.notEqual(start, -1, `${name} must be exported from calendar actions`)
  const next = actionsSource.indexOf("\nexport async function ", start + 1)
  return actionsSource.slice(start, next === -1 ? undefined : next)
}

test("updateCalendarEventAction guards standalone editable events", () => {
  const source = actionSource("updateCalendarEventAction")
  assert.match(source, /requireStandaloneEditableEvent\(/)
  assert.match(source, /StandaloneEditableEventError/)
})

test("updateEventTimesAction guards standalone editable events", () => {
  const source = actionSource("updateEventTimesAction")
  assert.match(source, /requireStandaloneEditableEvent\(/)
  assert.match(source, /StandaloneEditableEventError/)
})

test("restoreCalendarEventTimesAction guards standalone editable events", () => {
  const source = actionSource("restoreCalendarEventTimesAction")
  assert.match(source, /requireStandaloneEditableEvent\(/)
  assert.match(source, /StandaloneEditableEventError/)
})

test("updateTaskDueDateAction syncs linked blocks through the RPC", () => {
  const source = actionSource("updateTaskDueDateAction")
  assert.match(source, /update_task_due_with_linked_event/)
  assert.match(source, /p_move_linked_block/)
})
