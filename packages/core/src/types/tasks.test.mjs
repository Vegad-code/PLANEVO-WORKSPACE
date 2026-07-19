import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  taskStatusLabel,
} from "./tasks.ts";

test("taskStatusLabel maps db enum to UI label", () => {
  assert.deepEqual(TASK_STATUSES, [
    "not_started",
    "in_progress",
    "in_review",
    "done",
    "cancelled",
  ]);
  assert.equal(taskStatusLabel("not_started"), "To do");
  assert.equal(taskStatusLabel("in_progress"), "In progress");
  assert.equal(taskStatusLabel("in_review"), "In review");
  assert.equal(taskStatusLabel("done"), "Done");
});
