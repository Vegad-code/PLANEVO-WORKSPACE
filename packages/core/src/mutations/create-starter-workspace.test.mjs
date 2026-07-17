import assert from "node:assert/strict";
import test from "node:test";
import {
  CreateStarterWorkspaceError,
  createStarterWorkspace,
} from "./create-starter-workspace.ts";

function fakeClient(results) {
  const calls = [];
  return {
    calls,
    async rpc(functionName, args) {
      calls.push({ functionName, args });
      const result = results[functionName];
      return result ?? { data: null, error: { message: "Unexpected RPC" } };
    },
  };
}

test("createStarterWorkspace calls create_starter_workspace_v2 with the seed payload", async () => {
  const client = fakeClient({
    create_starter_workspace_v2: {
      data: {
        workspace_id: "workspace-1",
        getting_started_page_id: "page-1",
        notes_page_id: "page-2",
      },
      error: null,
    },
  });

  const result = await createStarterWorkspace(client, "owner-1", {
    organizing: "work",
    displayName: "Ada",
    workspaceId: null,
  });

  assert.deepEqual(result, {
    workspaceId: "workspace-1",
    gettingStartedPageId: "page-1",
    notesPageId: "page-2",
  });
  assert.equal(client.calls[0].functionName, "create_starter_workspace_v2");
  assert.equal(client.calls[0].args.p_owner_id, "owner-1");
  assert.equal(client.calls[0].args.p_workspace_id, null);
  assert.equal(client.calls[0].args.p_seed.organizing, "work");
  assert.ok(!("taskTemplate" in client.calls[0].args.p_seed));
});

test("RPC errors are wrapped in CreateStarterWorkspaceError", async () => {
  const client = fakeClient({
    create_starter_workspace_v2: {
      data: null,
      error: { message: "denied", code: "42501" },
    },
  });

  await assert.rejects(
    createStarterWorkspace(client, "owner-1", { organizing: "school" }),
    (error) =>
      error instanceof CreateStarterWorkspaceError && error.code === "42501",
  );
});

test("an invalid RPC result shape is rejected", async () => {
  const client = fakeClient({
    create_starter_workspace_v2: {
      data: { workspace_id: "workspace-1" },
      error: null,
    },
  });

  await assert.rejects(
    createStarterWorkspace(client, "owner-1", { organizing: "personal" }),
    (error) => error instanceof CreateStarterWorkspaceError,
  );
});
