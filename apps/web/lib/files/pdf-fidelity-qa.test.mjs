import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  assertPdfRoundTripFidelity,
  runPdfFidelityQa,
} from "./pdf-fidelity-qa.ts";

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);
const fixturesDir = join(repoRoot, "tmp/pdf-fixtures");

function loadFixture(name) {
  return new Uint8Array(readFileSync(join(fixturesDir, name)));
}

test("pdf-fidelity-qa consumer accepts an intact baseline round-trip", async () => {
  const baseline = loadFixture("fidelity-harness-baseline.pdf");
  const result = await assertPdfRoundTripFidelity({
    before: baseline,
    after: baseline,
  });
  assert.equal(result.kind, "ok");
  assert.equal(result.report.verdict, "intact");
});

test("pdf-fidelity-qa consumer rejects content loss even when packaging drift is allowed", async () => {
  const result = await assertPdfRoundTripFidelity({
    before: loadFixture("fidelity-harness-baseline.pdf"),
    after: loadFixture("fidelity-mutated-body.pdf"),
    allowPackagingDrift: true,
  });
  assert.equal(result.kind, "failed");
  assert.equal(result.report.verdict, "degraded");
});

test("pdf-fidelity-qa consumer accepts metadata packaging drift when allowed", async () => {
  const result = await assertPdfRoundTripFidelity({
    before: loadFixture("fidelity-harness-baseline.pdf"),
    after: loadFixture("fidelity-metadata-drift.pdf"),
    allowPackagingDrift: true,
  });
  assert.equal(result.kind, "ok");
  assert.equal(result.report.verdict, "packaging_drift");
});

test("pdf-fidelity-qa consumer rejects silent empty body as content loss", async () => {
  const result = await assertPdfRoundTripFidelity({
    before: loadFixture("fidelity-harness-baseline.pdf"),
    after: loadFixture("fidelity-empty-body.pdf"),
    allowPackagingDrift: true,
  });
  assert.equal(result.kind, "failed");
  assert.equal(result.report.verdict, "degraded");
  assert.ok(
    result.report.diffs.some((diff) => diff.kind === "text_changed"),
  );
});

test("runPdfFidelityQa exercises the fixture matrix without content-loss false negatives", async () => {
  const run = await runPdfFidelityQa({ fixturesDir });
  assert.equal(run.ok, true, run.lines.join("\n"));
  assert.ok(run.cases.length >= 7);
  assert.match(run.lines.join("\n"), /All fidelity QA cases passed/);
  assert.match(
    run.lines.join("\n"),
    /metadata rewrite is packaging drift only/,
  );
  assert.match(
    run.lines.join("\n"),
    /silent empty body fails content integrity/,
  );
});
