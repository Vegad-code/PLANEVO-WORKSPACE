import assert from "node:assert/strict";
import { test } from "node:test";
import { loadProductTasks } from "./product-tasks.ts";

test("loadProductTasks returns tasks ordered by position", async () => {
  const rows = [
    { id: "t2", user_id: "u1", title: "B", status: "not_started", priority: null,
      due_at: null, description_json: {}, position: 2, completed_at: null,
      created_at: "2026-01-01", updated_at: "2026-01-01" },
    { id: "t1", user_id: "u1", title: "A", status: "done", priority: "high",
      due_at: null, description_json: {}, position: 1, completed_at: null,
      created_at: "2026-01-01", updated_at: "2026-01-01" },
  ];
  const client = {
    from(table) {
      if (table === "tasks") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: rows, error: null }),
            }),
          }),
        };
      }
      if (table === "task_subtasks") {
        return { select: () => ({ in: async () => ({ data: [], error: null }) }) };
      }
      if (table === "file_links") {
        return { select: () => ({ eq: () => ({ in: async () => ({ data: [], error: null }) }) }) };
      }
      if (table === "calendar_events") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({ in: async () => ({ data: [], error: null }) }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  const result = await loadProductTasks(client, "u1");
  assert.equal(result.length, 2);
  assert.equal(result[0].title, "B");
  assert.equal(result[0].linkedEventCount, 0);
});

test("loadProductTasks aggregates subtask, file, and live linked-event counts per task", async () => {
  const rows = [
    { id: "t1", user_id: "u1", title: "A", status: "not_started", priority: null,
      due_at: null, description_json: {}, position: 1, completed_at: null,
      created_at: "2026-01-01", updated_at: "2026-01-01" },
    { id: "t2", user_id: "u1", title: "B", status: "not_started", priority: null,
      due_at: null, description_json: {}, position: 2, completed_at: null,
      created_at: "2026-01-01", updated_at: "2026-01-01" },
  ];
  const subtasks = [
    { id: "s1", task_id: "t1", title: "one", is_done: true, position: 1, created_at: "2026-01-01" },
    { id: "s2", task_id: "t1", title: "two", is_done: false, position: 0, created_at: "2026-01-01" },
  ];
  const fileLinks = [
    { target_id: "t1" },
    { target_id: "t1" },
  ];
  const linkedEvents = [
    { task_id: "t1" },
    { task_id: "t1" },
    { task_id: null },
  ];
  let subtaskInIds = null;
  let fileInIds = null;
  let linkedEventQuery = null;
  let linkedEventInIds = null;
  const client = {
    from(table) {
      if (table === "tasks") {
        return {
          select: () => ({ eq: () => ({ order: async () => ({ data: rows, error: null }) }) }),
        };
      }
      if (table === "task_subtasks") {
        return {
          select: () => ({
            in: async (_col, ids) => {
              subtaskInIds = ids;
              return { data: subtasks, error: null };
            },
          }),
        };
      }
      if (table === "file_links") {
        return {
          select: () => ({
            eq: () => ({
              in: async (_col, ids) => {
                fileInIds = ids;
                return { data: fileLinks, error: null };
              },
            }),
          }),
        };
      }
      if (table === "calendar_events") {
        return {
          select: () => ({
            eq: (col, value) => {
              linkedEventQuery = { ...(linkedEventQuery ?? {}), [col]: value };
              return {
                is: (isCol, isValue) => {
                  linkedEventQuery = {
                    ...(linkedEventQuery ?? {}),
                    [isCol]: isValue,
                  };
                  return {
                    in: async (_col, ids) => {
                      linkedEventInIds = ids;
                      return { data: linkedEvents, error: null };
                    },
                  };
                },
              };
            },
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  const result = await loadProductTasks(client, "u1");
  const t1 = result.find((task) => task.id === "t1");
  const t2 = result.find((task) => task.id === "t2");
  assert.deepEqual(subtaskInIds, ["t1", "t2"]);
  assert.deepEqual(fileInIds, ["t1", "t2"]);
  assert.deepEqual(linkedEventInIds, ["t1", "t2"]);
  assert.deepEqual(linkedEventQuery, { user_id: "u1", deleted_at: null });
  assert.equal(t1.subtaskTotal, 2);
  assert.equal(t1.subtaskDone, 1);
  assert.equal(t1.fileCount, 2);
  assert.equal(t1.linkedEventCount, 2);
  assert.deepEqual(t1.subtasks.map((s) => s.id), ["s2", "s1"]);
  assert.equal(t2.subtaskTotal, 0);
  assert.equal(t2.subtaskDone, 0);
  assert.equal(t2.fileCount, 0);
  assert.equal(t2.linkedEventCount, 0);
  assert.deepEqual(t2.subtasks, []);
});

test("loadProductTasks filters to a workspace via workspace_links", async () => {
  const rows = [
    { id: "t1", user_id: "u1", title: "A", status: "not_started", priority: null,
      due_at: null, description_json: {}, position: 1, completed_at: null,
      created_at: "2026-01-01", updated_at: "2026-01-01" },
  ];
  let linkQuery = null;
  let taskInIds = null;
  const client = {
    from(table) {
      if (table === "workspace_links") {
        return {
          select: () => ({
            eq: (col, val) => {
              linkQuery = { ...(linkQuery ?? {}), [col]: val };
              return {
                eq: (col2, val2) => {
                  linkQuery = { ...(linkQuery ?? {}), [col2]: val2 };
                  return Promise.resolve({ data: [{ resource_id: "t1" }], error: null });
                },
              };
            },
          }),
        };
      }
      if (table === "tasks") {
        return {
          select: () => ({
            eq: () => ({
              in: (_col, ids) => {
                taskInIds = ids;
                return { order: async () => ({ data: rows, error: null }) };
              },
            }),
          }),
        };
      }
      if (table === "task_subtasks") {
        return { select: () => ({ in: async () => ({ data: [], error: null }) }) };
      }
      if (table === "file_links") {
        return { select: () => ({ eq: () => ({ in: async () => ({ data: [], error: null }) }) }) };
      }
      if (table === "calendar_events") {
        return {
          select: () => ({
            eq: () => ({
              is: () => ({ in: async () => ({ data: [], error: null }) }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  const result = await loadProductTasks(client, "u1", { workspaceId: "w1" });
  assert.deepEqual(linkQuery, { workspace_id: "w1", resource_type: "task" });
  assert.deepEqual(taskInIds, ["t1"]);
  assert.equal(result.length, 1);
});

test("loadProductTasks short-circuits when a workspace has no linked tasks", async () => {
  let tasksQueried = false;
  const client = {
    from(table) {
      if (table === "workspace_links") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      tasksQueried = true;
      throw new Error(`unexpected table ${table}`);
    },
  };
  const result = await loadProductTasks(client, "u1", { workspaceId: "w1" });
  assert.deepEqual(result, []);
  assert.equal(tasksQueried, false);
});
