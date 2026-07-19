import assert from "node:assert/strict";
import { test } from "node:test";
import { activeTasks, groupTasksForList } from "./task-view-state.ts";

const tasks = [
  { id: "a", status: "not_started", priority: null, position: 2 },
  { id: "b", status: "cancelled", priority: "low", position: 1 },
  { id: "c", status: "done", priority: "high", position: 1 },
  { id: "d", status: "in_progress", priority: "medium", position: 1 },
];

test("active counts and Board exclude hidden cancelled tasks", () => {
  assert.deepEqual(activeTasks(tasks).map((task) => task.id), ["a", "c", "d"]);
});

test("List priority grouping is deterministic and keeps no-priority discoverable", () => {
  assert.deepEqual(
    groupTasksForList(tasks, "priority").map((group) => [group.key, group.tasks.map((task) => task.id)]),
    [["high", ["c"]], ["medium", ["d"]], ["low", ["b"]], ["none", ["a"]]],
  );
});

test("List status grouping includes the cancelled view", () => {
  const cancelled = groupTasksForList(tasks, "status").find((group) => group.key === "cancelled");
  assert.deepEqual(cancelled.tasks.map((task) => task.id), ["b"]);
});
