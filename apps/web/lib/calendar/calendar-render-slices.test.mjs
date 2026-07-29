import assert from "node:assert/strict"
import { test } from "node:test"
import * as calendarData from "./calendar-render-slices.ts"

test("keeps stable calendar chrome while a new range is loading", () => {
  assert.equal(
    typeof calendarData.calendarRenderSlices,
    "function",
    "calendar queries need independently renderable slices",
  )

  const slices = calendarData.calendarRenderSlices({
    range: undefined,
    meta: {
      context: { kind: "main" },
      scope: "all",
      workspaceId: null,
      calendars: [{ id: "main", name: "Main" }],
    },
    today: {
      context: { kind: "main" },
      scope: "all",
      todayTasks: [{ id: "task-1", title: "Plan", status: "not_started" }],
    },
  })

  assert.equal(slices.calendars[0].name, "Main")
  assert.equal(slices.todayTasks[0].title, "Plan")
  assert.deepEqual(slices.events, [])
  assert.deepEqual(slices.taskDues, [])
})

test("keeps range rows while slower secondary slices are loading", () => {
  const slices = calendarData.calendarRenderSlices({
    range: {
      context: { kind: "main" },
      scope: "all",
      anchorDate: "2026-07-29",
      view: "week",
      workspaceId: null,
      events: [{ id: "event-1", title: "Review" }],
      taskDues: [{ taskId: "task-1", title: "Plan" }],
    },
    meta: undefined,
    today: undefined,
  })

  assert.equal(slices.events[0].title, "Review")
  assert.equal(slices.taskDues[0].title, "Plan")
  assert.deepEqual(slices.calendars, [])
  assert.deepEqual(slices.todayTasks, [])
})
