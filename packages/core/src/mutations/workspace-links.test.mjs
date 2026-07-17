import assert from "node:assert/strict";
import test from "node:test";
import {
  WorkspaceLinkError,
  linkResourceToWorkspace,
  unlinkResourceFromWorkspace,
} from "./workspace-links.ts";
import { listWorkspaceResourceIds } from "../queries/workspace-links.ts";

/**
 * Minimal thenable query-builder mock matching the subset of the Supabase
 * client surface these functions use: from().insert(), from().delete().eq()…,
 * from().select().eq()…. `responses[op]` is consumed one entry per call
 * (last entry repeats if a test calls the same op more than once).
 */
function fakeClient(responses = {}) {
  const calls = [];
  const queues = {
    insert: [...(responses.insert ?? [])],
    delete: [...(responses.delete ?? [])],
    select: [...(responses.select ?? [])],
  };
  function next(op) {
    const queue = queues[op];
    return queue.length > 1 ? queue.shift() : queue[0];
  }
  return {
    calls,
    from(table) {
      let op = null;
      const builder = {
        insert(payload) {
          op = "insert";
          calls.push({ table, op, payload });
          return Promise.resolve(next("insert"));
        },
        delete() {
          op = "delete";
          calls.push({ table, op });
          return builder;
        },
        select(columns) {
          op = "select";
          calls.push({ table, op, columns });
          return builder;
        },
        eq(column, value) {
          calls.push({ table, op, eq: [column, value] });
          return builder;
        },
        then(resolve, reject) {
          return Promise.resolve(next(op)).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

const link = { workspaceId: "workspace-1", resourceType: "task", resourceId: "task-1" };

test("linkResourceToWorkspace inserts a workspace_links row with created_by", async () => {
  const client = fakeClient({ insert: [{ error: null }] });

  await linkResourceToWorkspace(client, "owner-1", link);

  assert.deepEqual(client.calls, [
    {
      table: "workspace_links",
      op: "insert",
      payload: {
        workspace_id: "workspace-1",
        resource_type: "task",
        resource_id: "task-1",
        created_by: "owner-1",
      },
    },
  ]);
});

test("linkResourceToWorkspace treats a unique violation as idempotent success", async () => {
  const client = fakeClient({
    insert: [{ error: { code: "23505", message: "duplicate key value" } }],
  });

  await assert.doesNotReject(linkResourceToWorkspace(client, "owner-1", link));
});

test("linkResourceToWorkspace surfaces other insert errors", async () => {
  const client = fakeClient({
    insert: [{ error: { code: "23503", message: "foreign key violation" } }],
  });

  await assert.rejects(
    linkResourceToWorkspace(client, "owner-1", link),
    (error) => error instanceof WorkspaceLinkError && error.code === "23503",
  );
});

test("unlinkResourceFromWorkspace deletes by the composite key", async () => {
  const client = fakeClient({ delete: [{ error: null }] });

  await unlinkResourceFromWorkspace(client, link);

  assert.deepEqual(client.calls, [
    { table: "workspace_links", op: "delete" },
    { table: "workspace_links", op: "delete", eq: ["workspace_id", "workspace-1"] },
    { table: "workspace_links", op: "delete", eq: ["resource_type", "task"] },
    { table: "workspace_links", op: "delete", eq: ["resource_id", "task-1"] },
  ]);
});

test("unlinkResourceFromWorkspace surfaces delete errors", async () => {
  const client = fakeClient({
    delete: [{ error: { message: "network error" } }],
  });

  await assert.rejects(
    unlinkResourceFromWorkspace(client, link),
    (error) => error instanceof WorkspaceLinkError,
  );
});

test("listWorkspaceResourceIds returns resource ids for a workspace and resource type", async () => {
  const client = fakeClient({
    select: [
      {
        data: [{ resource_id: "task-1" }, { resource_id: "task-2" }],
        error: null,
      },
    ],
  });

  const ids = await listWorkspaceResourceIds(client, {
    workspaceId: "workspace-1",
    resourceType: "task",
  });

  assert.deepEqual(ids, ["task-1", "task-2"]);
  assert.deepEqual(
    client.calls.filter((call) => call.eq).map((call) => call.eq),
    [
      ["workspace_id", "workspace-1"],
      ["resource_type", "task"],
    ],
  );
});

test("listWorkspaceResourceIds returns an empty array when there are no links", async () => {
  const client = fakeClient({ select: [{ data: null, error: null }] });

  const ids = await listWorkspaceResourceIds(client, {
    workspaceId: "workspace-1",
    resourceType: "calendar_event",
  });

  assert.deepEqual(ids, []);
});

test("listWorkspaceResourceIds surfaces query errors", async () => {
  const client = fakeClient({
    select: [{ data: null, error: { message: "network error" } }],
  });

  await assert.rejects(
    listWorkspaceResourceIds(client, { workspaceId: "workspace-1", resourceType: "file" }),
  );
});
