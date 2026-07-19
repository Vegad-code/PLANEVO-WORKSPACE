import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createTask,
  updateTaskStatus,
  reorderTask,
  createSubtask,
} from "./product-tasks.ts";

test("createTask inserts with defaults", async () => {
  let inserted = null;
  const client = {
    from() {
      return {
        insert(row) {
          inserted = row;
          return {
            select: () => ({
              single: async () => ({ data: { id: "new-id", ...row }, error: null }),
            }),
          };
        },
      };
    },
  };
  const task = await createTask(client, "user-1", { title: "Ship Phase 2" });
  assert.equal(inserted.title, "Ship Phase 2");
  assert.equal(inserted.status, "not_started");
  assert.equal(inserted.user_id, "user-1");
  assert.equal(inserted.description_json, undefined);
  assert.equal(task.id, "new-id");
});

test("createTask passes description_json through when provided", async () => {
  let inserted = null;
  const client = {
    from() {
      return {
        insert(row) {
          inserted = row;
          return {
            select: () => ({
              single: async () => ({ data: { id: "new-id", ...row }, error: null }),
            }),
          };
        },
      };
    },
  };
  await createTask(client, "user-1", {
    title: "Ship Phase 2",
    description_json: { text: "Board parity", tags: ["Product"], estimateMinutes: 60 },
  });
  assert.deepEqual(inserted.description_json, {
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
