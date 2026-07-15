import assert from "node:assert/strict";
import test from "node:test";

async function loadShellModule() {
  return import("./workspace-shell.ts");
}

const authAccess = { ownerId: "owner-1", mode: "auth", client: {} };
const devAccess = { ownerId: "owner-1", mode: "dev", client: {} };

const workspace = {
  id: "workspace-1",
  owner_id: "owner-1",
  name: "Studio",
  icon: null,
  created_at: "2026-07-14T00:00:00.000Z",
};

function page(overrides) {
  return {
    id: "page-1",
    workspace_id: workspace.id,
    parent_page_id: null,
    title: "Projects",
    icon: null,
    content_json: {},
    database_id: null,
    position: 0,
    is_archived: false,
    created_at: "2026-07-14T00:00:00.000Z",
    updated_at: "2026-07-14T00:00:00.000Z",
    ...overrides,
  };
}

test("returns unavailable without data access", async () => {
  const { loadWorkspaceShellData } = await loadShellModule();

  assert.deepEqual(await loadWorkspaceShellData(null, null), {
    status: "unavailable",
    workspace: null,
    workspaces: [],
    pages: [],
    userDisplayName: null,
    userInitials: null,
    userEmail: null,
    memberCount: 0,
  });
});

test("returns a true empty state without creating anything", async () => {
  const { loadWorkspaceShellData } = await loadShellModule();
  const calls = [];
  const repository = {
    async listWorkspaces(ownerId) {
      calls.push(["listWorkspaces", ownerId]);
      return [];
    },
    async listPages() {
      calls.push(["listPages"]);
      return [];
    },
    async getUser() {
      calls.push(["getUser"]);
      return null;
    },
  };

  const result = await loadWorkspaceShellData(authAccess, repository);

  assert.equal(result.status, "empty");
  assert.equal(result.workspace, null);
  assert.deepEqual(result.pages, []);
  assert.deepEqual(calls, [["listWorkspaces", "owner-1"]]);
});

test("dev mode skips session user lookup and returns a null identity", async () => {
  const { loadWorkspaceShellData } = await loadShellModule();
  const calls = [];
  const repository = {
    async listWorkspaces(ownerId) {
      calls.push(["listWorkspaces", ownerId]);
      return [workspace];
    },
    async listPages(workspaceId) {
      calls.push(["listPages", workspaceId]);
      return [];
    },
    async getUser() {
      calls.push(["getUser"]);
      throw new Error("sessionless admin client has no user");
    },
  };

  const result = await loadWorkspaceShellData(devAccess, repository);

  assert.equal(result.status, "ready");
  assert.equal(result.workspace, workspace);
  assert.deepEqual(result.pages, []);
  assert.equal(result.userDisplayName, null);
  assert.equal(result.userInitials, null);
  assert.equal(result.userEmail, null);
  assert.equal(result.memberCount, 1);
  assert.deepEqual(calls, [
    ["listWorkspaces", "owner-1"],
    ["listPages", "workspace-1"],
  ]);
});

test("auth mode returns real rows with nested depth and user identity", async () => {
  const { loadWorkspaceShellData } = await loadShellModule();
  const rows = [
    page({ id: "root", title: "Projects", position: 0 }),
    page({ id: "child", parent_page_id: "root", title: "Release notes", position: 0 }),
    page({ id: "grandchild", parent_page_id: "child", title: "Draft", position: 0 }),
    page({ id: "archived", title: "Old notes", position: 1, is_archived: true }),
  ];
  const calls = [];
  const repository = {
    async listWorkspaces(ownerId) {
      calls.push(["listWorkspaces", ownerId]);
      return [workspace];
    },
    async listPages(workspaceId) {
      calls.push(["listPages", workspaceId]);
      return rows;
    },
    async getUser() {
      calls.push(["getUser"]);
      return {
        email: "owner@example.com",
        user_metadata: { full_name: "Morgan Lee" },
      };
    },
  };

  const result = await loadWorkspaceShellData(authAccess, repository);

  assert.equal(result.status, "ready");
  assert.equal(result.workspace, workspace);
  assert.deepEqual(result.pages, [
    { id: "root", label: "Projects", depth: 0 },
    { id: "child", label: "Release notes", depth: 1 },
    { id: "grandchild", label: "Draft", depth: 2 },
  ]);
  assert.equal(result.userDisplayName, "Morgan Lee");
  assert.equal(result.userInitials, "ML");
  assert.equal(result.userEmail, "owner@example.com");
  assert.equal(result.memberCount, 1);
  assert.deepEqual(calls, [
    ["listWorkspaces", "owner-1"],
    ["listPages", "workspace-1"],
    ["getUser"],
  ]);
});

test("never substitutes fixture IDs or labels for an empty page query", async () => {
  const { loadWorkspaceShellData } = await loadShellModule();
  const repository = {
    async listWorkspaces() {
      return [workspace];
    },
    async listPages() {
      return [];
    },
    async getUser() {
      return null;
    },
  };

  const result = await loadWorkspaceShellData(authAccess, repository);
  const serialized = JSON.stringify(result);

  assert.equal(result.status, "ready");
  assert.deepEqual(result.pages, []);
  assert.equal(serialized.includes("fixture-"), false);
  assert.equal(serialized.includes("Physics 2400"), false);
  assert.equal(serialized.includes("Apps tracker"), false);
  assert.equal(serialized.includes("Reading list"), false);
});
