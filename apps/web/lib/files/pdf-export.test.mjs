import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, StandardFonts } from "pdf-lib";

import {
  PDF_EXPORT_FIDELITY_WARNING,
  PDF_EXPORT_LIMITS_BANNER,
  PDF_EXPORT_UNSUPPORTED_GLYPH_WARNING,
  exportMarkdownToPdf,
  parseMarkdownBlocks,
  pdfExportBannerText,
  sanitizeTextForStandardFont,
} from "./pdf-export.ts";
import { validatePdfBytes } from "./pdf-structure.ts";
import { importPdfToMarkdown } from "./pdf-import.ts";

test("parseMarkdownBlocks recognizes headings, lists, and code fences", () => {
  const blocks = parseMarkdownBlocks(
    ["## Sub", "", "- item", "", "```", "code", "```"].join("\n"),
  );

  assert.equal(blocks[0]?.kind, "heading");
  assert.equal(blocks[0]?.level, 2);
  assert.equal(blocks[1]?.kind, "ul");
  assert.equal(blocks[2]?.kind, "code_block");
  assert.equal(blocks[2]?.text, "code");
});

test("parseMarkdownBlocks understands ordered lists paragraphs and blockquotes", () => {
  const blocks = parseMarkdownBlocks(
    "# Title\n\nHello **world**.\n\n- one\n- two\n\n1. alpha\n\n> quoted\n",
  );
  assert.equal(blocks[0].kind, "heading");
  assert.equal(blocks[0].level, 1);
  assert.equal(blocks[1].kind, "paragraph");
  assert.equal(blocks[2].kind, "ul");
  assert.equal(blocks[3].kind, "ol");
  assert.equal(blocks[4].kind, "blockquote");
});

test("exports plain markdown into bytes that pass validatePdfBytes", async () => {
  const result = await exportMarkdownToPdf({
    markdown: "Hello Planevo export.\n",
  });

  assert.equal(result.kind, "ok");
  assert.equal(validatePdfBytes(result.bytes), true);
  assert.ok(result.warnings.includes(PDF_EXPORT_FIDELITY_WARNING));
  assert.equal(
    pdfExportBannerText({ warnings: result.warnings }),
    PDF_EXPORT_LIMITS_BANNER,
  );

  const reimported = await importPdfToMarkdown({ bytes: result.bytes });
  assert.equal(reimported.kind, "ok");
  assert.match(reimported.markdown, /Hello Planevo export/);
});

test("round-trips edited content through import without silent paragraph loss", async () => {
  const markdown = [
    "# Vendor Portal",
    "",
    "Body paragraph with __emphasis__.",
    "",
    "- alpha",
    "- beta",
    "",
    "1. first",
    "2. second",
  ].join("\n");

  const exported = await exportMarkdownToPdf({ markdown });
  assert.equal(exported.kind, "ok");
  assert.equal(validatePdfBytes(exported.bytes), true);

  const imported = await importPdfToMarkdown({ bytes: exported.bytes });
  assert.equal(imported.kind, "ok");
  assert.match(imported.markdown, /Vendor Portal/);
  assert.match(imported.markdown, /Body paragraph/);
  assert.match(imported.markdown, /alpha/);
  assert.match(imported.markdown, /beta/);
  assert.match(imported.markdown, /first/);
  assert.match(imported.markdown, /second/);
});

test("exports empty markdown as a valid empty-body PDF", async () => {
  const result = await exportMarkdownToPdf({ markdown: "" });

  assert.equal(result.kind, "ok");
  assert.equal(validatePdfBytes(result.bytes), true);
  const doc = await PDFDocument.load(result.bytes);
  assert.ok(doc.getPageCount() >= 1);
});

test("exports headings bold and italic without inventing layout fidelity", async () => {
  const result = await exportMarkdownToPdf({
    markdown: "# Title One\n\n**bold** and *italic*\n",
  });

  assert.equal(result.kind, "ok");
  assert.equal(validatePdfBytes(result.bytes), true);
  assert.ok(result.warnings.includes(PDF_EXPORT_FIDELITY_WARNING));

  const imported = await importPdfToMarkdown({ bytes: result.bytes });
  assert.equal(imported.kind, "ok");
  assert.match(imported.markdown, /Title One/);
  assert.match(imported.markdown, /bold/);
  assert.match(imported.markdown, /italic/);
});

