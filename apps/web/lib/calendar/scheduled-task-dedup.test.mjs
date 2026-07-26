import assert from "node:assert/strict"
import test from "node:test"
import {
  filterTaskDuesWithoutScheduledBlocks,
  scheduledTaskIdsFromEvents,
} from "./scheduled-task-dedup.ts"

test("collects scheduled task ids from linked events", () => {
  const ids = scheduledTaskIdsFromEvents([
    { task_id: "task-1" },
    { task_id: null },
    { task_id: "task-2" },
  ])
  assert.deepEqual([...ids].sort(), ["task-1", "task-2"])
})

test("drops due chips when a live scheduled block exists", () => {
  const taskDues = [
    { taskId: "task-1", title: "Ship", dueAt: "A", status: "not_started" },
    { taskId: "task-2", title: "Docs", dueAt: "B", status: "not_started" },
  ]
  const filtered = filterTaskDuesWithoutScheduledBlocks(taskDues, [
    { task_id: "task-1" },
  ])
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0]?.taskId, "task-2")
})
