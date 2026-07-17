import assert from "node:assert/strict";
import { test } from "node:test";
import {
  scheduleTask,
  attachFileToTask,
  linkTaskToWorkspace,
} from "./task-cross-links.ts";

test("scheduleTask creates calendar_event with task_id on the default calendar", async () => {
  const inserts = [];
  const client = {
    from(table) {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: { id: "cal-1" }, error: null }),
              }),
            }),
          }),
        }),
        insert(row) {
          inserts.push({ table, row });
          return {
            select: () => ({
              single: async () => ({ data: { id: "evt-1", ...row }, error: null }),
            }),
          };
        },
      };
    },
  };
  const event = await scheduleTask(client, "user-1", {
    taskId: "task-1",
    title: "Review PRD",
    startsAt: "2026-07-20T14:00:00.000Z",
    endsAt: "2026-07-20T15:00:00.000Z",
  });
  assert.equal(inserts[0].table, "calendar_events");
  assert.equal(inserts[0].row.task_id, "task-1");
  assert.equal(inserts[0].row.calendar_id, "cal-1");
  assert.equal(inserts[0].row.user_id, "user-1");
  assert.equal(inserts[0].row.title, "Review PRD");
  assert.equal(inserts[0].row.starts_at, "2026-07-20T14:00:00.000Z");
  assert.equal(inserts[0].row.ends_at, "2026-07-20T15:00:00.000Z");
  assert.equal(event.id, "evt-1");
});

test("scheduleTask throws a clear error when the user has no calendar", async () => {
  const client = {
    from() {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        }),
      };
    },
  };
  await assert.rejects(
    () =>
      scheduleTask(client, "user-1", {
        taskId: "task-1",
        title: "Review PRD",
        startsAt: "2026-07-20T14:00:00.000Z",
        endsAt: "2026-07-20T15:00:00.000Z",
      }),
    /calendar/i,
  );
});

test("attachFileToTask inserts a file_links row targeting the task", async () => {
  let captured = null;
  const client = {
    from(table) {
      return {
        insert(row) {
          captured = { table, row };
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  await attachFileToTask(client, { taskId: "task-1", fileSourceId: "file-9" });
  assert.equal(captured.table, "file_links");
  assert.equal(captured.row.target_type, "task");
  assert.equal(captured.row.target_id, "task-1");
  assert.equal(captured.row.file_source_id, "file-9");
});

test("attachFileToTask treats a duplicate attachment as idempotent success", async () => {
  const client = {
    from() {
      return {
        insert() {
          return Promise.resolve({
            error: { code: "23505", message: "duplicate key value" },
          });
        },
      };
    },
  };
  // Re-attaching an already-linked file must not throw.
  await attachFileToTask(client, { taskId: "task-1", fileSourceId: "file-9" });
});

test("linkTaskToWorkspace delegates to linkResourceToWorkspace with resource_type task", async () => {
  let captured = null;
  const client = {
    from(table) {
      return {
        insert(row) {
          captured = { table, row };
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  await linkTaskToWorkspace(client, "user-1", {
    taskId: "task-1",
    workspaceId: "ws-1",
  });
  assert.equal(captured.table, "workspace_links");
  assert.equal(captured.row.resource_type, "task");
  assert.equal(captured.row.resource_id, "task-1");
  assert.equal(captured.row.workspace_id, "ws-1");
  assert.equal(captured.row.created_by, "user-1");
});
