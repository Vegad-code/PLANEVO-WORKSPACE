import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PDFDocument } from "pdf-lib";

import {
  assertPdfContentIntegrity,
  comparePdfPackages,
  deriveRequiredFragmentsFromMarkdown,
  evaluateMarkdownPdfRoundTrip,
  extractPdfBodyPlainText,
  inventoryPdfPackage,
  isPdfFidelityDegraded,
  summarizeMarkdownPdfRoundTripReport,
  summarizePdfContentIntegrityReport,
  summarizePdfFidelityReport,
} from "./pdf-fidelity.ts";
import { exportMarkdownToPdf } from "./pdf-export.ts";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../tmp/pdf-fixtures",
);

function loadFixture(name) {
  return new Uint8Array(readFileSync(join(fixturesDir, name)));
}

/** Unique fidelity-agent fixture — do not collide with import-agent names. */
const FIDELITY_BASELINE_NAME = "fidelity-harness-baseline.pdf";

async function ensureFidelityBaselineFixture() {
  mkdirSync(fixturesDir, { recursive: true });
  const path = join(fixturesDir, FIDELITY_BASELINE_NAME);
  try {
    return new Uint8Array(readFileSync(path));
  } catch {
    const exported = await exportMarkdownToPdf({
      markdown: [
        "# Planevo PDF fidelity baseline",
        "",
        "Body paragraph kept for harness inventory.",
        "",
        "- alpha item",
        "- beta item",
      ].join("\n"),
    });
    assert.equal(exported.kind, "ok");
    writeFileSync(path, exported.bytes);
    return exported.bytes;
  }
}

async function mutateProducerMetadata(bytes, producer) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  doc.setProducer(producer);
  doc.setTitle(`drift-${producer}`);
  return new Uint8Array(await doc.save());
}

const minimalText = loadFixture("minimal-text.pdf");
const scannedBlank = loadFixture("scanned-blank.pdf");
const fidelityBaseline = await ensureFidelityBaselineFixture();

test("inventories a text PDF with page count and extractable body", async () => {
  const snapshot = await inventoryPdfPackage({ bytes: minimalText });
  assert.equal(snapshot.readable, true);
  assert.ok(snapshot.pageCount >= 1);
  assert.ok(snapshot.byteLength > 0);
  assert.match(snapshot.bodyPlainText, /Planevo PDF Fixture/);
  assert.ok(snapshot.normalizedText.includes("planevo pdf fixture"));
});

test("rejects non-PDF bytes instead of inventing a readable snapshot", async () => {
  const snapshot = await inventoryPdfPackage({
    bytes: new Uint8Array([0x3c, 0x68, 0x74, 0x6d]),
  });
  assert.equal(snapshot.readable, false);
  assert.equal(snapshot.pageCount, 0);
  assert.equal(snapshot.bodyPlainText, "");
  assert.ok(snapshot.unreadableReason);
});

test("an untouched round-trip is intact with no diffs", async () => {
  const report = await comparePdfPackages({
    before: fidelityBaseline,
    after: fidelityBaseline,
  });
  assert.equal(report.verdict, "intact");
  assert.equal(report.diffs.length, 0);
  assert.equal(isPdfFidelityDegraded({ report }), false);
  assert.match(summarizePdfFidelityReport({ report }), /^Intact:/);
});

test("mutating producer metadata alone is packaging drift, not content loss", async () => {
  const drifted = await mutateProducerMetadata(
    fidelityBaseline,
    "Planevo-Fidelity-Drift",
  );
  const report = await comparePdfPackages({
    before: fidelityBaseline,
    after: drifted,
  });
  assert.equal(report.verdict, "packaging_drift");
  assert.equal(isPdfFidelityDegraded({ report }), false);
  assert.ok(report.diffs.some((diff) => diff.kind === "metadata_changed"));
  assert.ok(report.diffs.some((diff) => diff.kind === "bytes_changed"));
  assert.equal(
    report.diffs.some((diff) => diff.kind === "text_changed"),
    false,
  );
  assert.match(summarizePdfFidelityReport({ report }), /^Packaging drift only:/);
});

