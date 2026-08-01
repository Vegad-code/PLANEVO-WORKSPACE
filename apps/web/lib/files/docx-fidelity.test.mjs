import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  assertDocxContentIntegrity,
  compareDocxPackages,
  deriveRequiredFragmentsFromMarkdown,
  evaluateMarkdownDocxRoundTrip,
  extractDocxBodyPlainText,
  extractDocxDocumentXml,
  inventoryDocxPackage,
  isDocxFidelityDegraded,
  packageHasRequiredDocxParts,
  REQUIRED_DOCX_PART_NAMES,
  summarizeDocxContentIntegrityReport,
  summarizeDocxFidelityReport,
} from "./docx-fidelity.ts";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../tmp/docx-fixtures",
);

function loadFixture(name) {
  return new Uint8Array(readFileSync(join(fixturesDir, name)));
}

function u16(value) {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function u32(value) {
  return [
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ];
}

/** Rebuild a ZIP from inventory payloads (used to strip required parts). */
function buildZipFromParts(entries) {
  const encoder = new TextEncoder();
  const locals = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const payload = entry.content;
    const method = entry.compressionMethod ?? 0;
    const checksum = entry.crc32;
    const uncompressedSize = entry.uncompressedSize ?? payload.byteLength;
    const local = Uint8Array.from([
      0x50, 0x4b, 0x03, 0x04,
      ...u16(20),
      ...u16(0),
      ...u16(method),
      ...u16(0),
      ...u16(0),
      ...u32(checksum),
      ...u32(payload.byteLength),
      ...u32(uncompressedSize),
      ...u16(name.byteLength),
      ...u16(0),
      ...name,
      ...payload,
    ]);
    locals.push(local);
    central.push(
      Uint8Array.from([
        0x50, 0x4b, 0x01, 0x02,
        ...u16(20),
        ...u16(20),
        ...u16(0),
        ...u16(method),
        ...u16(0),
        ...u16(0),
        ...u32(checksum),
        ...u32(payload.byteLength),
        ...u32(uncompressedSize),
        ...u16(name.byteLength),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u16(0),
        ...u32(0),
        ...u32(offset),
        ...name,
      ]),
    );
    offset += local.byteLength;
  }
  const centralSize = central.reduce((total, entry) => total + entry.byteLength, 0);
  const eocd = Uint8Array.from([
    0x50, 0x4b, 0x05, 0x06,
    ...u16(0),
    ...u16(0),
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(centralSize),
    ...u32(offset),
    ...u16(0),
  ]);
  const zip = new Uint8Array(offset + centralSize + eocd.byteLength);
  let cursor = 0;
  for (const chunk of [...locals, ...central, eocd]) {
    zip.set(chunk, cursor);
    cursor += chunk.byteLength;
  }
  return zip;
}

const baseline = loadFixture("minimal-baseline.docx");
const missingStyles = loadFixture("missing-styles.docx");
const mutatedDocument = loadFixture("mutated-document.docx");
const addedCustomPart = loadFixture("added-custom-part.docx");
const recompressed = loadFixture("recompressed-baseline.docx");

const CONTENT_LOSS_KINDS = new Set([
  "missing_in_after",
  "crc_changed",
  "uncompressed_size_changed",
]);

test("inventories every part of a minimal OOXML package with CRC and sizes", () => {
  const inventory = inventoryDocxPackage({ bytes: baseline });
  assert.ok(inventory);
  assert.equal(inventory.entryCount, 5);
  assert.deepEqual(
    inventory.parts.map((part) => part.name),
    [
      "[Content_Types].xml",
      "_rels/.rels",
      "word/document.xml",
      "word/_rels/document.xml.rels",
      "word/styles.xml",
    ],
  );
  for (const part of inventory.parts) {
    assert.equal(part.compressionMethod, 0);
    assert.equal(part.compressedSize, part.uncompressedSize);
    assert.equal(part.compressedPayload.byteLength, part.compressedSize);
    assert.ok(part.uncompressedSize > 0);
  }
});

test("rejects non-ZIP bytes instead of inventing a false inventory", () => {
  assert.equal(
    inventoryDocxPackage({ bytes: new Uint8Array([0x3c, 0x68, 0x74, 0x6d]) }),
    null,
  );
  assert.equal(inventoryDocxPackage({ bytes: new Uint8Array() }), null);
  assert.equal(
    inventoryDocxPackage({ bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]) }),
    null,
  );
});

