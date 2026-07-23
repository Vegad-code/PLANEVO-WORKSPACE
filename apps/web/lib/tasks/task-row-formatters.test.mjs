import assert from "node:assert/strict"
import { test } from "node:test"
import {
  buildTaskUpdatePayload,
  getRelativeDueLabel,
  getVisibleMetadata,
  toggleDoneStatus,
} from "./task-row-formatters.ts"

const baseTask = {
  id: "t1",
  user_id: "u1",
  title: "Ship list revamp",
  status: "not_started",
  priority: null,
  due_at: null,
  description_json: { text: "Notes", tags: ["Product"] },
  position: 1,
  completed_at: null,
  created_at: "2026-07-22T00:00:00.000Z",
  updated_at: "2026-07-22T00:00:00.000Z",
  subtaskTotal: 0,
  subtaskDone: 0,
  fileCount: 0,
  subtasks: [],
}

test("list grouped by status hides status and empty metadata", () => {
  assert.deepEqual(getVisibleMetadata(baseTask, { view: "list", grouping: "status" }), {
    showStatus: false,
    showPriority: false,
    showDue: false,
    showSubtasks: false,
    showFiles: false,
  })
})

test("list grouped by priority shows status when set fields exist", () => {
  const task = {
    ...baseTask,
    priority: "high",
    due_at: "2099-07-22T12:00:00.000Z",
    subtaskTotal: 2,
    subtaskDone: 1,
    fileCount: 3,
  }
  assert.deepEqual(getVisibleMetadata(task, { view: "list", grouping: "priority" }), {
    showStatus: true,
    showPriority: true,
    showDue: true,
    showSubtasks: true,
    showFiles: true,
  })
})

test("table always shows status column opportunity even without other meta", () => {
  assert.equal(
    getVisibleMetadata(baseTask, { view: "table" }).showStatus,
    true,
  )
})

test("relative due labels cover overdue today tomorrow and short date", () => {
  const now = new Date("2026-07-22T15:00:00.000Z")
  assert.equal(
    getRelativeDueLabel("2026-07-20T12:00:00.000Z", "not_started", now)?.label,
    "Overdue",
  )
  assert.equal(
    getRelativeDueLabel("2026-07-22T12:00:00.000Z", "not_started", now)?.label,
    "Today",
  )
  assert.equal(
    getRelativeDueLabel("2026-07-23T12:00:00.000Z", "not_started", now)?.label,
    "Tomorrow",
  )
  assert.equal(
    getRelativeDueLabel("2026-08-15T12:00:00.000Z", "not_started", now)?.kind,
    "date",
  )
  assert.equal(getRelativeDueLabel(null, "not_started", now), null)
})

test("toggleDoneStatus restores previous non-done or not_started", () => {
  assert.equal(toggleDoneStatus("not_started"), "done")
  assert.equal(toggleDoneStatus("done", "in_progress"), "in_progress")
  assert.equal(toggleDoneStatus("done", null), "not_started")
})

test("buildTaskUpdatePayload merges patch over current task", () => {
  const payload = buildTaskUpdatePayload(baseTask, {
    status: "done",
    priority: "high",
  })
  assert.equal(payload.taskId, "t1")
  assert.equal(payload.status, "done")
  assert.equal(payload.priority, "high")
  assert.equal(payload.description, "Notes")
  assert.deepEqual(payload.tags, ["Product"])
})
