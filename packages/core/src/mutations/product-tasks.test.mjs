import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createTask,
  moveTaskAndStatus,
  updateTaskAndStatus,
  updateTaskStatus,
  reorderTask,
  createSubtask,
} from "./product-tasks.ts";

function taskUpdateHarness(initialRow, failure = null) {
  const row = { ...initialRow };
  const patches = [];
  const client = {
    from(table) {
      assert.equal(table, "tasks");
      return {
        update(patch) {
          patches.push(patch);
          return {
            eq(column, value) {
              assert.equal(column, "id");
              assert.equal(value, "task-1");
              return {
                async eq(ownerColumn, ownerId) {
                  assert.equal(ownerColumn, "user_id");
                  assert.equal(ownerId, "user-1");
                  if (failure) return { error: failure };
                  Object.assign(row, patch);
                  return { error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  return { client, row, patches };
}

test("createTask inserts with defaults", async () => {
  let captured = null;
  const client = {
    async rpc(name, args) {
      captured = { name, args };
      return { data: { id: "new-id", ...args }, error: null };
    },
  };
  const task = await createTask(client, "user-1", {
    operationKey: "operation-1",
    title: "Ship Phase 2",
  });
  assert.equal(captured.name, "create_task_ordered");
  assert.equal(captured.args.p_title, "Ship Phase 2");
  assert.equal(captured.args.p_status, "not_started");
  assert.equal(captured.args.p_owner_id, "user-1");
  assert.equal(captured.args.p_operation_key, "operation-1");
  assert.deepEqual(captured.args.p_description_json, {});
  assert.equal(task.id, "new-id");
});

test("createTask passes description_json through when provided", async () => {
  let captured = null;
  const client = {
    async rpc(name, args) {
      captured = { name, args };
      return { data: { id: "new-id", ...args }, error: null };
    },
  };
  await createTask(client, "user-1", {
    operationKey: "operation-2",
    title: "Ship Phase 2",
    description_json: { text: "Board parity", tags: ["Product"], estimateMinutes: 60 },
  });
  assert.deepEqual(captured.args.p_description_json, {
    text: "Board parity",
    tags: ["Product"],
    estimateMinutes: 60,
  });
});

test("updateTaskStatus sets completed_at when done", async () => {
  let patch = null;
  const eqCalls = [];
  const client = {
    from() {
      return {
        update(values) {
          patch = values;
          return {
            eq(col, val) {
              eqCalls.push([col, val]);
              return {
                eq(col2, val2) {
                  eqCalls.push([col2, val2]);
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        },
      };
    },
  };
  await updateTaskStatus(client, "user-1", "task-1", "done");
  assert.equal(patch.status, "done");
  assert.ok(patch.completed_at);
  // RLS defense in depth: scope by id AND user_id.
  assert.deepEqual(eqCalls, [
    ["id", "task-1"],
    ["user_id", "user-1"],
  ]);
});

test("updateTaskStatus clears completed_at when leaving done", async () => {
  let patch = null;
  const client = {
    from() {
      return {
        update(values) {
          patch = values;
          return { eq: () => ({ eq: async () => ({ error: null }) }) };
        },
      };
    },
  };
  await updateTaskStatus(client, "user-1", "task-1", "in_progress");
  assert.equal(patch.status, "in_progress");
  assert.equal(patch.completed_at, null);
});

test("reorderTask sets midpoint position via fractional ordering", async () => {
  let patch = null;
  const client = {
    from() {
      return {
        update(values) {
          patch = values;
          return { eq: () => ({ eq: async () => ({ error: null }) }) };
        },
      };
    },
  };
  await reorderTask(client, "user-1", "task-1", 2, 4);
  assert.equal(patch.position, 3);
  assert.ok(patch.updated_at);
});

test("updateTaskAndStatus commits fields, status, and completion in one update", async () => {
  const harness = taskUpdateHarness({
    title: "Old title",
    status: "in_progress",
    completed_at: null,
  });

  await updateTaskAndStatus(harness.client, "user-1", "task-1", {
    title: "Ready to ship",
    priority: "high",
    due_at: "2026-07-30T19:00:00.000Z",
    description_json: { text: "Final pass" },
    status: "done",
  });

  assert.equal(harness.patches.length, 1);
  assert.equal(harness.row.title, "Ready to ship");
  assert.equal(harness.row.priority, "high");
  assert.equal(harness.row.status, "done");
  assert.ok(harness.row.completed_at);
});

test("updateTaskAndStatus failure leaves every logical field unchanged", async () => {
  const initial = {
    title: "Old title",
    priority: "low",
    status: "in_progress",
    completed_at: null,
  };
  const harness = taskUpdateHarness(initial, new Error("database unavailable"));

  await assert.rejects(
    updateTaskAndStatus(harness.client, "user-1", "task-1", {
      title: "New title",
      status: "done",
    }),
    /database unavailable/,
  );

  assert.equal(harness.patches.length, 1);
  assert.deepEqual(harness.row, initial);
});

test("moveTaskAndStatus commits position and clears completion in one update", async () => {
  const harness = taskUpdateHarness({
    position: 1,
    status: "done",
    completed_at: "2026-07-20T19:00:00.000Z",
  });

  await moveTaskAndStatus(
    harness.client,
    "user-1",
    "task-1",
    2,
    4,
    "in_review",
  );

  assert.equal(harness.patches.length, 1);
  assert.equal(harness.row.position, 3);
  assert.equal(harness.row.status, "in_review");
  assert.equal(harness.row.completed_at, null);
});

test("moveTaskAndStatus failure leaves both position and status unchanged", async () => {
  const initial = { position: 1, status: "not_started", completed_at: null };
  const harness = taskUpdateHarness(initial, new Error("write rejected"));

  await assert.rejects(
    moveTaskAndStatus(
      harness.client,
      "user-1",
      "task-1",
      2,
      4,
      "done",
    ),
    /write rejected/,
  );

  assert.equal(harness.patches.length, 1);
  assert.deepEqual(harness.row, initial);
});

test("createSubtask inserts into task_subtasks", async () => {
  let table = null;
  let inserted = null;
  const client = {
    from(name) {
      table = name;
      return {
        insert(row) {
          inserted = row;
          return {
            select: () => ({
              single: async () => ({ data: { id: "sub-1", ...row }, error: null }),
            }),
          };
        },
      };
    },
  };
  const sub = await createSubtask(client, "task-1", "Write tests");
  assert.equal(table, "task_subtasks");
  assert.equal(inserted.task_id, "task-1");
  assert.equal(inserted.title, "Write tests");
  assert.equal(typeof inserted.position, "number");
  assert.ok(inserted.position > 0);
  assert.equal(sub.id, "sub-1");
});
