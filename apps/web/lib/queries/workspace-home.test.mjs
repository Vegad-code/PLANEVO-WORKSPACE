import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(
  new URL("../../app/(workspace)/page.tsx", import.meta.url),
  "utf8",
);

test("the empty workspace create entry submits only through an explicit server action", () => {
  const emptyBranchStart = pageSource.indexOf('if (shell.status === "empty")');
  const readyBranchStart = pageSource.indexOf(
    '  return (\n    <div className="flex min-h-full flex-col gap-2 p-8">',
    emptyBranchStart,
  );
  const emptyBranch = pageSource.slice(emptyBranchStart, readyBranchStart);

  assert.notEqual(emptyBranchStart, -1, "the empty shell branch must exist");
  assert.match(
    pageSource,
    /import \{ createInitialWorkspace \} from "\.\/actions";/,
  );
  assert.match(emptyBranch, /<form action=\{createInitialWorkspace\}>/);
  assert.match(emptyBranch, /<button\s+type="submit"/);
});