test("replacing body text surfaces degraded content loss, not packaging noise", async () => {
  const mutated = await exportMarkdownToPdf({
    markdown: "# Different document\n\nThis body is intentionally unrelated.\n",
  });
  assert.equal(mutated.kind, "ok");

  const report = await comparePdfPackages({
    before: fidelityBaseline,
    after: mutated.bytes,
  });
  assert.equal(report.verdict, "degraded");
  assert.equal(isPdfFidelityDegraded({ report }), true);
  assert.ok(report.diffs.some((diff) => diff.kind === "text_changed"));
  assert.match(summarizePdfFidelityReport({ report }), /^Degraded:/);
});

test("the harness tells a degraded package from an intact one in a blind pair", async () => {
  const intact = await comparePdfPackages({
    before: fidelityBaseline,
    after: fidelityBaseline,
  });
  const other = await exportMarkdownToPdf({
    markdown: "# Other\n\nUnrelated paragraph for blind compare.\n",
  });
  assert.equal(other.kind, "ok");
  const degraded = await comparePdfPackages({
    before: fidelityBaseline,
    after: other.bytes,
  });

  assert.equal(intact.verdict, "intact");
  assert.equal(degraded.verdict, "degraded");
  assert.notEqual(intact.verdict, degraded.verdict);
});

test("unreadable after bytes yield an unreadable verdict instead of a false intact", async () => {
  const report = await comparePdfPackages({
    before: fidelityBaseline,
    after: new Uint8Array([0x00, 0x01, 0x02]),
  });
  assert.equal(report.verdict, "unreadable");
  assert.equal(report.beforeReadable, true);
  assert.equal(report.afterReadable, false);
  assert.equal(isPdfFidelityDegraded({ report }), false);
  assert.match(summarizePdfFidelityReport({ report }), /^Unreadable:/);
});

test("unreadable before bytes yield an unreadable verdict instead of a false intact", async () => {
  const report = await comparePdfPackages({
    before: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
    after: fidelityBaseline,
  });
  assert.equal(report.verdict, "unreadable");
  assert.equal(report.beforeReadable, false);
  assert.equal(report.afterReadable, true);
  assert.equal(isPdfFidelityDegraded({ report }), false);
});

test("content integrity reads fixture body text without claiming layout fidelity", async () => {
  const plain = await extractPdfBodyPlainText({ bytes: minimalText });
  assert.match(plain, /Planevo PDF Fixture/);
  assert.match(plain, /Second paragraph keeps edited content honest/);

  const integrity = await assertPdfContentIntegrity({
    bytes: minimalText,
    requiredFragments: [
      "Planevo PDF Fixture",
      "Second paragraph keeps edited content honest",
    ],
  });
  assert.equal(integrity.verdict, "content_preserved");
  assert.equal(integrity.emptyBody, false);
  assert.match(
    summarizePdfContentIntegrityReport({ report: integrity }),
    /^Content preserved:/,
  );
});

test("content integrity fails when required edited fragments are absent", async () => {
  const integrity = await assertPdfContentIntegrity({
    bytes: minimalText,
    requiredFragments: ["This fragment was never in the fixture"],
  });
  assert.equal(integrity.verdict, "content_lost");
  assert.deepEqual(integrity.missingFragments, [
    "This fragment was never in the fixture",
  ]);
  assert.match(
    summarizePdfContentIntegrityReport({ report: integrity }),
    /^Content lost:/,
  );
});

test("content integrity rejects non-PDF bytes instead of inventing preserved text", async () => {
  const integrity = await assertPdfContentIntegrity({
    bytes: new Uint8Array([0x00, 0x01]),
    requiredFragments: ["anything"],
  });
  assert.equal(integrity.verdict, "structurally_invalid");
  assert.equal(integrity.packageReadable, false);
  assert.match(
    summarizePdfContentIntegrityReport({ report: integrity }),
    /^Structurally invalid:/,
  );
});

test("a scanned blank PDF is content_lost when edited fragments were expected", async () => {
  const integrity = await assertPdfContentIntegrity({
    bytes: scannedBlank,
    requiredFragments: ["Must not be silently dropped"],
  });
  assert.equal(integrity.verdict, "content_lost");
  assert.equal(integrity.emptyBody, true);
  assert.ok(
    integrity.missingFragments.includes("Must not be silently dropped"),
  );
});

