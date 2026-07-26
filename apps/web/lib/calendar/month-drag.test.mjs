// Pinned so the daylight-saving cases below are deterministic on any machine.
process.env.TZ = "America/New_York"

import assert from "node:assert/strict"
import test from "node:test"
import {
  moveItemToDay,
  resizeBarEdge,
  resolveMonthDrag,
} from "./month-drag.ts"
import { eventToMonthItem, taskDueToMonthItem } from "./month-items.ts"

function eventItem({ start, end, allDay = false }) {
  return eventToMonthItem(
    {
      id: "event-1",
      calendar_id: "cal-1",
      user_id: "user-1",
      title: "Standup",
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      all_day: allDay,
      location: null,
      description_json: {},
      task_id: null,
      google_event_id: null,
      source: "planevo",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    "ocean",
  )
}

function taskItem(dueAt) {
  return taskDueToMonthItem({
    taskId: "task-1",
    title: "Ship it",
    dueAt: dueAt.toISOString(),
    status: "todo",
  })
}

test("keeps the time of day when moving an event across days", () => {
  // Arrange — 9:30am on July 14 2026.
  const item = eventItem({
    start: new Date(2026, 6, 14, 9, 30),
    end: new Date(2026, 6, 14, 10, 30),
  })

  // Act
  const result = moveItemToDay(item, "2026-07-14", "2026-07-17")

  // Assert
  assert.equal(result.kind, "event")
  const start = new Date(result.startsAt)
  const end = new Date(result.endsAt)
  assert.equal(start.getDate(), 17)
  assert.equal(start.getHours(), 9)
  assert.equal(start.getMinutes(), 30)
  assert.equal(end.getHours(), 10)
})

test("keeps the time of day when a move crosses spring-forward", () => {
  // Arrange — US daylight saving begins Sunday March 8 2026. Adding
  // 2 * 86_400_000 ms here would land at 10am instead of 9am.
  const item = eventItem({
    start: new Date(2026, 2, 7, 9, 0),
    end: new Date(2026, 2, 7, 10, 0),
  })

  // Act
  const result = moveItemToDay(item, "2026-03-07", "2026-03-09")

  // Assert
  const start = new Date(result.startsAt)
  assert.equal(start.getDate(), 9)
  assert.equal(start.getHours(), 9)
})

test("keeps the time of day when a move crosses fall-back", () => {
  // Arrange — US daylight saving ends Sunday November 1 2026.
  const item = eventItem({
    start: new Date(2026, 9, 31, 14, 0),
    end: new Date(2026, 9, 31, 15, 0),
  })

  // Act
  const result = moveItemToDay(item, "2026-10-31", "2026-11-02")

  // Assert
  const start = new Date(result.startsAt)
  assert.equal(start.getMonth(), 10)
  assert.equal(start.getDate(), 2)
  assert.equal(start.getHours(), 14)
})

test("preserves span length when moving a multi-day bar", () => {
  // Arrange — a three-day all-day bar, July 1 through midnight July 4.
  const item = eventItem({
    start: new Date(2026, 6, 1),
    end: new Date(2026, 6, 4),
    allDay: true,
  })

  // Act — grabbed on its second day and dropped four days later.
  const result = moveItemToDay(item, "2026-07-02", "2026-07-06")

  // Assert — shifted by four days, still three days long.
  const start = new Date(result.startsAt)
  const end = new Date(result.endsAt)
  assert.equal(start.getDate(), 5)
  assert.equal(end.getDate(), 8)
})

test("measures the move from the grabbed cell, not the bar's start", () => {
  // Arrange
  const item = eventItem({
    start: new Date(2026, 6, 1),
    end: new Date(2026, 6, 4),
    allDay: true,
  })

  // Act — grabbed on July 3, dropped on July 4: a one-day shift.
  const result = moveItemToDay(item, "2026-07-03", "2026-07-04")

  // Assert
  assert.equal(new Date(result.startsAt).getDate(), 2)
})

test("preserves due time when moving a task", () => {
  // Arrange
  const item = taskItem(new Date(2026, 6, 14, 17, 45))

  // Act
  const result = moveItemToDay(item, "2026-07-14", "2026-07-20")

  // Assert
  assert.equal(result.kind, "task")
  assert.equal(result.taskId, "task-1")
  const dueAt = new Date(result.dueAt)
  assert.equal(dueAt.getDate(), 20)
  assert.equal(dueAt.getHours(), 17)
  assert.equal(dueAt.getMinutes(), 45)
})

test("returns null when a move lands on the day it started from", () => {
  // Arrange
  const item = eventItem({
    start: new Date(2026, 6, 14, 9),
    end: new Date(2026, 6, 14, 10),
  })

  // Act / Assert
  assert.equal(moveItemToDay(item, "2026-07-14", "2026-07-14"), null)
})

test("extends a bar's start edge backwards", () => {
  // Arrange — July 10 through midnight July 13 (occupies 10, 11, 12).
  const item = eventItem({
    start: new Date(2026, 6, 10),
    end: new Date(2026, 6, 13),
    allDay: true,
  })

  // Act
  const result = resizeBarEdge(item, "start", "2026-07-08")

  // Assert — start moves, end is untouched.
  assert.equal(new Date(result.startsAt).getDate(), 8)
  assert.equal(new Date(result.endsAt).getDate(), 13)
})

test("clamps the start edge so it cannot pass the last occupied day", () => {
  // Arrange — occupies July 10, 11, 12.
  const item = eventItem({
    start: new Date(2026, 6, 10),
    end: new Date(2026, 6, 13),
    allDay: true,
  })

  // Act — dragged well past the end.
  const result = resizeBarEdge(item, "start", "2026-07-20")

  // Assert — collapses to a single day on July 12, never inverting.
  assert.equal(new Date(result.startsAt).getDate(), 12)
})

test("writes an exclusive end when extending the end edge", () => {
  // Arrange — occupies July 10, 11, 12 with an exclusive July 13 end.
  const item = eventItem({
    start: new Date(2026, 6, 10),
    end: new Date(2026, 6, 13),
    allDay: true,
  })

  // Act — the end handle is dropped on July 15, so July 15 is now occupied.
  const result = resizeBarEdge(item, "end", "2026-07-15")

  // Assert — the stored end is midnight on July 16, one day past the last day.
  const end = new Date(result.endsAt)
  assert.equal(end.getDate(), 16)
  assert.equal(end.getHours(), 0)
})

test("keeps the end time of day when resizing a timed multi-day event", () => {
  // Arrange — July 1 10:00 through July 3 15:00.
  const item = eventItem({
    start: new Date(2026, 6, 1, 10),
    end: new Date(2026, 6, 3, 15),
  })

  // Act
  const result = resizeBarEdge(item, "end", "2026-07-05")

  // Assert — two days later, still ending at 15:00.
  const end = new Date(result.endsAt)
  assert.equal(end.getDate(), 5)
  assert.equal(end.getHours(), 15)
})

test("clamps the end edge so it cannot pass the start day", () => {
  // Arrange — occupies July 10, 11, 12.
  const item = eventItem({
    start: new Date(2026, 6, 10),
    end: new Date(2026, 6, 13),
    allDay: true,
  })

  // Act — dragged back before the start.
  const result = resizeBarEdge(item, "end", "2026-07-05")

  // Assert — collapses to July 10 only, exclusive end on July 11.
  assert.equal(new Date(result.endsAt).getDate(), 11)
})

test("returns null when a resize does not move the edge", () => {
  // Arrange
  const item = eventItem({
    start: new Date(2026, 6, 10),
    end: new Date(2026, 6, 13),
    allDay: true,
  })

  // Act / Assert — July 12 is already the last occupied day.
  assert.equal(resizeBarEdge(item, "end", "2026-07-12"), null)
  assert.equal(resizeBarEdge(item, "start", "2026-07-10"), null)
})

test("routes a move drag to the day it was dropped on", () => {
  // Arrange
  const item = eventItem({
    start: new Date(2026, 6, 14, 9, 30),
    end: new Date(2026, 6, 14, 10, 30),
  })

  // Act
  const result = resolveMonthDrag(
    { type: "month-move", item, originDateKey: "2026-07-14" },
    { type: "month-day", dateKey: "2026-07-16" },
  )

  // Assert
  assert.equal(new Date(result.startsAt).getDate(), 16)
  assert.equal(new Date(result.startsAt).getHours(), 9)
})

test("routes a resize drag to the edge it was started from", () => {
  // Arrange — occupies July 10, 11, 12.
  const item = eventItem({
    start: new Date(2026, 6, 10),
    end: new Date(2026, 6, 13),
    allDay: true,
  })

  // Act
  const result = resolveMonthDrag(
    { type: "month-resize", item, edge: "end" },
    { type: "month-day", dateKey: "2026-07-14" },
  )

  // Assert — the start is untouched and the exclusive end moves to July 15.
  assert.equal(new Date(result.startsAt).getDate(), 10)
  assert.equal(new Date(result.endsAt).getDate(), 15)
})

test("returns null when a drag lands where it started", () => {
  // Arrange
  const item = eventItem({
    start: new Date(2026, 6, 14, 9),
    end: new Date(2026, 6, 14, 10),
  })

  // Act / Assert — the caller skips the mutation entirely.
  assert.equal(
    resolveMonthDrag(
      { type: "month-move", item, originDateKey: "2026-07-14" },
      { type: "month-day", dateKey: "2026-07-14" },
    ),
    null,
  )
})
