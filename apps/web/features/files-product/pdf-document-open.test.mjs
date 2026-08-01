import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PDF_IMPORT_ENCRYPTED_BANNER,
  PDF_IMPORT_LIMITS_BANNER,
  PDF_IMPORT_SCANNED_BANNER,
} from "../../lib/files/pdf-import.ts";
import { openPdfDocument } from "./pdf-document-open.ts";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../tmp/pdf-fixtures",
);

function fixture(name) {
  return new Uint8Array(readFileSync(join(fixturesDir, name)));
}

function fakeGetDocument(options) {
  const {
    numPages = 1,
    itemsByPage = [[]],
    openError = null,
  } = options;
  return () => ({
    promise: openError
      ? Promise.reject(openError)
      : Promise.resolve({
          numPages,
          getPage: async (pageNumber) => ({
            getTextContent: async () => ({
              items: itemsByPage[pageNumber - 1] ?? [],
            }),
          }),
          destroy: async () => {},
        }),
  });
}

test("openPdfDocument marks text PDFs editable and copies source bytes", async () => {
  const bytes = fixture("minimal-text.pdf");
  const result = await openPdfDocument({ bytes });
  assert.equal(result.kind, "editable");
  assert.match(result.markdown, /Planevo PDF Fixture/);
  assert.ok(result.bannerText);
  assert.equal(result.bannerText, PDF_IMPORT_LIMITS_BANNER);
  assert.ok(result.warnings.includes(PDF_IMPORT_LIMITS_BANNER));
  assert.equal(result.bytes.byteLength, bytes.byteLength);
  assert.notEqual(result.bytes.buffer, bytes.buffer);
  result.bytes[0] = 0;
  assert.notEqual(bytes[0], 0);
});

test("openPdfDocument keeps blank PDFs preview-only with an honest banner", async () => {
  const result = await openPdfDocument({ bytes: fixture("scanned-blank.pdf") });
  assert.equal(result.kind, "preview-only");
  assert.equal(result.reason, "scanned");
  assert.equal(result.bannerText, PDF_IMPORT_SCANNED_BANNER);
  assert.equal(result.error, PDF_IMPORT_SCANNED_BANNER);
});

test("openPdfDocument keeps multi-paragraph PDFs editable", async () => {
  const result = await openPdfDocument({
    bytes: fixture("multi-paragraph.pdf"),
  });
  assert.equal(result.kind, "editable");
  assert.match(result.markdown, /Paragraph alpha/);
  assert.match(result.markdown, /Paragraph beta/);
});

test("openPdfDocument rejects empty bytes as an open failure", async () => {
  const result = await openPdfDocument({ bytes: new Uint8Array() });
  assert.equal(result.kind, "error");
  assert.match(result.error, /empty/i);
});

test("openPdfDocument rejects garbage that is not a PDF", async () => {
  const result = await openPdfDocument({
    bytes: new TextEncoder().encode("not a pdf archive"),
  });
  assert.equal(result.kind, "error");
  assert.match(result.error, /not a valid PDF/i);
});

test("openPdfDocument keeps password-protected PDFs preview-only", async () => {
  const error = new Error("No password given");
  error.name = "PasswordException";
  error.code = 1;
  const result = await openPdfDocument({
    bytes: new TextEncoder().encode("%PDF-1.4 fake"),
    getDocument: fakeGetDocument({ openError: error }),
  });
  assert.equal(result.kind, "preview-only");
  assert.equal(result.reason, "encrypted");
  assert.equal(result.bannerText, PDF_IMPORT_ENCRYPTED_BANNER);
});

test("openPdfDocument keeps unscannable short-text PDFs preview-only", async () => {
  const result = await openPdfDocument({
    bytes: new TextEncoder().encode("%PDF-1.4 fake"),
    getDocument: fakeGetDocument({
      itemsByPage: [[{ str: "ab", transform: [1, 0, 0, 1, 50, 700] }]],
    }),
  });
  assert.equal(result.kind, "preview-only");
  assert.equal(result.reason, "empty");
  assert.equal(result.bannerText, PDF_IMPORT_SCANNED_BANNER);
});
