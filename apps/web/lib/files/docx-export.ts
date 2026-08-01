/**
 * Markdown → DOCX export for the Files markdown-shell editor.
 *
 * V1 builds a valid OOXML package from edited markdown (headings, lists,
 * bold/italic/links/tables). Honest content save — not bit-identical round-trip.
 * When `basePackage` is provided, preserve the original shell (styles, rels,
 * extras) and replace `word/document.xml` only (package-surgery preference).
 *
 * Browser-safe: store-method ZIP only; inflate via DecompressionStream.
 */

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types";
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE_DOC_REL =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument";
const STYLES_REL =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles";
const NUMBERING_REL =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering";

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const MAX_DOCX_ARCHIVE_ENTRIES = 2_048;

/** Calm banner when export cannot preserve original Word chrome. */
export const DOCX_EXPORT_LIMITS_BANNER =
  "Some formatting may not carry over.";

/** Always attached — original styles/headers/comments may not round-trip. */
export const DOCX_EXPORT_FIDELITY_WARNING =
  "Exported as edited content; original Word styles, headers, footers, and comments may not be preserved.";

/** Attached when base-package surgery fails and a clean package is built instead. */
export const DOCX_EXPORT_SHELL_FALLBACK_WARNING =
  "Could not preserve the original document shell; saved as a clean DOCX package.";

export type DocxExportSuccess = {
  kind: "ok";
  bytes: Uint8Array;
  /** Human-readable notices for a calm conversion banner. */
  warnings: readonly string[];
};

export type DocxExportFailure = {
  kind: "error";
  error: string;
};

export type DocxExportResult = DocxExportSuccess | DocxExportFailure;

export type ExportMarkdownToDocxArgs = {
  markdown: string;
  /**
   * Optional original DOCX bytes. When structurally readable, package surgery
   * replaces `word/document.xml` and keeps other parts (styles, extras).
   */
  basePackage?: Uint8Array;
};

type InlineRun =
  | { kind: "text"; text: string }
  | { kind: "bold"; children: InlineRun[] }
  | { kind: "italic"; children: InlineRun[] }
  | { kind: "code"; text: string }
  | { kind: "link"; href: string; children: InlineRun[] };

type Block =
  | { kind: "heading"; level: number; runs: InlineRun[] }
  | { kind: "paragraph"; runs: InlineRun[] }
  | { kind: "ul"; items: InlineRun[][] }
  | { kind: "ol"; items: InlineRun[][] }
  | { kind: "code_block"; text: string }
  | { kind: "blockquote"; runs: InlineRun[] }
  | { kind: "hr" }
  | { kind: "table"; rows: InlineRun[][][] };

type ZipEntry = {
  name: string;
  content: Uint8Array;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8");

function writeUint16(target: number[], value: number): void {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(target: number[], value: number): void {
  target.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! |
      (bytes[offset + 1]! << 8) |
      (bytes[offset + 2]! << 16) |
      (bytes[offset + 3]! << 24)) >>>
    0
  );
}