test("an untouched round-trip is intact with no diffs", () => {
  const report = compareDocxPackages({ before: baseline, after: baseline });
  assert.equal(report.verdict, "intact");
  assert.equal(report.diffs.length, 0);
  assert.equal(report.contentLostPartNames.length, 0);
  assert.equal(report.contentPreservedPartNames.length, 5);
  assert.equal(isDocxFidelityDegraded({ report }), false);
  assert.match(summarizeDocxFidelityReport({ report }), /^Intact:/);
});

test("dropping word/styles.xml is degraded content loss, not packaging noise", () => {
  const report = compareDocxPackages({
    before: baseline,
    after: missingStyles,
  });
  assert.equal(report.verdict, "degraded");
  assert.equal(isDocxFidelityDegraded({ report }), true);
  assert.ok(
    report.diffs.some(
      (diff) =>
        diff.kind === "missing_in_after" && diff.partName === "word/styles.xml",
    ),
  );
  assert.deepEqual(report.contentLostPartNames, ["word/styles.xml"]);
  assert.ok(report.contentPreservedPartNames.includes("word/document.xml"));
  assert.match(summarizeDocxFidelityReport({ report }), /^Degraded:/);
});

test("mutating word/document.xml surfaces CRC and payload degradation", () => {
  const report = compareDocxPackages({
    before: baseline,
    after: mutatedDocument,
  });
  assert.equal(report.verdict, "degraded");
  assert.equal(isDocxFidelityDegraded({ report }), true);

  const documentDiffs = report.diffs.filter(
    (diff) => diff.partName === "word/document.xml",
  );
  const kinds = new Set(documentDiffs.map((diff) => diff.kind));
  assert.ok(kinds.has("crc_changed"));
  assert.ok(kinds.has("payload_changed"));
  assert.ok(kinds.has("uncompressed_size_changed") || kinds.has("compressed_size_changed"));
  assert.ok(report.contentLostPartNames.includes("word/document.xml"));
  assert.ok(report.contentPreservedPartNames.includes("word/styles.xml"));
});

test("an added customXml part alone is packaging drift, not content loss", () => {
  const report = compareDocxPackages({
    before: baseline,
    after: addedCustomPart,
  });
  assert.equal(report.verdict, "packaging_drift");
  assert.equal(isDocxFidelityDegraded({ report }), false);
  assert.ok(
    report.diffs.some(
      (diff) =>
        diff.kind === "added_in_after" &&
        diff.partName === "customXml/item1.xml",
    ),
  );
  assert.equal(report.contentLostPartNames.length, 0);
  assert.equal(report.contentPreservedPartNames.length, 5);
  assert.match(summarizeDocxFidelityReport({ report }), /^Packaging drift only:/);
});

test("recompressing the same uncompressed bytes is packaging drift, not content loss", () => {
  const report = compareDocxPackages({
    before: baseline,
    after: recompressed,
  });
  assert.equal(report.verdict, "packaging_drift");
  assert.equal(isDocxFidelityDegraded({ report }), false);

  const kinds = new Set(report.diffs.map((diff) => diff.kind));
  assert.ok(kinds.has("compression_method_changed"));
  assert.ok(kinds.has("payload_changed"));
  for (const kind of CONTENT_LOSS_KINDS) {
    assert.equal(kinds.has(kind), false, `unexpected content-loss kind ${kind}`);
  }
  assert.equal(report.contentLostPartNames.length, 0);
  assert.equal(report.contentPreservedPartNames.length, 5);

  const beforeParts = inventoryDocxPackage({ bytes: baseline }).parts;
  const afterParts = inventoryDocxPackage({ bytes: recompressed }).parts;
  for (let index = 0; index < beforeParts.length; index += 1) {
    assert.equal(beforeParts[index].name, afterParts[index].name);
    assert.equal(beforeParts[index].crc32, afterParts[index].crc32);
    assert.equal(
      beforeParts[index].uncompressedSize,
      afterParts[index].uncompressedSize,
    );
    assert.equal(beforeParts[index].compressionMethod, 0);
    assert.equal(afterParts[index].compressionMethod, 8);
    assert.notEqual(
      beforeParts[index].compressedSize,
      afterParts[index].compressedSize,
    );
  }
});

