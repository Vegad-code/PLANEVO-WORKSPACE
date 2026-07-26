import assert from "node:assert/strict"
import test from "node:test"
import {
  patchEventTimes,
  patchTaskDueDate,
} from "./calendar-query-optimistic.ts"

function payload() {
  return {
    scope: "all",
    anchorDate: "2026-07-14",
    view: "month",
    workspaceId: null,
    calendars: [{ id: "cal-1", name: "Personal", color: "ocean" }],
    events: [
      { id: "event-1", title: "Standup", starts_at: "A", ends_at: "B" },
      { id: "event-2", title: "Review", starts_at: "C", ends_at: "D" },
    ],
    taskDues: [
      { taskId: "task-1", title: "Ship it", dueAt: "X", status: "todo" },
      { taskId: "task-2", title: "Write docs", dueAt: "Y", status: "todo" },
    ],
    todayTasks: [],
  }
}

test("patches only the targeted event's times", () => {
  // Arrange
  const before = payload()

  // Act
  const after = patchEventTimes(before, {
    eventId: "event-1",
    startsAt: "NEW-START",
    endsAt: "NEW-END",
  })

  // Assert
  assert.equal(after.events[0].starts_at, "NEW-START")
  assert.equal(after.events[0].endsAt, undefined)
  assert.equal(after.events[0].ends_at, "NEW-END")
  assert.equal(after.events[0].title, "Standup")
  assert.deepEqual(after.events[1], before.events[1])
})

test("leaves the original payload untouched when patching an event", () => {
  // Arrange
  const before = payload()

  // Act
  const after = patchEventTimes(before, {
    eventId: "event-1",
    startsAt: "NEW-START",
    endsAt: "NEW-END",
  })

  // Assert — new payload, new array, original values intact.
  assert.notEqual(after, before)
  assert.notEqual(after.events, before.events)
  assert.equal(before.events[0].starts_at, "A")
})

test("patches only the targeted task's due date", () => {
  // Arrange
  const before = payload()

  // Act
  const after = patchTaskDueDate(before, { taskId: "task-2", dueAt: "NEW-DUE" })

  // Assert
  assert.equal(after.taskDues[1].dueAt, "NEW-DUE")
  assert.equal(after.taskDues[1].title, "Write docs")
  assert.deepEqual(after.taskDues[0], before.taskDues[0])
  assert.equal(before.taskDues[1].dueAt, "Y")
})

test("returns the payload unchanged for an unknown event id", () => {
  // Arrange — models a write landing after the cache was already invalidated.
  const before = payload()

  // Act
  const after = patchEventTimes(before, {
    eventId: "missing",
    startsAt: "NEW-START",
    endsAt: "NEW-END",
  })

  // Assert
  assert.equal(after, before)
})

test("returns the payload unchanged for an unknown task id", () => {
  // Arrange
  const before = payload()

  // Act
  const after = patchTaskDueDate(before, { taskId: "missing", dueAt: "NEW" })

  // Assert
  assert.equal(after, before)
})