/** IEEE CRC-32 (ZIP). */
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.byteLength; i += 1) {
    crc ^= bytes[i]!;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildStoredZip(entries: readonly ZipEntry[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const content = entry.content;
    const checksum = crc32(content);
    const localParts: number[] = [0x50, 0x4b, 0x03, 0x04];
    writeUint16(localParts, 20);
    writeUint16(localParts, 0);
    writeUint16(localParts, 0);
    writeUint16(localParts, 0);
    writeUint16(localParts, 0);
    writeUint32(localParts, checksum);
    writeUint32(localParts, content.byteLength);
    writeUint32(localParts, content.byteLength);
    writeUint16(localParts, nameBytes.byteLength);
    writeUint16(localParts, 0);
    const local = new Uint8Array(localParts.length + nameBytes.byteLength + content.byteLength);
    local.set(Uint8Array.from(localParts), 0);
    local.set(nameBytes, localParts.length);
    local.set(content, localParts.length + nameBytes.byteLength);
    locals.push(local);

    const centralParts: number[] = [0x50, 0x4b, 0x01, 0x02];
    writeUint16(centralParts, 20);
    writeUint16(centralParts, 20);
    writeUint16(centralParts, 0);
    writeUint16(centralParts, 0);
    writeUint16(centralParts, 0);
    writeUint16(centralParts, 0);
    writeUint32(centralParts, checksum);
    writeUint32(centralParts, content.byteLength);
    writeUint32(centralParts, content.byteLength);
    writeUint16(centralParts, nameBytes.byteLength);
    writeUint16(centralParts, 0);
    writeUint16(centralParts, 0);
    writeUint16(centralParts, 0);
    writeUint16(centralParts, 0);
    writeUint32(centralParts, 0);
    writeUint32(centralParts, offset);
    const centralEntry = new Uint8Array(
      centralParts.length + nameBytes.byteLength,
    );
    centralEntry.set(Uint8Array.from(centralParts), 0);
    centralEntry.set(nameBytes, centralParts.length);
    central.push(centralEntry);
    offset += local.byteLength;
  }

  const centralSize = central.reduce((total, entry) => total + entry.byteLength, 0);
  const eocdParts: number[] = [0x50, 0x4b, 0x05, 0x06];
  writeUint16(eocdParts, 0);
  writeUint16(eocdParts, 0);
  writeUint16(eocdParts, entries.length);
  writeUint16(eocdParts, entries.length);
  writeUint32(eocdParts, centralSize);
  writeUint32(eocdParts, offset);
  writeUint16(eocdParts, 0);
  const eocd = Uint8Array.from(eocdParts);

  const zip = new Uint8Array(offset + centralSize + eocd.byteLength);
  let cursor = 0;
  for (const chunk of [...locals, ...central, eocd]) {
    zip.set(chunk, cursor);
    cursor += chunk.byteLength;
  }
  return zip;
}

function findZipEndOfCentralDirectory(
  bytes: Uint8Array,
): { offset: number; entryCount: number; centralDirectorySize: number; centralDirectoryOffset: number } | null {
  const minEocd = 22;
  if (bytes.byteLength < minEocd) return null;
  const maxComment = 0xffff;
  const start = Math.max(0, bytes.byteLength - (minEocd + maxComment));
  for (let i = bytes.byteLength - minEocd; i >= start; i -= 1) {
    if (readUint32(bytes, i) !== ZIP_END_OF_CENTRAL_DIRECTORY) continue;
    const entryCount = readUint16(bytes, i + 10);
    const centralDirectorySize = readUint32(bytes, i + 12);
    const centralDirectoryOffset = readUint32(bytes, i + 16);
    return { offset: i, entryCount, centralDirectorySize, centralDirectoryOffset };
  }
  return null;
}

async function inflateRaw(payload: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("deflate-raw inflate is unavailable in this runtime.");
  }
  // Copy onto a concrete ArrayBuffer — BlobPart rejects SharedArrayBuffer views.
  const copy = new Uint8Array(payload.byteLength);
  copy.set(payload);
  const stream = new Blob([copy]).stream().pipeThrough(
    new DecompressionStream("deflate-raw"),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipEntries(bytes: Uint8Array): Promise<ZipEntry[] | null> {
  const end = findZipEndOfCentralDirectory(bytes);
  if (!end) return null;
  if (end.entryCount === 0 || end.entryCount > MAX_DOCX_ARCHIVE_ENTRIES) {
    return null;
  }

  const centralEnd = end.centralDirectoryOffset + end.centralDirectorySize;
  if (centralEnd > bytes.byteLength || centralEnd > end.offset) return null;

  const entries: ZipEntry[] = [];
  let cursor = end.centralDirectoryOffset;

  try {
    for (let index = 0; index < end.entryCount; index += 1) {
      if (cursor + 46 > centralEnd) return null;
      if (readUint32(bytes, cursor) !== ZIP_CENTRAL_DIRECTORY_HEADER) return null;

      const flags = readUint16(bytes, cursor + 8);
      const compressionMethod = readUint16(bytes, cursor + 10);
      const compressedSize = readUint32(bytes, cursor + 20);
      const uncompressedSize = readUint32(bytes, cursor + 24);
      const filenameLength = readUint16(bytes, cursor + 28);
      const extraLength = readUint16(bytes, cursor + 30);
      const commentLength = readUint16(bytes, cursor + 32);
      const localHeaderOffset = readUint32(bytes, cursor + 42);
      const entryEnd = cursor + 46 + filenameLength + extraLength + commentLength;
      if (entryEnd > centralEnd) return null;
      if ((flags & 0x0001) !== 0 || (flags & 0x0040) !== 0) return null;
      if (compressionMethod !== 0 && compressionMethod !== 8) return null;

      const name = decoder.decode(
        bytes.subarray(cursor + 46, cursor + 46 + filenameLength),
      );
      if (
        !name ||
        name.includes("\0") ||
        name.startsWith("/") ||
        name.split("/").some((segment) => segment === "..")
      ) {
        return null;
      }

      if (readUint32(bytes, localHeaderOffset) !== ZIP_LOCAL_FILE_HEADER) {
        return null;
      }
      const localNameLength = readUint16(bytes, localHeaderOffset + 26);
      const localExtraLength = readUint16(bytes, localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
      if (dataOffset + compressedSize > bytes.byteLength) return null;

      const payload = bytes.subarray(dataOffset, dataOffset + compressedSize);
      let content: Uint8Array;
      if (compressionMethod === 0) {
        content = payload.slice();
      } else {
        content = await inflateRaw(payload);
      }
      if (content.byteLength !== uncompressedSize && uncompressedSize !== 0) {
        // Some archives lie about size under data descriptors; still accept
        // inflated length when the descriptor bit was set.
        if ((flags & 0x0008) === 0) return null;
      }

      entries.push({ name, content });
      cursor = entryEnd;
    }
  } catch {
    return null;
  }

  if (cursor !== centralEnd) return null;
  return entries;
}

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function textElement(text: string): string {
  const needsPreserve = /^\s|\s$/.test(text) || text.includes("  ");
  const attr = needsPreserve ? ' xml:space="preserve"' : "";
  return `<w:t${attr}>${escapeXml(text)}</w:t>`;
}

function renderRuns(runs: readonly InlineRun[], marks: { bold?: boolean; italic?: boolean } = {}): string {
  let xml = "";
  for (const run of runs) {
    switch (run.kind) {
      case "text": {
        if (run.text.length === 0) break;
        const rPrParts: string[] = [];
        if (marks.bold) rPrParts.push("<w:b/>");
        if (marks.italic) rPrParts.push("<w:i/>");
        const rPr = rPrParts.length > 0 ? `<w:rPr>${rPrParts.join("")}</w:rPr>` : "";
        xml += `<w:r>${rPr}${textElement(run.text)}</w:r>`;
        break;
      }
      case "code": {
        xml += `<w:r><w:rPr><w:i/></w:rPr>${textElement(run.text)}</w:r>`;
        break;
      }
      case "bold":
        xml += renderRuns(run.children, { ...marks, bold: true });
        break;
      case "italic":
        xml += renderRuns(run.children, { ...marks, italic: true });
        break;
      case "link": {
        // Honest V1: emit visible link text + URL — hyperlink relationships
        // need document.xml.rels surgery we avoid in the clean package path.
        const label = flattenRuns(run.children) || run.href;
        xml += renderRuns([{ kind: "text", text: `${label} (${run.href})` }], marks);
        break;
      }
      default: {
        const _exhaustive: never = run;
        return _exhaustive;
      }
    }
  }
  return xml;
}

function flattenRuns(runs: readonly InlineRun[]): string {
  let text = "";
  for (const run of runs) {
    switch (run.kind) {
      case "text":
      case "code":
        text += run.text;
        break;
      case "bold":
      case "italic":
      case "link":
        text += flattenRuns(run.children);
        break;
      default: {
        const _exhaustive: never = run;
        return _exhaustive;
      }
    }
  }
  return text;
}

function paragraphXml(input: {
  runs: readonly InlineRun[];
  styleId?: string;
  numPr?: { numId: number; ilvl: number };
}): string {
  const pPrParts: string[] = [];
  if (input.styleId) {
    pPrParts.push(`<w:pStyle w:val="${escapeXml(input.styleId)}"/>`);
  }
  if (input.numPr) {
    pPrParts.push(
      `<w:numPr><w:ilvl w:val="${input.numPr.ilvl}"/><w:numId w:val="${input.numPr.numId}"/></w:numPr>`,
    );
  }
  const pPr = pPrParts.length > 0 ? `<w:pPr>${pPrParts.join("")}</w:pPr>` : "";
  return `<w:p>${pPr}${renderRuns(input.runs)}</w:p>`;
}

function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const pattern =
    /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push({ kind: "text", text: text.slice(lastIndex, match.index) });
    }
    const token = match[0]!;
    if (token.startsWith("**") || token.startsWith("__")) {
      runs.push({
        kind: "bold",
        children: parseInline(token.slice(2, -2)),
      });
    } else if (token.startsWith("`")) {
      runs.push({ kind: "code", text: token.slice(1, -1) });
    } else if (token.startsWith("[")) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        runs.push({
          kind: "link",
          href: linkMatch[2]!,
          children: parseInline(linkMatch[1]!),
        });
      } else {
        runs.push({ kind: "text", text: token });
      }
    } else if (token.startsWith("*") || token.startsWith("_")) {
      runs.push({
        kind: "italic",
        children: parseInline(token.slice(1, -1)),
      });
    } else {
      runs.push({ kind: "text", text: token });
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    runs.push({ kind: "text", text: text.slice(lastIndex) });
  }
  if (runs.length === 0) {
    runs.push({ kind: "text", text: "" });
  }
  return runs;
}