test("exports links with visible label and href text (honest V1)", async () => {
  const result = await exportMarkdownToPdf({
    markdown: "See [Planevo](https://example.com/docs) today.\n",
  });

  assert.equal(result.kind, "ok");
  const imported = await importPdfToMarkdown({ bytes: result.bytes });
  assert.equal(imported.kind, "ok");
  assert.match(imported.markdown, /Planevo/);
  assert.match(imported.markdown, /https:\/\/example\.com\/docs/);
});

test("exports tables without dropping cell text", async () => {
  const result = await exportMarkdownToPdf({
    markdown: ["| A | B |", "| --- | --- |", "| one | two |"].join("\n"),
  });

  assert.equal(result.kind, "ok");
  assert.equal(validatePdfBytes(result.bytes), true);
  const imported = await importPdfToMarkdown({ bytes: result.bytes });
  assert.equal(imported.kind, "ok");
  assert.match(imported.markdown, /one/);
  assert.match(imported.markdown, /two/);
});

test("preserves code-fence line breaks instead of collapsing them", async () => {
  const result = await exportMarkdownToPdf({
    markdown: ["Before", "", "```", "const x = 1;", "const y = 2;", "```", "", "After fence stays."].join(
      "\n",
    ),
  });

  assert.equal(result.kind, "ok");
  const imported = await importPdfToMarkdown({ bytes: result.bytes });
  assert.equal(imported.kind, "ok");
  assert.match(imported.markdown, /const x = 1/);
  assert.match(imported.markdown, /const y = 2/);
  assert.match(imported.markdown, /After fence stays/);
});

test("replaces unsupported glyphs instead of aborting the export", async () => {
  const result = await exportMarkdownToPdf({
    markdown: "# Status\n\nEmoji probe 🚀 and check ✓ stay replaced honestly.\n",
  });

  assert.equal(result.kind, "ok", result.kind === "error" ? result.error : "");
  assert.equal(validatePdfBytes(result.bytes), true);
  assert.ok(result.warnings.includes(PDF_EXPORT_UNSUPPORTED_GLYPH_WARNING));

  const imported = await importPdfToMarkdown({ bytes: result.bytes });
  assert.equal(imported.kind, "ok");
  assert.match(imported.markdown, /Emoji probe/);
  assert.match(imported.markdown, /stay replaced honestly/);
});

test("sanitizeTextForStandardFont replaces WinAnsi-unsupported code points", async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const sanitized = sanitizeTextForStandardFont({
    text: "ok 🚀 done",
    font,
  });
  assert.equal(sanitized.replaced, true);
  assert.match(sanitized.text, /ok \? done/);
});

test("rejects non-string markdown without throwing", async () => {
  const result = await exportMarkdownToPdf({
    // @ts-expect-error intentional failure-mode probe
    markdown: 42,
  });

  assert.deepEqual(result, {
    kind: "error",
    error: "Markdown must be a string.",
  });
});

test("paginated long body still reimports the tail paragraph", async () => {
  // Enough short paragraphs to overflow one letter page (≈40 lines of body).
  const body = Array.from(
    { length: 80 },
    (_, index) => `Paragraph ${index + 1} fills the page deliberately.`,
  ).join("\n\n");
  const markdown = `# Multi\n\n${body}\n\nTail paragraph survives pagination.\n`;
  const result = await exportMarkdownToPdf({ markdown });
  assert.equal(result.kind, "ok");
  const doc = await PDFDocument.load(result.bytes);
  assert.ok(
    doc.getPageCount() >= 2,
    `expected multi-page export, got ${doc.getPageCount()}`,
  );

  const imported = await importPdfToMarkdown({ bytes: result.bytes });
  assert.equal(imported.kind, "ok");
  assert.match(imported.markdown, /Tail paragraph survives pagination/);
  assert.match(imported.markdown, /Paragraph 1 fills the page deliberately/);
});

test("CRLF markdown normalizes without inventing content", async () => {
  const result = await exportMarkdownToPdf({
    markdown: "Line one\r\n\r\nLine two after CRLF.\r\n",
  });
  assert.equal(result.kind, "ok");
  const imported = await importPdfToMarkdown({ bytes: result.bytes });
  assert.equal(imported.kind, "ok");
  assert.match(imported.markdown, /Line one/);
  assert.match(imported.markdown, /Line two after CRLF/);
});
