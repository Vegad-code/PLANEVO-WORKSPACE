import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  PDF_IMPORT_ENCRYPTED_BANNER,
  PDF_IMPORT_LIMITS_BANNER,
  PDF_IMPORT_SCANNED_BANNER,
  importPdfToMarkdown,
  pdfImportBannerText,
  textItemsToMarkdown,
} from "./pdf-import.ts";
import {
  findPdfHeaderOffset,
  validatePdfBytes,
} from "./pdf-structure.ts";

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
    pageError = null,
  } = options;
  return () => ({
    promise: openError
      ? Promise.reject(openError)
      : Promise.resolve({
          numPages,
          getPage: async (pageNumber) => {
            if (pageError) throw pageError;
            return {
              getTextContent: async () => ({
                items: itemsByPage[pageNumber - 1] ?? [],
              }),
            };
          },
          destroy: async () => {},
        }),
  });
}

function passwordError() {
  const error = new Error("No password given");
  error.name = "PasswordException";
  error.code = 1;
  return error;
}

test("textItemsToMarkdown groups nearby items into paragraphs", () => {
  const markdown = textItemsToMarkdown([
    {
      pageNumber: 1,
      items: [
        { str: "Hello", transform: [1, 0, 0, 1, 50, 700] },
        { str: "world", transform: [1, 0, 0, 1, 90, 700] },
        { str: "Next", transform: [1, 0, 0, 1, 50, 660] },
        { str: "paragraph", transform: [1, 0, 0, 1, 90, 660] },
      ],
    },
  ]);
  assert.match(markdown, /Hello world/);
  assert.match(markdown, /Next paragraph/);
  assert.ok(markdown.includes("\n\n"));
});

test("textItemsToMarkdown sorts out-of-order items into reading order", () => {
  const markdown = textItemsToMarkdown([
    {
      pageNumber: 1,
      items: [
        { str: "second", transform: [1, 0, 0, 1, 50, 650] },
        { str: "first", transform: [1, 0, 0, 1, 50, 700] },
        { str: "line", transform: [1, 0, 0, 1, 90, 700] },
      ],
    },
  ]);
  assert.match(markdown, /first line/);
  assert.ok(markdown.indexOf("first") < markdown.indexOf("second"));
});

test("textItemsToMarkdown honors hasEOL as a soft line break", () => {
  const markdown = textItemsToMarkdown([
    {
      pageNumber: 1,
      items: [
        { str: "Line", transform: [1, 0, 0, 1, 50, 700], hasEOL: true },
        { str: "Break", transform: [1, 0, 0, 1, 50, 698] },
      ],
    },
  ]);
  assert.match(markdown, /Line/);
  assert.match(markdown, /Break/);
});

test("findPdfHeaderOffset tolerates leading junk before %PDF", () => {
  const encoder = new TextEncoder();
  const junk = encoder.encode("\n\r  ");
  const body = fixture("minimal-text.pdf");
  const padded = new Uint8Array(junk.byteLength + body.byteLength);
  padded.set(junk, 0);
  padded.set(body, junk.byteLength);
  assert.equal(findPdfHeaderOffset(padded), junk.byteLength);
  assert.equal(validatePdfBytes(padded), true);
});

test("validatePdfBytes rejects truncated packages without %%EOF", () => {
  const truncated = new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\n");
  assert.equal(findPdfHeaderOffset(truncated), 0);
  assert.equal(validatePdfBytes(truncated), false);
});

test("importPdfToMarkdown extracts editable text from a text PDF", async () => {
  const result = await importPdfToMarkdown({
    bytes: fixture("minimal-text.pdf"),
  });
  assert.equal(result.kind, "ok");
  assert.match(result.markdown, /Planevo PDF Fixture/);
  assert.match(result.markdown, /Second paragraph/);
  assert.deepEqual(result.warnings, [PDF_IMPORT_LIMITS_BANNER]);
  assert.equal(
    pdfImportBannerText({ warnings: result.warnings }),
    PDF_IMPORT_LIMITS_BANNER,
  );
});

test("importPdfToMarkdown keeps multi-paragraph structure from a fixture PDF", async () => {
  const result = await importPdfToMarkdown({
    bytes: fixture("multi-paragraph.pdf"),
  });
  assert.equal(result.kind, "ok");
  assert.match(result.markdown, /Heading One/);
  assert.match(result.markdown, /Paragraph alpha/);
  assert.match(result.markdown, /Paragraph beta/);
  assert.match(
    result.markdown,
    /Heading One\s*\n\nParagraph alpha[\s\S]*\n\nParagraph beta/,
  );
});

test("importPdfToMarkdown returns preview-only for a blank scanned PDF", async () => {
  const result = await importPdfToMarkdown({
    bytes: fixture("scanned-blank.pdf"),
  });
  assert.equal(result.kind, "preview-only");
  assert.equal(result.reason, "scanned");
  assert.equal(result.error, PDF_IMPORT_SCANNED_BANNER);
  assert.deepEqual(result.warnings, [PDF_IMPORT_SCANNED_BANNER]);
  assert.equal(
    pdfImportBannerText({ warnings: result.warnings }),
    PDF_IMPORT_SCANNED_BANNER,
  );
});

