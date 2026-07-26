import assert from "node:assert/strict"
import { test } from "node:test"
import {
  decorateTaskLinkedEvents,
  isLinkedTaskComplete,
  taskEstimateMinutes,
  toCalendarLinkedTask,
} from "./task-linked-events.ts"

function event(overrides = {}) {
  return {
    id: "event-1",
    task_id: null,
    ...overrides,
  }
}

test("reads only a positive integer task estimate", () => {
  assert.equal(taskEstimateMinutes({ estimateMinutes: 45 }), 45)
  assert.equal(taskEstimateMinutes({ estimateMinutes: 0 }), null)
  assert.equal(taskEstimateMinutes({ estimateMinutes: 12.5 }), null)
  assert.equal(taskEstimateMinutes({ estimateMinutes: 10_081 }), null)
  assert.equal(taskEstimateMinutes({ estimateMinutes: "45" }), null)
})

test("decorates a task block with current task state without mutating the event", () => {
  const source = event({ task_id: "task-1" })
  const task = toCalendarLinkedTask({
    id: "task-1",
    title: "Ship report",
    status: "done",
    description_json: { estimateMinutes: 90 },
  })

  const [decorated] = decorateTaskLinkedEvents({
    events: [source],
    tasks: [task],
  })

  assert.equal(decorated.linked_task?.status, "done")
  assert.equal(decorated.linked_task?.estimateMinutes, 90)
  assert.equal("linked_task" in source, false)
})

test("fails closed when a linked task is missing and marks terminal statuses done", () => {
  const [missing] = decorateTaskLinkedEvents({
    events: [event({ task_id: "missing-task" })],
    tasks: [],
  })

  assert.equal(missing.linked_task, null)
  assert.equal(isLinkedTaskComplete(null), false)
  assert.equal(
    isLinkedTaskComplete({
      id: "task-1",
      title: "Task",
      status: "cancelled",
      estimateMinutes: null,
    }),
    true,
  )
})
