import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actionsSource = readFileSync(
  new URL("../../app/(workspace)/tasks/actions.ts", import.meta.url),
  "utf8",
);

function actionSource(name) {
  const start = actionsSource.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} must be exported from the Tasks actions module`);
  const next = actionsSource.indexOf("\nexport async function ", start + 1);
  return actionsSource.slice(start, next === -1 ? undefined : next);
}

test("scheduleProductTaskAction authenticates, validates, owns, delegates, and revalidates", () => {
  const source = actionSource("scheduleProductTaskAction");
  assert.match(source, /requireMutationDataAccess\(\)/);
  assert.match(source, /scheduleTaskActionInputSchema\.safeParse\(input\)/);
  assert.match(source, /requireOwnedTask\(access, parsed\.data\.taskId\)/);
  assert.match(source, /await scheduleTask\(/);
  assert.match(source, /revalidatePath\("\/tasks"\)/);
  assert.doesNotMatch(source, /from\("calendar_events"\)/);
});

test("attachFileToProductTaskAction verifies both owned resources before the core mutation", () => {
  const source = actionSource("attachFileToProductTaskAction");
  assert.match(source, /requireMutationDataAccess\(\)/);
  assert.match(source, /attachFileToTaskActionInputSchema\.safeParse\(input\)/);
  assert.match(source, /requireOwnedTask\(access, parsed\.data\.taskId\)/);
  assert.match(source, /requireOwnedVisibleFileSource\(/);
  assert.match(source, /await attachFileToTask\(/);
  assert.match(source, /revalidatePath\("\/tasks"\)/);
  assert.match(source, /fileCount/);
  assert.doesNotMatch(source, /from\("file_links"\)\.insert/);
});

test("linkProductTaskToWorkspaceAction verifies task and workspace ownership before delegating", () => {
  const source = actionSource("linkProductTaskToWorkspaceAction");
  assert.match(source, /requireMutationDataAccess\(\)/);
  assert.match(source, /linkTaskToWorkspaceActionInputSchema\.safeParse\(input\)/);
  assert.match(source, /requireOwnedTask\(access, parsed\.data\.taskId\)/);
  assert.match(source, /requireOwnedWorkspace\(/);
  assert.match(source, /await linkTaskToWorkspace\(/);
  assert.match(source, /revalidatePath\("\/tasks"\)/);
  assert.doesNotMatch(source, /from\("workspace_links"\)\.insert/);
});

test("loadTaskCrossLinkOptionsAction returns only shaped owned-resource picker data", () => {
  const source = actionSource("loadTaskCrossLinkOptionsAction");
  assert.match(source, /requireMutationDataAccess\(\)/);
  assert.match(source, /taskCrossLinkOptionsInputSchema\.safeParse\(input\)/);
  assert.match(source, /requireOwnedTask\(access, parsed\.data\.taskId\)/);
  assert.match(source, /loadOwnedTaskCrossLinkOptions\(/);
  assert.doesNotMatch(source, /metadata_json[\s\S]*return \{ ok: true/);
});
