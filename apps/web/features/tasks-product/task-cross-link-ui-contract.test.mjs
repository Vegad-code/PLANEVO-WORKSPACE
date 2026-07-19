import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const crossLinkSource = readFileSync(
  new URL("./cross-link-actions.tsx", import.meta.url),
  "utf8",
);
const peekSource = readFileSync(new URL("./task-peek.tsx", import.meta.url), "utf8");
const previewSource = readFileSync(
  new URL("../../app/design/tasks-product-preview.tsx", import.meta.url),
  "utf8",
);

test("Task Peek mounts all three cross-feature actions without navigation", () => {
  assert.match(peekSource, /<TaskCrossLinkActions/);
  assert.match(peekSource, /taskId=\{task\.id\}/);
  assert.match(peekSource, /initialFileCount=\{task\.fileCount\}/);
  assert.doesNotMatch(crossLinkSource, /router\.(push|replace)\(/);
  assert.match(crossLinkSource, />Schedule</);
  assert.match(crossLinkSource, /Attach file/);
  assert.match(crossLinkSource, />Add to workspace</);
});

test("schedule dialog collects local date and times, validates, and announces retryable errors", () => {
  assert.match(crossLinkSource, /type="date"/);
  assert.equal((crossLinkSource.match(/type="time"/g) ?? []).length, 2);
  assert.match(crossLinkSource, /scheduleRangeFromLocalInputs\(/);
  assert.match(crossLinkSource, /scheduleProductTaskAction\(/);
  assert.match(crossLinkSource, /role="alert"/);
  assert.match(crossLinkSource, /autoFocus/);
  assert.match(crossLinkSource, /Scheduled on your calendar/);
});

test("file picker loads only server-shaped options and refreshes the visible file count", () => {
  assert.match(crossLinkSource, /loadTaskCrossLinkOptionsAction\(/);
  assert.match(crossLinkSource, /attachFileToProductTaskAction\(/);
  assert.match(crossLinkSource, /setFileCount\(result\.data\.fileCount\)/);
  assert.match(crossLinkSource, /router\.refresh\(\)/);
  assert.match(crossLinkSource, /No available files/);
  assert.match(crossLinkSource, /Retry/);
});

test("workspace picker distinguishes current and already-linked workspaces", () => {
  assert.match(crossLinkSource, /linkProductTaskToWorkspaceAction\(/);
  assert.match(crossLinkSource, /workspace\.isCurrent/);
  assert.match(crossLinkSource, /workspace\.isLinked/);
  assert.match(crossLinkSource, /Added to/);
});

test("the design route renders the default, open, pending, success, and error states", () => {
  assert.match(previewSource, /<TaskCrossLinkActionsPreview/);
  for (const state of [
    "default",
    "schedule",
    "files",
    "files-empty",
    "workspace",
    "workspace-empty",
    "loading",
    "pending",
    "success",
    "error",
  ]) {
    assert.match(previewSource, new RegExp(`state="${state}"`));
  }
});
