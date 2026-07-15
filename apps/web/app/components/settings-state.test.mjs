import assert from "node:assert/strict";
import test from "node:test";

async function loadSettingsModule() {
  try {
    return await import("./settings-state.ts");
  } catch (error) {
    assert.fail(
      `Settings state must exist before these behaviors can pass: ${String(error)}`,
    );
  }
}

const shell = {
  status: "ready",
  workspace: {
    id: "workspace-1",
    owner_id: "owner-1",
    name: "Anthony's workspace",
    icon: null,
    created_at: "2026-07-14T00:00:00.000Z",
  },
  pages: [
    { id: "page-1", label: "Physics 2400", depth: 0 },
    { id: "page-2", label: "Lab notes", depth: 1 },
  ],
  userDisplayName: "Anthony Jabbour",
  userInitials: "AJ",
};

test("creates local profile defaults from the current identity", async () => {
  const { createDefaultLocalSettings } = await loadSettingsModule();

  assert.deepEqual(createDefaultLocalSettings("Anthony Jabbour"), {
    version: 1,
    fullName: "Anthony Jabbour",
    preferredName: "Anthony",
    integrations: {
      gmail: false,
      "google-calendar": false,
      "google-drive": false,
      canvas: false,
    },
  });
});

test("accepts only the complete version-one local settings schema", async () => {
  const { createDefaultLocalSettings, parseLocalSettings } =
    await loadSettingsModule();
  const fallback = createDefaultLocalSettings("Fallback User");
  const valid = {
    version: 1,
    fullName: "Anthony Jabbour",
    preferredName: "Anthony",
    integrations: {
      gmail: true,
      "google-calendar": false,
      "google-drive": true,
      canvas: false,
    },
  };

  assert.deepEqual(parseLocalSettings(JSON.stringify(valid), fallback), valid);
  assert.deepEqual(
    parseLocalSettings('{"version":1,"fullName":"Missing fields"}', fallback),
    fallback,
  );
  assert.deepEqual(parseLocalSettings("not json", fallback), fallback);
});

test("serializes a deterministic and accurately scoped workspace outline", async () => {
  const { serializeWorkspaceJson, serializeWorkspaceMarkdown } =
    await loadSettingsModule();
  const exportedAt = new Date("2026-07-15T01:00:00.000Z");
  const json = JSON.parse(serializeWorkspaceJson(shell, exportedAt));
  const markdown = serializeWorkspaceMarkdown(shell, exportedAt);

  assert.equal(json.format, "planevo-workspace-outline");
  assert.equal(json.exportedAt, "2026-07-15T01:00:00.000Z");
  assert.deepEqual(json.workspace.pages, [
    { id: "page-1", title: "Physics 2400", depth: 0 },
    { id: "page-2", title: "Lab notes", depth: 1 },
  ]);
  assert.match(markdown, /^# Anthony's workspace/m);
  assert.match(markdown, /^- Physics 2400$/m);
  assert.match(markdown, /^  - Lab notes$/m);
  assert.match(markdown, /workspace outline currently available/);
});

test("creates safe export file names", async () => {
  const { createExportFileName } = await loadSettingsModule();

  assert.equal(
    createExportFileName("Anthony's Workspace", "json"),
    "anthony-s-workspace.json",
  );
  assert.equal(createExportFileName("  ", "md"), "planevo-workspace.md");
});
