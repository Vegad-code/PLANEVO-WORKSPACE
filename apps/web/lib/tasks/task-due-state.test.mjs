import assert from "node:assert/strict";
import { test } from "node:test";
import { taskDueState } from "./task-due-state.ts";

test("a task stays due through the end of its local due day", () => {
  const now = new Date(2026, 6, 18, 23, 59, 59);
  assert.equal(taskDueState("2026-07-18T12:00:00.000Z", "in_progress", now).kind, "due");
});

test("a task becomes overdue on the next local calendar day", () => {
  const now = new Date(2026, 6, 19, 0, 0, 0);
  assert.equal(taskDueState("2026-07-18T12:00:00.000Z", "in_progress", now).kind, "overdue");
});

test("done, cancelled, missing, and malformed dates are never overdue", () => {
  const now = new Date(2026, 6, 20);
  assert.equal(taskDueState("2026-07-18T12:00:00.000Z", "done", now).kind, "due");
  assert.equal(taskDueState("2026-07-18T12:00:00.000Z", "cancelled", now).kind, "due");
  assert.equal(taskDueState(null, "in_progress", now), null);
  assert.equal(taskDueState("bad", "in_progress", now), null);
});
