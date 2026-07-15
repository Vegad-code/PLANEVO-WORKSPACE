import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageSource = readFileSync(
  new URL("../../app/(workspace)/page.tsx", import.meta.url),
  "utf8",
);

test("Home is composed from live shell data without an automatic write path", () => {
  assert.match(pageSource, /const shell = await getWorkspaceShellData\(\);/);
  assert.match(pageSource, /const home = await getHomeData\(shell\);/);
  assert.match(pageSource, /return <HomeCommandCenter data=\{home\} \/>;/);
  assert.doesNotMatch(pageSource, /createInitialWorkspace|bootstrapWorkspace|FIXTURE_/);
});