function parseTableRow(line: string): InlineRun[][] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => parseInline(cell.trim()));
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  return /^\|?[\s:|-]+\|[\s:|-]*\|?$/.test(trimmed);
}

/**
 * Line-oriented GFM subset → blocks. Intentionally small: matches mammoth's
 * typical markdown shape and what users type in the Files shell.
 */
export function parseMarkdownBlocks(markdown: string): Block[] {
  const normalized = markdown.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]!;

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1]!.length,
        runs: parseInline(heading[2]!.trim()),
      });
      index += 1;
      continue;
    }

    if (/^(`{3,}|~{3,})/.test(line.trim())) {
      const fence = line.trim().match(/^(`{3,}|~{3,})/)?.[1] ?? "```";
      index += 1;
      const body: string[] = [];
      while (index < lines.length && lines[index]!.trim() !== fence) {
        body.push(lines[index]!);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ kind: "code_block", text: body.join("\n") });
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      blocks.push({ kind: "hr" });
      index += 1;
      continue;
    }

    if (/^\|/.test(line.trim()) && index + 1 < lines.length && isTableSeparator(lines[index + 1]!)) {
      const rows: InlineRun[][][] = [parseTableRow(line)];
      index += 2;
      while (index < lines.length && /^\|/.test(lines[index]!.trim())) {
        rows.push(parseTableRow(lines[index]!));
        index += 1;
      }
      blocks.push({ kind: "table", rows });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoted = line.replace(/^>\s?/, "");
      blocks.push({ kind: "blockquote", runs: parseInline(quoted) });
      index += 1;
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items: InlineRun[][] = [];
      while (index < lines.length && /^[-*+]\s+/.test(lines[index]!)) {
        items.push(parseInline(lines[index]!.replace(/^[-*+]\s+/, "")));
        index += 1;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const items: InlineRun[][] = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index]!)) {
        items.push(parseInline(lines[index]!.replace(/^\d+[.)]\s+/, "")));
        index += 1;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index]!.trim() !== "" &&
      !/^(#{1,6})\s+/.test(lines[index]!) &&
      !/^[-*+]\s+/.test(lines[index]!) &&
      !/^\d+[.)]\s+/.test(lines[index]!) &&
      !/^>\s?/.test(lines[index]!) &&
      !/^(`{3,}|~{3,})/.test(lines[index]!.trim()) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[index]!.trim()) &&
      !(/^\|/.test(lines[index]!.trim()) &&
        index + 1 < lines.length &&
        isTableSeparator(lines[index + 1]!))
    ) {
      paragraphLines.push(lines[index]!);
      index += 1;
    }
    blocks.push({
      kind: "paragraph",
      runs: parseInline(paragraphLines.join(" ")),
    });
  }

  return blocks;
}

function blocksToDocumentXml(blocks: readonly Block[]): string {
  const bodyParts: string[] = [];

  for (const block of blocks) {
    switch (block.kind) {
      case "heading": {
        const level = Math.min(6, Math.max(1, block.level));
        bodyParts.push(
          paragraphXml({ runs: block.runs, styleId: `Heading${level}` }),
        );
        break;
      }
      case "paragraph":
        bodyParts.push(paragraphXml({ runs: block.runs }));
        break;
      case "blockquote":
        bodyParts.push(
          paragraphXml({ runs: block.runs, styleId: "Quote" }),
        );
        break;
      case "hr":
        bodyParts.push(
          `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>`,
        );
        break;
      case "code_block": {
        const lines = block.text.length > 0 ? block.text.split("\n") : [""];
        for (const line of lines) {
          bodyParts.push(
            `<w:p><w:pPr><w:pStyle w:val="CodeBlock"/></w:pPr><w:r>${textElement(line)}</w:r></w:p>`,
          );
        }
        break;
      }
      case "ul":
        for (const item of block.items) {
          bodyParts.push(
            paragraphXml({ runs: item, numPr: { numId: 1, ilvl: 0 } }),
          );
        }
        break;
      case "ol":
        for (const item of block.items) {
          bodyParts.push(
            paragraphXml({ runs: item, numPr: { numId: 2, ilvl: 0 } }),
          );
        }
        break;
      case "table": {
        const rowsXml = block.rows
          .map((row) => {
            const cells = row
              .map(
                (cell) =>
                  `<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>${paragraphXml({ runs: cell })}</w:tc>`,
              )
              .join("");
            return `<w:tr>${cells}</w:tr>`;
          })
          .join("");
        bodyParts.push(
          `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:left w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:right w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="auto"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="auto"/></w:tblBorders></w:tblPr>${rowsXml}</w:tbl>`,
        );
        break;
      }
      default: {
        const _exhaustive: never = block;
        return _exhaustive;
      }
    }
  }

  if (bodyParts.length === 0) {
    bodyParts.push("<w:p/>");
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W_NS}">
  <w:body>
    ${bodyParts.join("\n    ")}
    <w:sectPr/>
  </w:body>
</w:document>`;
}

function cleanContentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${CT_NS}">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`;
}

function cleanRootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${REL_NS}">
  <Relationship Id="rId1" Type="${OFFICE_DOC_REL}" Target="word/document.xml"/>
</Relationships>`;
}

function cleanDocumentRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${REL_NS}">
  <Relationship Id="rId1" Type="${STYLES_REL}" Target="styles.xml"/>
  <Relationship Id="rId2" Type="${NUMBERING_REL}" Target="numbering.xml"/>
</Relationships>`;
}

function cleanStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W_NS}">
  <w:style w:type="paragraph" w:styleId="Normal" w:default="1">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading4"><w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading5"><w:name w:val="heading 5"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading6"><w:name w:val="heading 6"/><w:basedOn w:val="Normal"/><w:uiPriority w:val="9"/></w:style>
  <w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="CodeBlock"><w:name w:val="Code Block"/><w:basedOn w:val="Normal"/></w:style>
</w:styles>`;
}

function cleanNumberingXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${W_NS}">
  <w:abstractNum w:abstractNumId="0">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:multiLevelType w:val="hybridMultilevel"/>
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`;
}

function buildCleanPackage(documentXml: string): Uint8Array {
  return buildStoredZip([
    { name: "[Content_Types].xml", content: encoder.encode(cleanContentTypesXml()) },
    { name: "_rels/.rels", content: encoder.encode(cleanRootRelsXml()) },
    { name: "word/document.xml", content: encoder.encode(documentXml) },
    {
      name: "word/_rels/document.xml.rels",
      content: encoder.encode(cleanDocumentRelsXml()),
    },
    { name: "word/styles.xml", content: encoder.encode(cleanStylesXml()) },
    { name: "word/numbering.xml", content: encoder.encode(cleanNumberingXml()) },
  ]);
}