test("inventories a deflated OOXML package (method 8) without treating it as unreadable", () => {
  const inventory = inventoryDocxPackage({ bytes: recompressed });
  assert.ok(inventory);
  assert.equal(inventory.entryCount, 5);
  assert.ok(inventory.parts.every((part) => part.compressionMethod === 8));
  assert.ok(
    inventory.parts.every(
      (part) => part.compressedPayload.byteLength === part.compressedSize,
    ),
  );
  // At least one part must differ in compressed size from the stored baseline
  // so the fixture is a real recompression, not a method-bit flip.
  const baselineParts = inventoryDocxPackage({ bytes: baseline }).parts;
  assert.ok(
    inventory.parts.some(
      (part, index) =>
        part.compressedSize !== baselineParts[index].compressedSize,
    ),
  );
});

test("the harness tells a degraded package from an intact one in a blind pair", () => {
  const intact = compareDocxPackages({ before: baseline, after: baseline });
  const degraded = compareDocxPackages({
    before: baseline,
    after: missingStyles,
  });

  assert.equal(intact.verdict, "intact");
  assert.equal(degraded.verdict, "degraded");
  assert.notEqual(intact.verdict, degraded.verdict);
  assert.ok(degraded.contentLostPartNames.length > intact.contentLostPartNames.length);
});

test("unreadable after bytes yield an unreadable verdict instead of a false intact", () => {
  const report = compareDocxPackages({
    before: baseline,
    after: new Uint8Array([0x00, 0x01, 0x02]),
  });
  assert.equal(report.verdict, "unreadable");
  assert.equal(report.beforeReadable, true);
  assert.equal(report.afterReadable, false);
  assert.equal(isDocxFidelityDegraded({ report }), false);
  assert.match(summarizeDocxFidelityReport({ report }), /^Unreadable:/);
});

test("unreadable before bytes yield an unreadable verdict instead of a false intact", () => {
  const report = compareDocxPackages({
    before: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
    after: baseline,
  });
  assert.equal(report.verdict, "unreadable");
  assert.equal(report.beforeReadable, false);
  assert.equal(report.afterReadable, true);
  assert.equal(isDocxFidelityDegraded({ report }), false);
  assert.match(summarizeDocxFidelityReport({ report }), /^Unreadable:/);
});

test("minimal baseline retains required OOXML shell parts", () => {
  const inventory = inventoryDocxPackage({ bytes: baseline });
  assert.ok(inventory);
  assert.equal(packageHasRequiredDocxParts({ inventory }), true);
  for (const name of REQUIRED_DOCX_PART_NAMES) {
    assert.ok(inventory.parts.some((part) => part.name === name));
  }
});

test("content integrity reads baseline body text from stored and deflated packages", async () => {
  const storedXml = await extractDocxDocumentXml({ bytes: baseline });
  const deflatedXml = await extractDocxDocumentXml({ bytes: recompressed });
  assert.ok(storedXml);
  assert.ok(deflatedXml);
  assert.equal(storedXml, deflatedXml);

  const plain = extractDocxBodyPlainText({ documentXml: storedXml });
  assert.match(plain, /Planevo fidelity baseline/);

  const integrity = await assertDocxContentIntegrity({
    bytes: recompressed,
    requiredFragments: ["Planevo fidelity baseline"],
  });
  assert.equal(integrity.verdict, "content_preserved");
  assert.equal(integrity.emptyBody, false);
  assert.match(summarizeDocxContentIntegrityReport({ report: integrity }), /^Content preserved:/);
});

test("content integrity fails when required edited fragments are absent", async () => {
  const integrity = await assertDocxContentIntegrity({
    bytes: baseline,
    requiredFragments: ["This fragment was never in the fixture"],
  });
  assert.equal(integrity.verdict, "content_lost");
  assert.deepEqual(integrity.missingFragments, [
    "This fragment was never in the fixture",
  ]);
  assert.match(summarizeDocxContentIntegrityReport({ report: integrity }), /^Content lost:/);
});

test("content integrity rejects an unreadable ZIP instead of inventing preserved text", async () => {
  const integrity = await assertDocxContentIntegrity({
    bytes: new Uint8Array([0x00, 0x01]),
    requiredFragments: ["anything"],
  });
  assert.equal(integrity.verdict, "structurally_invalid");
  assert.equal(integrity.packageReadable, false);
  assert.match(
    summarizeDocxContentIntegrityReport({ report: integrity }),
    /^Structurally invalid:/,
  );
});