test("deriveRequiredFragmentsFromMarkdown keeps headings paragraphs and lists", () => {
  const fragments = deriveRequiredFragmentsFromMarkdown({
    markdown: [
      "# Vendor Portal",
      "",
      "Body paragraph with **emphasis**.",
      "",
      "- alpha",
      "- beta",
      "",
      "1. first",
    ].join("\n"),
  });
  assert.deepEqual(fragments, [
    "Vendor Portal",
    "Body paragraph with emphasis.",
    "alpha",
    "beta",
    "first",
  ]);
});

test("markdown edit round-trip does not silently drop paragraphs or headings", async () => {
  const markdown = [
    "# Vendor Portal",
    "",
    "Body paragraph kept through save-back.",
    "",
    "## Nested heading",
    "",
    "- alpha item",
    "- beta item",
  ].join("\n");

  const report = await evaluateMarkdownPdfRoundTrip({ markdown });
  assert.equal(
    report.verdict,
    "content_preserved",
    summarizeMarkdownPdfRoundTripReport({ report }),
  );
  assert.ok(report.exportedBytes);
  assert.equal(report.packageIntegrity?.verdict, "content_preserved");
  assert.ok(report.reimportedMarkdown);
  assert.deepEqual(report.missingAfterImport, []);
  assert.match(report.reimportedMarkdown, /Vendor Portal/);
  assert.match(report.reimportedMarkdown, /Body paragraph kept through save-back/);
  assert.match(report.reimportedMarkdown, /Nested heading/);
  assert.match(report.reimportedMarkdown, /alpha item/);
  assert.match(report.reimportedMarkdown, /beta item/);
  assert.equal(report.packageCompare, null);
});

test("markdown save can be content-preserved while package compare reports degraded text", async () => {
  const markdown = "# Edited Title\n\nKept paragraph after surgery.\n";
  const report = await evaluateMarkdownPdfRoundTrip({
    markdown,
    requiredFragments: ["Edited Title", "Kept paragraph after surgery"],
    basePackage: fidelityBaseline,
  });

  assert.equal(
    report.verdict,
    "content_preserved",
    summarizeMarkdownPdfRoundTripReport({ report }),
  );
  assert.ok(report.packageCompare);
  // Intentionally rewritten body — package layer correctly says degraded, but
  // content integrity is the markdown-shell pass/fail bar.
  assert.equal(report.packageCompare.verdict, "degraded");
  assert.ok(
    report.packageCompare.diffs.some((diff) => diff.kind === "text_changed"),
  );
  assert.ok(report.reimportedMarkdown?.includes("Edited Title"));
  assert.ok(report.reimportedMarkdown?.includes("Kept paragraph after surgery"));
});

test("packaging_drift vs degraded stays meaningful beside content integrity", async () => {
  const drifted = await mutateProducerMetadata(
    fidelityBaseline,
    "Planevo-Compare-Drift",
  );
  const drift = await comparePdfPackages({
    before: fidelityBaseline,
    after: drifted,
  });
  const other = await exportMarkdownToPdf({
    markdown: "# Lost\n\nCompletely different body text for degrade.\n",
  });
  assert.equal(other.kind, "ok");
  const degraded = await comparePdfPackages({
    before: fidelityBaseline,
    after: other.bytes,
  });

  assert.equal(drift.verdict, "packaging_drift");
  assert.equal(degraded.verdict, "degraded");
  assert.notEqual(drift.verdict, degraded.verdict);

  const driftIntegrity = await assertPdfContentIntegrity({
    bytes: drifted,
    requiredFragments: ["Planevo PDF fidelity baseline"],
  });
  assert.equal(driftIntegrity.verdict, "content_preserved");
});

test("content integrity fails an empty body when edited fragments were expected", async () => {
  const emptyTrip = await evaluateMarkdownPdfRoundTrip({
    markdown: "",
    requiredFragments: ["Must not be silently dropped"],
  });
  assert.equal(emptyTrip.verdict, "content_lost");
  assert.equal(emptyTrip.packageIntegrity?.emptyBody, true);
  assert.ok(
    emptyTrip.packageIntegrity?.missingFragments.includes(
      "Must not be silently dropped",
    ),
  );
});

test("empty markdown without required fragments is structurally valid empty body", async () => {
  const exported = await exportMarkdownToPdf({ markdown: "" });
  assert.equal(exported.kind, "ok");
  const integrity = await assertPdfContentIntegrity({
    bytes: exported.bytes,
    requiredFragments: [],
  });
  assert.equal(integrity.verdict, "content_preserved");
  assert.equal(integrity.emptyBody, true);
});
