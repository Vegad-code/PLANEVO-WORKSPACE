import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  assertDocxRoundTripFidelity,
  runDocxFidelityQa,
} from "./docx-fidelity-qa.ts";
import { readFileSync } from "node:fs";

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const fixturesDir = join(repoRoot, "tmp/docx-fixtures");
const qaScript = join(repoRoot, "tmp/docx-roundtrip-qa.mjs");

function loadFixture(name) {
  return new Uint8Array(readFileSync(join(fixturesDir, name)));
}

test("docx-fidelity-qa consumer accepts an intact baseline round-trip", () => {
  const baseline = loadFixture("minimal-baseline.docx");
  const result = assertDocxRoundTripFidelity({
    before: baseline,
    after: baseline,
  });
  assert.equal(result.kind, "ok");
  assert.equal(result.report.verdict, "intact");
});

test("docx-fidelity-qa consumer rejects content loss even when packaging drift is allowed", () => {
  const result = assertDocxRoundTripFidelity({
    before: loadFixture("minimal-baseline.docx"),
    after: loadFixture("missing-styles.docx"),
    allowPackagingDrift: true,
  });
  assert.equal(result.kind, "failed");
  assert.equal(result.report.verdict, "degraded");
});

test("runDocxFidelityQa exercises the fixture matrix without content-loss false negatives", () => {
  const run = runDocxFidelityQa({ fixturesDir });
  assert.equal(run.ok, true, run.lines.join("\n"));
  assert.ok(run.cases.length >= 5);
});

test("tmp/docx-roundtrip-qa.mjs imports the harness and exits zero on the fixture matrix", () => {
  const child = spawnSync(
    process.execPath,
    ["--experimental-strip-types", qaScript],
    {
      cwd: repoRoot,
      encoding: "utf8",
    },
  );

  assert.equal(
    child.status,
    0,
    `QA script failed:\n${child.stdout}\n${child.stderr}`,
  );
  assert.match(child.stdout, /All fidelity QA cases passed/);
  assert.match(child.stdout, /recompressed baseline is packaging drift only/);
});
