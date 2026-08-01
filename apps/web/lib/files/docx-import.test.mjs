import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

import {
  DOCX_IMPORT_LIMITS_BANNER,
  DOCX_IMPORT_PLAIN_TEXT_FALLBACK_WARNING,
  docxImportBannerText,
  importDocxToMarkdown,
} from "./docx-import.ts";

const encoder = new TextEncoder();
const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../tmp/docx-fixtures",
);

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

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.byteLength; i += 1) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * @param {Array<{ name: string, content: Uint8Array, compressionMethod?: 0 | 8 }>} entries
 */
function buildZip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const content = entry.content;
    const checksum = crc32(content);
    const method = entry.compressionMethod ?? 0;
    const payload = method === 8 ? deflateRawSync(content) : content;
    const local = Uint8Array.from([
      0x50, 0x4b, 0x03, 0x04,
      ...u16(20),
      ...u16(0),
      ...u16(method),
      ...u16(0),
      ...u16(0),
      ...u32(checksum),
      ...u32(payload.byteLength),
      ...u32(content.byteLength),
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
        ...u32(content.byteLength),
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

const CONTENT_TYPES = encoder.encode(
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
);

const RELS = encoder.encode(
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
);

const DOCUMENT_RELS = encoder.encode(
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
);

const STYLES = encoder.encode(
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
  </w:style>
</w:styles>`,
);

function packageWithDocumentXml(documentXml) {
  return buildZip([
    { name: "[Content_Types].xml", content: CONTENT_TYPES },
    { name: "_rels/.rels", content: RELS },
    { name: "word/document.xml", content: encoder.encode(documentXml) },
    { name: "word/_rels/document.xml.rels", content: DOCUMENT_RELS },
    { name: "word/styles.xml", content: STYLES },
  ]);
}

function richMarkdownFixture() {
  return packageWithDocumentXml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Title One</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:b/></w:rPr><w:t>bold</w:t></w:r>
      <w:r><w:t> and </w:t></w:r>
      <w:r><w:rPr><w:i/></w:rPr><w:t>italic</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="WeirdCustom"/></w:pPr>
      <w:r><w:t>custom style para</w:t></w:r>
    </w:p>
    <w:sectPr/>
  </w:body>
</w:document>`);
}

function emptyBodyFixture() {
  return packageWithDocumentXml(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p/>
    <w:sectPr/>
  </w:body>
</w:document>`);
}

test("imports a minimal fixture DOCX into markdown with body text", async () => {
  const bytes = new Uint8Array(
    readFileSync(join(fixturesDir, "minimal-baseline.docx")),
  );

  const result = await importDocxToMarkdown({ bytes });

  assert.equal(result.kind, "ok");
  assert.match(result.markdown, /Planevo fidelity baseline/);
  assert.deepEqual(result.warnings, []);
  assert.equal(docxImportBannerText({ warnings: result.warnings }), null);
});

test("imports headings, bold, and italic as markdown structure", async () => {
  const result = await importDocxToMarkdown({ bytes: richMarkdownFixture() });

  assert.equal(result.kind, "ok");
  assert.match(result.markdown, /^# Title One/m);
  assert.match(result.markdown, /__bold__/);
  assert.match(result.markdown, /\*italic\*/);
  assert.match(result.markdown, /custom style para/);
});

test("surfaces mammoth style warnings for the conversion banner", async () => {
  const result = await importDocxToMarkdown({ bytes: richMarkdownFixture() });

  assert.equal(result.kind, "ok");
  assert.ok(result.warnings.length > 0);
  assert.ok(
    result.warnings.some((warning) => /WeirdCustom/.test(warning)),
    "expected an unrecognized-style warning",
  );
  assert.equal(
    docxImportBannerText({ warnings: result.warnings }),
    DOCX_IMPORT_LIMITS_BANNER,
  );
  assert.ok(result.messages.every((message) => message.type === "warning"));
});

test("rejects empty DOCX bytes without throwing", async () => {
  const result = await importDocxToMarkdown({ bytes: new Uint8Array() });

  assert.deepEqual(result, {
    kind: "error",
    error: "DOCX bytes are empty.",
  });
});

test("rejects garbage that is not a ZIP/DOCX package", async () => {
  const result = await importDocxToMarkdown({
    bytes: encoder.encode("not a docx archive"),
  });

  assert.equal(result.kind, "error");
  assert.ok(result.error.length > 0);
});

test("imports an empty-body DOCX as empty markdown without inventing text", async () => {
  const result = await importDocxToMarkdown({ bytes: emptyBodyFixture() });

  assert.equal(result.kind, "ok");
  assert.equal(result.markdown.trim(), "");
  assert.equal(docxImportBannerText({ warnings: result.warnings }), null);
});

test("still imports content when styles.xml is missing from the package", async () => {
  const bytes = new Uint8Array(
    readFileSync(join(fixturesDir, "missing-styles.docx")),
  );

  const result = await importDocxToMarkdown({ bytes });

  assert.equal(result.kind, "ok");
  assert.match(result.markdown, /Planevo fidelity baseline/);
});

test("falls back to extractRawText when convertToMarkdown throws", async () => {
  const result = await importDocxToMarkdown({
    bytes: encoder.encode("unused-package-bytes-for-converter-seam"),
    converter: {
      convertToMarkdown: async () => {
        throw new Error("markdown pipeline exploded");
      },
      extractRawText: async () => ({
        value: "Recovered plain body\n",
        messages: [],
      }),
    },
  });

  assert.equal(result.kind, "ok");
  assert.equal(result.markdown, "Recovered plain body\n");
  assert.ok(
    result.warnings.includes(DOCX_IMPORT_PLAIN_TEXT_FALLBACK_WARNING),
  );
  assert.equal(
    docxImportBannerText({ warnings: result.warnings }),
    DOCX_IMPORT_LIMITS_BANNER,
  );
});

test("falls back to extractRawText when convertToMarkdown returns empty markdown", async () => {
  const result = await importDocxToMarkdown({
    bytes: encoder.encode("unused-package-bytes-for-converter-seam"),
    converter: {
      convertToMarkdown: async () => ({
        value: "   \n\n",
        messages: [{ type: "warning", message: "empty body from markdown" }],
      }),
      extractRawText: async () => ({
        value: "Raw text survived\n",
        messages: [],
      }),
    },
  });

  assert.equal(result.kind, "ok");
  assert.equal(result.markdown, "Raw text survived\n");
  assert.ok(result.warnings.includes("empty body from markdown"));
  assert.ok(
    result.warnings.includes(DOCX_IMPORT_PLAIN_TEXT_FALLBACK_WARNING),
  );
});
