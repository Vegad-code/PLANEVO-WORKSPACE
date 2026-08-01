import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

import { validateDocxBytes } from "../../features/files-product/docx-document-transport.ts";
import { importDocxToMarkdown } from "./docx-import.ts";
import {
  DOCX_EXPORT_FIDELITY_WARNING,
  DOCX_EXPORT_LIMITS_BANNER,
  DOCX_EXPORT_SHELL_FALLBACK_WARNING,
  docxExportBannerText,
  exportMarkdownToDocx,
  parseMarkdownBlocks,
} from "./docx-export.ts";

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../tmp/docx-fixtures",
);

const decoder = new TextDecoder("utf-8");

function readUint16(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32(bytes, offset) {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function findEocd(bytes) {
  for (let i = bytes.byteLength - 22; i >= 0; i -= 1) {
    if (readUint32(bytes, i) === 0x06054b50) {
      return {
        entryCount: readUint16(bytes, i + 10),
        centralDirectorySize: readUint32(bytes, i + 12),
        centralDirectoryOffset: readUint32(bytes, i + 16),
      };
    }
  }
  return null;
}

/** Inflate or copy a named ZIP entry from an exported package. */
function readZipEntry(bytes, targetName) {
  const end = findEocd(bytes);
  assert.ok(end);
  let cursor = end.centralDirectoryOffset;
  for (let index = 0; index < end.entryCount; index += 1) {
    assert.equal(readUint32(bytes, cursor), 0x02014b50);
    const compressionMethod = readUint16(bytes, cursor + 10);
    const compressedSize = readUint32(bytes, cursor + 20);
    const filenameLength = readUint16(bytes, cursor + 28);
    const extraLength = readUint16(bytes, cursor + 30);
    const commentLength = readUint16(bytes, cursor + 32);
    const localHeaderOffset = readUint32(bytes, cursor + 42);
    const name = decoder.decode(
      bytes.subarray(cursor + 46, cursor + 46 + filenameLength),
    );
    if (name === targetName) {
      const localNameLength = readUint16(bytes, localHeaderOffset + 26);
      const localExtraLength = readUint16(bytes, localHeaderOffset + 28);
      const dataOffset =
        localHeaderOffset + 30 + localNameLength + localExtraLength;
      const payload = bytes.subarray(dataOffset, dataOffset + compressedSize);
      if (compressionMethod === 0) return payload.slice();
      if (compressionMethod === 8) return inflateRawSync(payload);
      throw new Error(`unsupported method ${compressionMethod}`);
    }
    cursor += 46 + filenameLength + extraLength + commentLength;
  }
  return null;
}

function documentXmlOf(bytes) {
  const entry = readZipEntry(bytes, "word/document.xml");
  assert.ok(entry, "expected word/document.xml");
  return decoder.decode(entry);
}

test("exports plain markdown into a package that passes validateDocxBytes", async () => {
  const result = await exportMarkdownToDocx({
    markdown: "Hello Planevo export.\n",
  });

  assert.equal(result.kind, "ok");
  assert.equal(validateDocxBytes(result.bytes), true);
  assert.match(documentXmlOf(result.bytes), /Hello Planevo export\./);
  assert.ok(result.warnings.includes(DOCX_EXPORT_FIDELITY_WARNING));
  assert.equal(
    docxExportBannerText({ warnings: result.warnings }),
    DOCX_EXPORT_LIMITS_BANNER,
  );
});

test("exports headings, bold, and italic as structured OOXML", async () => {
  const result = await exportMarkdownToDocx({
    markdown: "# Title One\n\n**bold** and *italic*\n",
  });

  assert.equal(result.kind, "ok");
  assert.equal(validateDocxBytes(result.bytes), true);
  const xml = documentXmlOf(result.bytes);
  assert.match(xml, /w:pStyle w:val="Heading1"/);
  assert.match(xml, /<w:b\/>/);
  assert.match(xml, /<w:i\/>/);
  assert.match(xml, />Title One</);
  assert.match(xml, />bold</);
  assert.match(xml, />italic</);
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

  const exported = await exportMarkdownToDocx({ markdown });
  assert.equal(exported.kind, "ok");
  assert.equal(validateDocxBytes(exported.bytes), true);

  const imported = await importDocxToMarkdown({ bytes: exported.bytes });
  assert.equal(imported.kind, "ok");
  assert.match(imported.markdown, /Vendor Portal/);
  assert.match(imported.markdown, /Body paragraph/);
  assert.match(imported.markdown, /alpha/);
  assert.match(imported.markdown, /beta/);
  assert.match(imported.markdown, /first/);
  assert.match(imported.markdown, /second/);
});

test("exports empty markdown as a valid empty-body DOCX", async () => {
  const result = await exportMarkdownToDocx({ markdown: "" });

  assert.equal(result.kind, "ok");
  assert.equal(validateDocxBytes(result.bytes), true);
  const xml = documentXmlOf(result.bytes);
  assert.match(xml, /<w:body>/);
  assert.match(xml, /<w:sectPr\/>/);
  assert.doesNotMatch(xml, /Invented text/);
});

test("escapes XML-significant characters in body text", async () => {
  const result = await exportMarkdownToDocx({
    markdown: 'Use <tag> & "quotes" safely.\n',
  });

  assert.equal(result.kind, "ok");
  const xml = documentXmlOf(result.bytes);
  assert.match(xml, /&lt;tag&gt;/);
  assert.match(xml, /&amp;/);
  assert.match(xml, /&quot;quotes&quot;/);
  assert.doesNotMatch(xml, /<tag>/);
});

test("exports links with visible href text (honest V1)", async () => {
  const result = await exportMarkdownToDocx({
    markdown: "See [Planevo](https://example.com/docs) today.\n",
  });

  assert.equal(result.kind, "ok");
  const xml = documentXmlOf(result.bytes);
  assert.match(xml, /Planevo/);
  assert.match(xml, /https:\/\/example\.com\/docs/);
});

test("exports tables without dropping cell text", async () => {
  const result = await exportMarkdownToDocx({
    markdown: ["| A | B |", "| --- | --- |", "| one | two |"].join("\n"),
  });

  assert.equal(result.kind, "ok");
  assert.equal(validateDocxBytes(result.bytes), true);
  const xml = documentXmlOf(result.bytes);
  assert.match(xml, /<w:tbl>/);
  assert.match(xml, />one</);
  assert.match(xml, />two</);
});

test("package surgery preserves styles.xml from the base package", async () => {
  const base = new Uint8Array(
    readFileSync(join(fixturesDir, "minimal-baseline.docx")),
  );
  const baseStyles = readZipEntry(base, "word/styles.xml");
  assert.ok(baseStyles);

  const result = await exportMarkdownToDocx({
    markdown: "# Surgically edited\n\nNew body text.\n",
    basePackage: base,
  });

  assert.equal(result.kind, "ok");
  assert.equal(validateDocxBytes(result.bytes), true);
  assert.doesNotMatch(
    result.warnings.join("\n"),
    new RegExp(DOCX_EXPORT_SHELL_FALLBACK_WARNING),
  );

  const exportedStyles = readZipEntry(result.bytes, "word/styles.xml");
  assert.ok(exportedStyles);
  assert.deepEqual(exportedStyles, baseStyles);

  const xml = documentXmlOf(result.bytes);
  assert.match(xml, /Surgically edited/);
  assert.match(xml, /New body text/);
  assert.doesNotMatch(xml, /Planevo fidelity baseline/);
});

test("falls back to a clean package when basePackage is empty", async () => {
  const result = await exportMarkdownToDocx({
    markdown: "Fallback body\n",
    basePackage: new Uint8Array(),
  });

  assert.equal(result.kind, "ok");
  assert.equal(validateDocxBytes(result.bytes), true);
  assert.ok(result.warnings.includes(DOCX_EXPORT_SHELL_FALLBACK_WARNING));
  assert.match(documentXmlOf(result.bytes), /Fallback body/);
});

test("falls back to a clean package when basePackage is not a ZIP", async () => {
  const result = await exportMarkdownToDocx({
    markdown: "Recovered content\n",
    basePackage: new TextEncoder().encode("not-a-docx"),
  });

  assert.equal(result.kind, "ok");
  assert.equal(validateDocxBytes(result.bytes), true);
  assert.ok(result.warnings.includes(DOCX_EXPORT_SHELL_FALLBACK_WARNING));
  assert.match(documentXmlOf(result.bytes), /Recovered content/);
});

test("rejects non-string markdown without throwing", async () => {
  const result = await exportMarkdownToDocx({
    // @ts-expect-error intentional failure-mode probe
    markdown: 42,
  });

  assert.deepEqual(result, {
    kind: "error",
    error: "Markdown must be a string.",
  });
});

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