test("importPdfToMarkdown rejects empty bytes without throwing", async () => {
  const result = await importPdfToMarkdown({ bytes: new Uint8Array() });
  assert.deepEqual(result, {
    kind: "error",
    error: "PDF bytes are empty or invalid.",
  });
});

test("importPdfToMarkdown rejects non-PDF bytes", async () => {
  const result = await importPdfToMarkdown({
    bytes: new TextEncoder().encode("not a pdf"),
  });
  assert.equal(result.kind, "error");
  assert.match(result.error, /not a valid PDF/i);
});

test("importPdfToMarkdown still extracts text when %PDF is preceded by leading junk", async () => {
  const body = fixture("minimal-text.pdf");
  const junk = new TextEncoder().encode("\n\r  ");
  const padded = new Uint8Array(junk.byteLength + body.byteLength);
  padded.set(junk, 0);
  padded.set(body, junk.byteLength);

  const result = await importPdfToMarkdown({ bytes: padded });
  assert.equal(result.kind, "ok");
  assert.match(result.markdown, /Planevo PDF Fixture/);
});

test("importPdfToMarkdown rejects truncated PDF bytes missing %%EOF", async () => {
  const result = await importPdfToMarkdown({
    bytes: new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\n"),
  });
  assert.equal(result.kind, "error");
  assert.match(result.error, /incomplete|corrupt/i);
});

test("importPdfToMarkdown uses the injected getDocument seam", async () => {
  const result = await importPdfToMarkdown({
    bytes: new TextEncoder().encode("%PDF-1.4 fake"),
    getDocument: fakeGetDocument({
      itemsByPage: [
        [
          {
            str: "Injected editable paragraph content here",
            transform: [1, 0, 0, 1, 50, 700],
          },
        ],
      ],
    }),
  });
  assert.equal(result.kind, "ok");
  assert.match(result.markdown, /Injected editable paragraph/);
  assert.ok(result.warnings.includes(PDF_IMPORT_LIMITS_BANNER));
});

test("importPdfToMarkdown returns preview-only when extractable text is too short", async () => {
  const result = await importPdfToMarkdown({
    bytes: new TextEncoder().encode("%PDF-1.4 fake"),
    getDocument: fakeGetDocument({
      itemsByPage: [[{ str: "hi", transform: [1, 0, 0, 1, 50, 700] }]],
    }),
  });
  assert.equal(result.kind, "preview-only");
  assert.equal(result.reason, "empty");
  assert.equal(result.error, PDF_IMPORT_SCANNED_BANNER);
});

test("importPdfToMarkdown returns preview-only when pages have no text items", async () => {
  const result = await importPdfToMarkdown({
    bytes: new TextEncoder().encode("%PDF-1.4 fake"),
    getDocument: fakeGetDocument({
      numPages: 2,
      itemsByPage: [[], []],
    }),
  });
  assert.equal(result.kind, "preview-only");
  assert.equal(result.reason, "scanned");
  assert.deepEqual(result.warnings, [PDF_IMPORT_SCANNED_BANNER]);
});

test("importPdfToMarkdown returns preview-only for password-protected PDFs", async () => {
  const result = await importPdfToMarkdown({
    bytes: new TextEncoder().encode("%PDF-1.4 fake"),
    getDocument: fakeGetDocument({ openError: passwordError() }),
  });
  assert.equal(result.kind, "preview-only");
  assert.equal(result.reason, "encrypted");
  assert.equal(result.error, PDF_IMPORT_ENCRYPTED_BANNER);
  assert.equal(
    pdfImportBannerText({ warnings: result.warnings }),
    PDF_IMPORT_ENCRYPTED_BANNER,
  );
});

test("importPdfToMarkdown keeps preview-only when page text extraction fails", async () => {
  const result = await importPdfToMarkdown({
    bytes: new TextEncoder().encode("%PDF-1.4 fake"),
    getDocument: fakeGetDocument({
      pageError: new Error("getTextContent exploded"),
    }),
  });
  assert.equal(result.kind, "preview-only");
  assert.equal(result.reason, "unreadable");
  assert.match(result.warnings[0] ?? "", /could not extract text/i);
  assert.match(result.warnings[0] ?? "", /Preview stays available/);
});

test("importPdfToMarkdown keeps preview-only when getDocument rejects as unreadable", async () => {
  const result = await importPdfToMarkdown({
    bytes: new TextEncoder().encode("%PDF-1.4 fake"),
    getDocument: fakeGetDocument({
      openError: new Error("Invalid PDF structure."),
    }),
  });
  assert.equal(result.kind, "preview-only");
  assert.equal(result.reason, "unreadable");
  assert.match(result.warnings[0] ?? "", /Invalid PDF structure/);
});

test("pdfImportBannerText stays null when there are no warnings", () => {
  assert.equal(pdfImportBannerText({ warnings: [] }), null);
});