function ensureContentTypesHasDocument(contentTypesXml: string): string {
  if (contentTypesXml.includes('PartName="/word/document.xml"')) {
    return contentTypesXml;
  }
  const override =
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>';
  if (contentTypesXml.includes("</Types>")) {
    return contentTypesXml.replace("</Types>", `  ${override}\n</Types>`);
  }
  return cleanContentTypesXml();
}

async function tryPackageSurgery(input: {
  basePackage: Uint8Array;
  documentXml: string;
}): Promise<Uint8Array | null> {
  const entries = await readZipEntries(input.basePackage);
  if (!entries) return null;

  const names = new Set(entries.map((entry) => entry.name));
  if (!names.has("[Content_Types].xml") || !names.has("word/document.xml")) {
    return null;
  }

  const next: ZipEntry[] = entries.map((entry) => {
    if (entry.name === "word/document.xml") {
      return { name: entry.name, content: encoder.encode(input.documentXml) };
    }
    if (entry.name === "[Content_Types].xml") {
      return {
        name: entry.name,
        content: encoder.encode(
          ensureContentTypesHasDocument(decoder.decode(entry.content)),
        ),
      };
    }
    return { name: entry.name, content: entry.content.slice() };
  });

  return buildStoredZip(next);
}

/**
 * Banner text when export produced conversion notices; null when clean.
 * Export always warns about fidelity limits today — callers may still hide
 * the banner until warnings are non-empty after a future clean path.
 */
