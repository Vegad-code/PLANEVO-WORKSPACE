import assert from "node:assert/strict";
import { test } from "node:test";
import { taskBoardAnnouncement } from "./task-board-a11y.ts";

const tasks = [
  { id: "uuid-one", title: "Write launch note", status: "not_started", position: 1 },
  { id: "uuid-two", title: "Review launch note", status: "in_review", position: 1 },
];

test("drag announcements name the task, lane, and human position without UUIDs", () => {
  const message = taskBoardAnnouncement(tasks, "over", "uuid-one", "in_review", "uuid-two");
  assert.match(message, /Write launch note/);
  assert.match(message, /In review/);
  assert.match(message, /position 1 of 2/);
  assert.doesNotMatch(message, /uuid/);
});

test("cancel announcement names the task and never exposes its id", () => {
  const message = taskBoardAnnouncement(tasks, "cancel", "uuid-one", null, null);
  assert.match(message, /Write launch note/);
  assert.doesNotMatch(message, /uuid-one/);
});