test("missing word/document.xml is structurally invalid for content integrity", async () => {
  // Strip document.xml from the baseline inventory by rebuilding without it.
  const inventory = inventoryDocxPackage({ bytes: baseline });
  assert.ok(inventory);
  const kept = inventory.parts.filter((part) => part.name !== "word/document.xml");
  assert.ok(kept.length < inventory.parts.length);

  const entries = [];
  for (const part of kept) {
    entries.push({
      name: part.name,
      content: part.compressedPayload,
      compressionMethod: part.compressionMethod,
      crc32: part.crc32,
      uncompressedSize: part.uncompressedSize,
    });
  }
  const stripped = buildZipFromParts(entries);
  assert.equal(
    packageHasRequiredDocxParts({
      inventory: inventoryDocxPackage({ bytes: stripped }),
    }),
    false,
  );

  const integrity = await assertDocxContentIntegrity({
    bytes: stripped,
    requiredFragments: ["Planevo fidelity baseline"],
  });
  assert.equal(integrity.verdict, "structurally_invalid");
  assert.ok(integrity.missingRequiredParts.includes("word/document.xml"));
});

test("deriveRequiredFragmentsFromMarkdown keeps headings and paragraphs", () => {
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

  const report = await evaluateMarkdownDocxRoundTrip({ markdown });
  assert.equal(report.verdict, "content_preserved", report.reason ?? undefined);
  assert.ok(report.exportedBytes);
  assert.equal(report.packageIntegrity?.verdict, "content_preserved");
  assert.ok(report.reimportedMarkdown);
  // Mammoth may escape punctuation (save\-back\.); fragment gate already
  // normalizes — assert the same fragments survived.
  assert.deepEqual(report.missingAfterImport, []);
  assert.match(report.reimportedMarkdown, /Vendor Portal/);
  assert.match(report.reimportedMarkdown, /Body paragraph kept through save\\?-back/);
  assert.match(report.reimportedMarkdown, /Nested heading/);
  assert.match(report.reimportedMarkdown, /alpha item/);
  assert.match(report.reimportedMarkdown, /beta item/);
  assert.equal(report.packageCompare, null);
});

test("markdown save can be content-preserved while package compare reports degraded document.xml", async () => {
  const markdown = "# Edited Title\n\nKept paragraph after surgery.\n";
  const report = await evaluateMarkdownDocxRoundTrip({
    markdown,
    requiredFragments: ["Edited Title", "Kept paragraph after surgery"],
    basePackage: baseline,
  });

  assert.equal(report.verdict, "content_preserved", report.reason ?? undefined);
  assert.ok(report.packageCompare);
  // Intentionally rewritten body — package layer correctly says degraded, but
  // content integrity is the markdown-shell pass/fail bar.
  assert.equal(report.packageCompare.verdict, "degraded");
  assert.ok(
    report.packageCompare.contentLostPartNames.includes("word/document.xml"),
  );
  assert.ok(report.reimportedMarkdown?.includes("Edited Title"));
  assert.ok(report.reimportedMarkdown?.includes("Kept paragraph after surgery"));
});

test("packaging_drift vs degraded stays meaningful beside content integrity", async () => {
  const drift = compareDocxPackages({ before: baseline, after: recompressed });
  const degraded = compareDocxPackages({
    before: baseline,
    after: missingStyles,
  });
  assert.equal(drift.verdict, "packaging_drift");
  assert.equal(degraded.verdict, "degraded");
  assert.notEqual(drift.verdict, degraded.verdict);

  // Same uncompressed body text survives recompression — content intact.
  const driftIntegrity = await assertDocxContentIntegrity({
    bytes: recompressed,
    requiredFragments: ["Planevo fidelity baseline"],
  });
  assert.equal(driftIntegrity.verdict, "content_preserved");

  // Dropping styles is package-degraded; body text can still be present.
  const stylesIntegrity = await assertDocxContentIntegrity({
    bytes: missingStyles,
    requiredFragments: ["Planevo fidelity baseline"],
  });
  assert.equal(stylesIntegrity.verdict, "content_preserved");
});

test("content integrity fails an empty body when edited fragments were expected", async () => {
  // Export empty markdown (valid empty body) then assert fragments expected.
  const emptyTrip = await evaluateMarkdownDocxRoundTrip({
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
