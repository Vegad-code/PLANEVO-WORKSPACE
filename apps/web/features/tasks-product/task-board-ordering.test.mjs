import assert from "node:assert/strict";
import test from "node:test";
import { resolveTaskBoardDrop } from "./task-board-ordering.ts";

const SAME_COLUMN_TASKS = [
  { id: "a", status: "not_started", position: 1 },
  { id: "b", status: "not_started", position: 2 },
  { id: "c", status: "not_started", position: 3 },
];

test("keyboard down inserts the active task after its same-column target", () => {
  assert.deepEqual(
    resolveTaskBoardDrop({
      tasks: SAME_COLUMN_TASKS,
      activeId: "a",
      overId: "b",
      overStatus: "not_started",
      activation: "keyboard",
    }),
    { status: "not_started", position: 2.5 },
  );
});

test("keyboard up inserts the active task before its same-column target", () => {
  assert.deepEqual(
    resolveTaskBoardDrop({
      tasks: SAME_COLUMN_TASKS,
      activeId: "c",
      overId: "b",
      overStatus: "not_started",
      activation: "keyboard",
    }),
    { status: "not_started", position: 1.5 },
  );
});

test("keyboard cross-column task targeting inserts before the target", () => {
  assert.deepEqual(
    resolveTaskBoardDrop({
      tasks: [
        { id: "a", status: "not_started", position: 1 },
        { id: "x", status: "in_progress", position: 10 },
        { id: "y", status: "in_progress", position: 20 },
      ],
      activeId: "a",
      overId: "y",
      overStatus: "in_progress",
      activation: "keyboard",
    }),
    { status: "in_progress", position: 15 },
  );
});

test("keyboard drop on an empty lane appends at the open position", () => {
  assert.deepEqual(
    resolveTaskBoardDrop({
      tasks: [{ id: "a", status: "not_started", position: 1 }],
      activeId: "a",
      overId: "task-column:done",
      overStatus: "done",
      activation: "keyboard",
    }),
    { status: "done", position: 0 },
  );
});

test("pointer task targeting preserves midpoint-based before and after insertion", () => {
  const input = {
    tasks: SAME_COLUMN_TASKS,
    activeId: "c",
    overId: "b",
    overStatus: "not_started",
    activation: "pointer",
  };

  assert.deepEqual(resolveTaskBoardDrop(input), {
    status: "not_started",
    position: 1.5,
  });
  assert.deepEqual(
    resolveTaskBoardDrop({
      ...input,
      activeId: "a",
      pointerIsAfterTarget: true,
    }),
    { status: "not_started", position: 2.5 },
  );
});

test("self drops and unchanged same-column appends are no-ops", () => {
  assert.equal(
    resolveTaskBoardDrop({
      tasks: SAME_COLUMN_TASKS,
      activeId: "b",
      overId: "b",
      overStatus: "not_started",
      activation: "keyboard",
    }),
    null,
  );
  assert.equal(
    resolveTaskBoardDrop({
      tasks: SAME_COLUMN_TASKS,
      activeId: "c",
      overId: "task-column:not_started",
      overStatus: "not_started",
      activation: "keyboard",
    }),
    null,
  );
});
