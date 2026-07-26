import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actionsSource = readFileSync(
  new URL("../../app/(workspace)/tasks/actions.ts", import.meta.url),
  "utf8",
);
const captureActionsSource = readFileSync(
  new URL("../../app/(workspace)/capture-actions.ts", import.meta.url),
  "utf8",
);
const peekSource = readFileSync(new URL("./task-peek.tsx", import.meta.url), "utf8");

function actionSource(name) {
  const start = actionsSource.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} must be exported from the Tasks actions module`);
  const next = actionsSource.indexOf("\nexport async function ", start + 1);
  return actionsSource.slice(start, next === -1 ? undefined : next);
}

test("task deletion requires an explicit linked-block policy at the server boundary", () => {
  assert.match(
    actionsSource,
    /linkedEventAction: z\.enum\(\["delete_linked_block", "keep_linked_block"\]\)/,
  );

  const source = actionSource("deleteProductTaskAction");
  assert.match(source, /deleteProductTaskSchema\.safeParse\(input\)/);
  assert.match(source, /parsed\.data\.linkedEventAction/);
  assert.match(source, /revalidatePath\("\/tasks"\)/);
  assert.match(source, /revalidatePath\("\/calendar"\)/);
});

test("a scheduled task offers delete block, keep block, and cancel choices", () => {
  assert.match(peekSource, /task\.linkedEventCount > 0/);
  assert.match(peekSource, /Delete task and block/);
  assert.match(peekSource, /Keep block, delete task/);
  assert.match(peekSource, />\s*Cancel\s*</);
  assert.match(peekSource, /removeTask\("delete_linked_block"\)/);
  assert.match(peekSource, /removeTask\("keep_linked_block"\)/);
});

test("quick-capture undo explicitly deletes any linked block", () => {
  assert.match(
    captureActionsSource,
    /deleteTask\([\s\S]*?access\.ownerId,[\s\S]*?id,[\s\S]*?"delete_linked_block",[\s\S]*?\)/,
  );
});