export function docxExportBannerText(input: {
  warnings: readonly string[];
}): string | null {
  if (input.warnings.length === 0) return null;
  return DOCX_EXPORT_LIMITS_BANNER;
}

/**
 * Convert markdown into valid DOCX package bytes for save-back.
 * Returns a discriminated result — callers keep prior state on `kind: "error"`.
 */
export async function exportMarkdownToDocx({
  markdown,
  basePackage,
}: ExportMarkdownToDocxArgs): Promise<DocxExportResult> {
  // Runtime guard for JS call sites / strip-types tests — TS already narrows.
  if (typeof (markdown as unknown) !== "string") {
    return { kind: "error", error: "Markdown must be a string." };
  }

  const warnings: string[] = [DOCX_EXPORT_FIDELITY_WARNING];
  const blocks = parseMarkdownBlocks(markdown);
  const documentXml = blocksToDocumentXml(blocks);

  if (basePackage !== undefined) {
    if (basePackage.byteLength === 0) {
      warnings.push(DOCX_EXPORT_SHELL_FALLBACK_WARNING);
      return {
        kind: "ok",
        bytes: buildCleanPackage(documentXml),
        warnings,
      };
    }

    const surgically = await tryPackageSurgery({
      basePackage,
      documentXml,
    });
    if (surgically) {
      return { kind: "ok", bytes: surgically, warnings };
    }
    warnings.push(DOCX_EXPORT_SHELL_FALLBACK_WARNING);
  }

  return {
    kind: "ok",
    bytes: buildCleanPackage(documentXml),
    warnings,
  };
}
