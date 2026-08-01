/**
 * DOCX fidelity harness — content integrity for the markdown-shell pivot.
 *
 * Two axes:
 * 1) Package inventory/diff (`compareDocxPackages`) — still classifies
 *    intact / packaging_drift / degraded so recompression and added editor
 *    parts stay distinguishable from missing required parts. Not a
 *    bit-identical OOXML / Google Docs WYSIWYG bar.
 * 2) Markdown round-trip content checks — exported packages must stay
 *    structurally valid and must not silently drop user-edited paragraphs
 *    or headings (MD → DOCX → MD via docx-export + docx-import).
 */

import { exportMarkdownToDocx } from "./docx-export.ts";
import { importDocxToMarkdown } from "./docx-import.ts";

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const MAX_DOCX_ARCHIVE_ENTRIES = 2_048;

/** Structural parts every save-back package must retain. */
export const REQUIRED_DOCX_PART_NAMES = [
  "[Content_Types].xml",
  "_rels/.rels",
  "word/document.xml",
] as const;

export type DocxPartInventoryEntry = {
  name: string;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  generalPurposeFlags: number;
  /** Compressed payload bytes from the local file record (not inflated). */
  compressedPayload: Uint8Array;
};

export type DocxPackageInventory = {
  entryCount: number;
  parts: readonly DocxPartInventoryEntry[];
};

export type DocxFidelityDiffKind =
  | "missing_in_after"
  | "added_in_after"
  | "crc_changed"
  | "uncompressed_size_changed"
  | "compressed_size_changed"
  | "compression_method_changed"
  | "payload_changed"
  | "flags_changed";

export type DocxPartFingerprint = {
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  generalPurposeFlags: number;
};

export type DocxFidelityDiff = {
  kind: DocxFidelityDiffKind;
  partName: string;
  before: DocxPartFingerprint | null;
  after: DocxPartFingerprint | null;
};

export type DocxFidelityVerdict =
  | "intact"
  | "packaging_drift"
  | "degraded"
  | "unreadable";

export type DocxFidelityReport = {
  verdict: DocxFidelityVerdict;
  beforeReadable: boolean;
  afterReadable: boolean;
  unreadableReason: string | null;
  diffs: readonly DocxFidelityDiff[];
  contentPreservedPartNames: readonly string[];
  contentLostPartNames: readonly string[];
};

export type DocxContentIntegrityVerdict =
  | "content_preserved"
  | "content_lost"
  | "structurally_invalid";

export type DocxContentIntegrityReport = {
  verdict: DocxContentIntegrityVerdict;
  packageReadable: boolean;
  missingRequiredParts: readonly string[];
  documentXmlPresent: boolean;
  bodyPlainText: string | null;
  missingFragments: readonly string[];
  emptyBody: boolean;
  reason: string | null;
};

export type MarkdownDocxRoundTripVerdict =
  | DocxContentIntegrityVerdict
  | "export_failed"
  | "import_failed";

export type MarkdownDocxRoundTripReport = {
  verdict: MarkdownDocxRoundTripVerdict;
  exportWarnings: readonly string[];
  exportedBytes: Uint8Array | null;
  packageIntegrity: DocxContentIntegrityReport | null;
  reimportedMarkdown: string | null;
  missingAfterImport: readonly string[];
  /**
   * Package-level compare of `basePackage` vs export when a base was supplied.
   * Edited saves often report `degraded` here (document.xml intentionally
   * changed) while content integrity still passes — that distinction is the
   * markdown-shell reframe.
   */
  packageCompare: DocxFidelityReport | null;
  reason: string | null;
};

const CONTENT_LOSS_KINDS = new Set<DocxFidelityDiffKind>([
  "missing_in_after",
  "crc_changed",
  "uncompressed_size_changed",
]);

const decoder = new TextDecoder("utf-8", { fatal: true });
const looseDecoder = new TextDecoder("utf-8");

/**
 * Parse a DOCX (ZIP/OOXML) package into a part inventory keyed for fidelity
 * comparison. Returns null when the bytes are not a readable single-disk ZIP
 * with a traversable central directory.
 */
export function inventoryDocxPackage(input: {
  bytes: Uint8Array;
}): DocxPackageInventory | null {
  const { bytes } = input;
  if (bytes.byteLength < 22) return null;

  const endOfDirectory = findZipEndOfCentralDirectory(bytes);
  if (!endOfDirectory) return null;

  const { centralDirectoryOffset, centralDirectorySize, entryCount } =
    endOfDirectory;
  if (entryCount === 0 || entryCount > MAX_DOCX_ARCHIVE_ENTRIES) return null;

  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (
    centralDirectoryEnd > bytes.byteLength ||
    centralDirectoryEnd > endOfDirectory.offset
  ) {
    return null;
  }

  const parts: DocxPartInventoryEntry[] = [];
  const names = new Set<string>();
  let cursor = centralDirectoryOffset;

  try {
    for (let index = 0; index < entryCount; index += 1) {
      if (cursor + 46 > centralDirectoryEnd) return null;
      if (readUint32(bytes, cursor) !== ZIP_CENTRAL_DIRECTORY_HEADER) {
        return null;
      }

      const generalPurposeFlags = readUint16(bytes, cursor + 8);
      const compressionMethod = readUint16(bytes, cursor + 10);
      const crc32 = readUint32(bytes, cursor + 16);
      const compressedSize = readUint32(bytes, cursor + 20);
      const uncompressedSize = readUint32(bytes, cursor + 24);
      const filenameLength = readUint16(bytes, cursor + 28);
      const extraLength = readUint16(bytes, cursor + 30);
      const commentLength = readUint16(bytes, cursor + 32);
      const localHeaderOffset = readUint32(bytes, cursor + 42);
      const entryEnd =
        cursor + 46 + filenameLength + extraLength + commentLength;
      if (entryEnd > centralDirectoryEnd) return null;

      const name = decoder.decode(
        bytes.subarray(cursor + 46, cursor + 46 + filenameLength),
      );
      if (
        !name ||
        name.includes("\0") ||
        name.startsWith("/") ||
        name.split("/").some((segment) => segment === "..") ||
        names.has(name)
      ) {
        return null;
      }
      names.add(name);

      const localEntry = localFileEntry(bytes, localHeaderOffset);
      if (
        localEntry === null ||
        localEntry.filenameLength !== filenameLength ||
        localEntry.dataOffset + compressedSize > bytes.byteLength
      ) {
        return null;
      }

      const localName = decoder.decode(
        bytes.subarray(
          localEntry.nameOffset,
          localEntry.nameOffset + filenameLength,
        ),
      );
      if (localName !== name) return null;

      const compressedPayload = bytes.slice(
        localEntry.dataOffset,
        localEntry.dataOffset + compressedSize,
      );

      parts.push({
        name,
        crc32,
        compressedSize,
        uncompressedSize,
        compressionMethod,
        generalPurposeFlags,
        compressedPayload,
      });
      cursor = entryEnd;
    }
  } catch {
    return null;
  }

  if (cursor !== centralDirectoryEnd) return null;
  return { entryCount, parts };
}

/**
 * Part-by-part fidelity compare. Content loss (missing parts, CRC or
 * uncompressed-size change) yields `degraded`. Recompression / added parts
 * alone yield `packaging_drift`. Identical inventories yield `intact`.
 *
 * For markdown-shell edits, a changed `word/document.xml` correctly reports
 * `degraded` at the package layer — use `assertDocxContentIntegrity` /
 * `evaluateMarkdownDocxRoundTrip` to judge whether edited text survived.
 */
export function compareDocxPackages(input: {
  before: Uint8Array;
  after: Uint8Array;
}): DocxFidelityReport {
  const beforeInventory = inventoryDocxPackage({ bytes: input.before });
  const afterInventory = inventoryDocxPackage({ bytes: input.after });

  if (!beforeInventory && !afterInventory) {
    return unreadableReport({
      beforeReadable: false,
      afterReadable: false,
      reason: "Neither package is a readable OOXML ZIP.",
    });
  }
  if (!beforeInventory) {
    return unreadableReport({
      beforeReadable: false,
      afterReadable: true,
      reason: "Before package is not a readable OOXML ZIP.",
    });
  }
  if (!afterInventory) {
    return unreadableReport({
      beforeReadable: true,
      afterReadable: false,
      reason: "After package is not a readable OOXML ZIP.",
    });
  }

  const beforeByName = new Map(
    beforeInventory.parts.map((part) => [part.name, part]),
  );
  const afterByName = new Map(
    afterInventory.parts.map((part) => [part.name, part]),
  );
  const diffs: DocxFidelityDiff[] = [];
  const contentPreservedPartNames: string[] = [];
  const contentLostPartNames: string[] = [];

  for (const beforePart of beforeInventory.parts) {
    const afterPart = afterByName.get(beforePart.name);
    if (!afterPart) {
      diffs.push({
        kind: "missing_in_after",
        partName: beforePart.name,
        before: fingerprint(beforePart),
        after: null,
      });
      contentLostPartNames.push(beforePart.name);
      continue;
    }

    const partDiffs = diffMatchingParts({
      before: beforePart,
      after: afterPart,
    });
    diffs.push(...partDiffs);

    const lostContent = partDiffs.some((diff) =>
      CONTENT_LOSS_KINDS.has(diff.kind),
    );
    if (lostContent) {
      contentLostPartNames.push(beforePart.name);
    } else {
      contentPreservedPartNames.push(beforePart.name);
    }
  }

  for (const afterPart of afterInventory.parts) {
    if (beforeByName.has(afterPart.name)) continue;
    diffs.push({
      kind: "added_in_after",
      partName: afterPart.name,
      before: null,
      after: fingerprint(afterPart),
    });
  }

  return {
    verdict: verdictFromDiffs(diffs),
    beforeReadable: true,
    afterReadable: true,
    unreadableReason: null,
    diffs,
    contentPreservedPartNames,
    contentLostPartNames,
  };
}

export function isDocxFidelityDegraded(input: {
  report: DocxFidelityReport;
}): boolean {
  return input.report.verdict === "degraded";
}

export function summarizeDocxFidelityReport(input: {
  report: DocxFidelityReport;
}): string {
  const { report } = input;
  switch (report.verdict) {
    case "intact":
      return `Intact: ${report.contentPreservedPartNames.length} part(s) byte-identical.`;
    case "packaging_drift":
      return `Packaging drift only: content preserved for ${report.contentPreservedPartNames.length} part(s); ${report.diffs.length} packaging/structural diff(s).`;
    case "degraded":
      return `Degraded: content lost or changed in ${report.contentLostPartNames.length} part(s); ${report.diffs.length} total diff(s).`;
    case "unreadable":
      return `Unreadable: ${report.unreadableReason ?? "packages could not be inventoried."}`;
    default: {
      const _exhaustive: never = report.verdict;
      return _exhaustive;
    }
  }
}

/** True when the inventory retains every required OOXML shell part. */
export function packageHasRequiredDocxParts(input: {
  inventory: DocxPackageInventory;
}): boolean {
  const names = new Set(input.inventory.parts.map((part) => part.name));
  return REQUIRED_DOCX_PART_NAMES.every((name) => names.has(name));
}

/**
 * Inflate (or copy) a named part from a package inventory. Returns null when
 * the part is missing or compression cannot be decoded.
 */
export async function readDocxPartUncompressed(input: {
  inventory: DocxPackageInventory;
  partName: string;
}): Promise<Uint8Array | null> {
  const part = input.inventory.parts.find(
    (entry) => entry.name === input.partName,
  );
  if (!part) return null;

  try {
    if (part.compressionMethod === 0) {
      return part.compressedPayload.slice();
    }
    if (part.compressionMethod === 8) {
      return await inflateRaw(part.compressedPayload);
    }
    return null;
  } catch {
    return null;
  }
}

/** Read `word/document.xml` as UTF-8 text, or null if unavailable. */
export async function extractDocxDocumentXml(input: {
  bytes: Uint8Array;
}): Promise<string | null> {
  const inventory = inventoryDocxPackage({ bytes: input.bytes });
  if (!inventory) return null;
  const bytes = await readDocxPartUncompressed({
    inventory,
    partName: "word/document.xml",
  });
  if (!bytes) return null;
  try {
    return looseDecoder.decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Collect plain text from `<w:t>` runs. Used to assert edited paragraphs and
 * headings survived export without requiring bit-identical OOXML.
 */
export function extractDocxBodyPlainText(input: {
  documentXml: string;
}): string {
  const texts: string[] = [];
  const pattern = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(input.documentXml)) !== null) {
    texts.push(decodeXmlEntities(match[1] ?? ""));
  }
  return texts.join("");
}

/**
 * Content-integrity gate for a saved DOCX package: structurally readable,
 * required parts present, non-empty body when fragments are expected, and
 * every required fragment present in the body plain text.
 */
export async function assertDocxContentIntegrity(input: {
  bytes: Uint8Array;
  requiredFragments: readonly string[];
}): Promise<DocxContentIntegrityReport> {
  const inventory = inventoryDocxPackage({ bytes: input.bytes });
  if (!inventory) {
    return {
      verdict: "structurally_invalid",
      packageReadable: false,
      missingRequiredParts: [...REQUIRED_DOCX_PART_NAMES],
      documentXmlPresent: false,
      bodyPlainText: null,
      missingFragments: [...input.requiredFragments],
      emptyBody: true,
      reason: "Package is not a readable OOXML ZIP.",
    };
  }

  const names = new Set(inventory.parts.map((part) => part.name));
  const missingRequiredParts = REQUIRED_DOCX_PART_NAMES.filter(
    (name) => !names.has(name),
  );
  if (missingRequiredParts.length > 0) {
    return {
      verdict: "structurally_invalid",
      packageReadable: true,
      missingRequiredParts,
      documentXmlPresent: names.has("word/document.xml"),
      bodyPlainText: null,
      missingFragments: [...input.requiredFragments],
      emptyBody: true,
      reason: `Missing required part(s): ${missingRequiredParts.join(", ")}.`,
    };
  }

  const documentXml = await extractDocxDocumentXml({ bytes: input.bytes });
  if (documentXml === null) {
    return {
      verdict: "structurally_invalid",
      packageReadable: true,
      missingRequiredParts: [],
      documentXmlPresent: false,
      bodyPlainText: null,
      missingFragments: [...input.requiredFragments],
      emptyBody: true,
      reason: "word/document.xml could not be decoded.",
    };
  }

  const bodyPlainText = extractDocxBodyPlainText({ documentXml });
  const emptyBody = bodyPlainText.trim().length === 0;
  const missingFragments = input.requiredFragments.filter(
    (fragment) => !bodyPlainText.includes(fragment),
  );

  if (input.requiredFragments.length > 0 && emptyBody) {
    return {
      verdict: "content_lost",
      packageReadable: true,
      missingRequiredParts: [],
      documentXmlPresent: true,
      bodyPlainText,
      missingFragments,
      emptyBody: true,
      reason: "Document body is empty; edited content was silently dropped.",
    };
  }

  if (missingFragments.length > 0) {
    return {
      verdict: "content_lost",
      packageReadable: true,
      missingRequiredParts: [],
      documentXmlPresent: true,
      bodyPlainText,
      missingFragments,
      emptyBody,
      reason: `Silent content loss: missing ${missingFragments.join(", ")}.`,
    };
  }

  return {
    verdict: "content_preserved",
    packageReadable: true,
    missingRequiredParts: [],
    documentXmlPresent: true,
    bodyPlainText,
    missingFragments: [],
    emptyBody,
    reason: null,
  };
}

export function summarizeDocxContentIntegrityReport(input: {
  report: DocxContentIntegrityReport;
}): string {
  const { report } = input;
  switch (report.verdict) {
    case "content_preserved":
      return `Content preserved: ${report.bodyPlainText?.length ?? 0} body char(s).`;
    case "content_lost":
      return `Content lost: ${report.reason ?? "edited fragments missing."}`;
    case "structurally_invalid":
      return `Structurally invalid: ${report.reason ?? "package unreadable."}`;
    default: {
      const _exhaustive: never = report.verdict;
      return _exhaustive;
    }
  }
}

/**
 * Markdown edit round-trip: export → structural/content integrity → import.
 * Fails on silent paragraph/heading loss. Package compare vs `basePackage`
 * remains available for packaging_drift vs degraded classification.
 */
export async function evaluateMarkdownDocxRoundTrip(input: {
  markdown: string;
  /** Fragments that must survive export and re-import. Defaults from markdown. */
  requiredFragments?: readonly string[];
  basePackage?: Uint8Array;
}): Promise<MarkdownDocxRoundTripReport> {
  const requiredFragments =
    input.requiredFragments ??
    deriveRequiredFragmentsFromMarkdown({ markdown: input.markdown });

  const exported = await exportMarkdownToDocx({
    markdown: input.markdown,
    basePackage: input.basePackage,
  });

  if (exported.kind === "error") {
    return {
      verdict: "export_failed",
      exportWarnings: [],
      exportedBytes: null,
      packageIntegrity: null,
      reimportedMarkdown: null,
      missingAfterImport: [...requiredFragments],
      packageCompare: null,
      reason: exported.error,
    };
  }

  const packageIntegrity = await assertDocxContentIntegrity({
    bytes: exported.bytes,
    requiredFragments,
  });

  const packageCompare =
    input.basePackage !== undefined
      ? compareDocxPackages({
          before: input.basePackage,
          after: exported.bytes,
        })
      : null;

  if (packageIntegrity.verdict !== "content_preserved") {
    return {
      verdict: packageIntegrity.verdict,
      exportWarnings: exported.warnings,
      exportedBytes: exported.bytes,
      packageIntegrity,
      reimportedMarkdown: null,
      missingAfterImport: [...requiredFragments],
      packageCompare,
      reason: packageIntegrity.reason,
    };
  }

  const imported = await importDocxToMarkdown({ bytes: exported.bytes });
  if (imported.kind === "error") {
    return {
      verdict: "import_failed",
      exportWarnings: exported.warnings,
      exportedBytes: exported.bytes,
      packageIntegrity,
      reimportedMarkdown: null,
      missingAfterImport: [...requiredFragments],
      packageCompare,
      reason: imported.error,
    };
  }

  const reimportedForMatch = normalizeMarkdownForFragmentMatch(
    imported.markdown,
  );
  const missingAfterImport = requiredFragments.filter(
    (fragment) => !reimportedForMatch.includes(fragment),
  );
  if (missingAfterImport.length > 0) {
    return {
      verdict: "content_lost",
      exportWarnings: exported.warnings,
      exportedBytes: exported.bytes,
      packageIntegrity,
      reimportedMarkdown: imported.markdown,
      missingAfterImport,
      packageCompare,
      reason: `Silent content loss after re-import: missing ${missingAfterImport.join(", ")}.`,
    };
  }

  return {
    verdict: "content_preserved",
    exportWarnings: exported.warnings,
    exportedBytes: exported.bytes,
    packageIntegrity,
    reimportedMarkdown: imported.markdown,
    missingAfterImport: [],
    packageCompare,
    reason: null,
  };
}

/**
 * Pull heading titles and non-empty paragraph/list lines from markdown so
 * callers can assert round-trip integrity without hand-listing fragments.
 */
export function deriveRequiredFragmentsFromMarkdown(input: {
  markdown: string;
}): string[] {
  const fragments: string[] = [];
  let inFence = false;

  for (const rawLine of input.markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence || line.length === 0 || line === "---" || line === "***") {
      continue;
    }
    if (/^\|/.test(line)) {
      // Keep non-separator table cell text as fragments.
      if (/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/.test(line)) continue;
      for (const cell of line.split("|")) {
        const plain = stripMarkdownInline(cell.trim());
        if (plain.length > 0) fragments.push(plain);
      }
      continue;
    }

    const heading = line.match(/^#{1,6}\s+(.+)$/);
    if (heading) {
      const plain = stripMarkdownInline(heading[1] ?? "");
      if (plain.length > 0) fragments.push(plain);
      continue;
    }

    const listItem = line.replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, "");
    const plain = stripMarkdownInline(listItem);
    if (plain.length > 0) fragments.push(plain);
  }

  return uniqueFragments(fragments);
}

/**
 * Mammoth (and similar converters) escape punctuation in markdown
 * (`save\-back\.`). Strip those escapes before fragment includes checks so
 * honest punctuation is not treated as silent content loss.
 */
function normalizeMarkdownForFragmentMatch(markdown: string): string {
  return markdown.replace(/\\([\\`*_{}\[\]()#+\-.!|>])/g, "$1");
}

function stripMarkdownInline(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    .trim();
}

function uniqueFragments(fragments: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const fragment of fragments) {
    if (seen.has(fragment)) continue;
    seen.add(fragment);
    out.push(fragment);
  }
  return out;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

async function inflateRaw(payload: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("deflate-raw inflate is unavailable in this runtime.");
  }
  const copy = new Uint8Array(payload.byteLength);
  copy.set(payload);
  const stream = new Blob([copy])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function verdictFromDiffs(diffs: readonly DocxFidelityDiff[]): DocxFidelityVerdict {
  if (diffs.length === 0) return "intact";

  let hasContentLoss = false;
  let hasPackagingDrift = false;
  for (const diff of diffs) {
    switch (diff.kind) {
      case "missing_in_after":
      case "crc_changed":
      case "uncompressed_size_changed":
        hasContentLoss = true;
        break;
      case "added_in_after":
      case "compressed_size_changed":
      case "compression_method_changed":
      case "payload_changed":
      case "flags_changed":
        hasPackagingDrift = true;
        break;
      default: {
        const _exhaustive: never = diff.kind;
        void _exhaustive;
        break;
      }
    }
  }

  if (hasContentLoss) return "degraded";
  if (hasPackagingDrift) return "packaging_drift";
  return "intact";
}

function diffMatchingParts(input: {
  before: DocxPartInventoryEntry;
  after: DocxPartInventoryEntry;
}): DocxFidelityDiff[] {
  const { before, after } = input;
  const diffs: DocxFidelityDiff[] = [];
  const beforeFp = fingerprint(before);
  const afterFp = fingerprint(after);

  const push = (kind: DocxFidelityDiffKind): void => {
    diffs.push({
      kind,
      partName: before.name,
      before: beforeFp,
      after: afterFp,
    });
  };

  if (before.crc32 !== after.crc32) push("crc_changed");
  if (before.uncompressedSize !== after.uncompressedSize) {
    push("uncompressed_size_changed");
  }
  if (before.compressedSize !== after.compressedSize) {
    push("compressed_size_changed");
  }
  if (before.compressionMethod !== after.compressionMethod) {
    push("compression_method_changed");
  }
  if (before.generalPurposeFlags !== after.generalPurposeFlags) {
    push("flags_changed");
  }
  if (!bytesEqual(before.compressedPayload, after.compressedPayload)) {
    push("payload_changed");
  }

  return diffs;
}

function fingerprint(part: DocxPartInventoryEntry): DocxPartFingerprint {
  return {
    crc32: part.crc32,
    compressedSize: part.compressedSize,
    uncompressedSize: part.uncompressedSize,
    compressionMethod: part.compressionMethod,
    generalPurposeFlags: part.generalPurposeFlags,
  };
}

function unreadableReport(input: {
  beforeReadable: boolean;
  afterReadable: boolean;
  reason: string;
}): DocxFidelityReport {
  return {
    verdict: "unreadable",
    beforeReadable: input.beforeReadable,
    afterReadable: input.afterReadable,
    unreadableReason: input.reason,
    diffs: [],
    contentPreservedPartNames: [],
    contentLostPartNames: [],
  };
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

function findZipEndOfCentralDirectory(bytes: Uint8Array): {
  offset: number;
  centralDirectoryOffset: number;
  centralDirectorySize: number;
  entryCount: number;
} | null {
  const minimumOffset = Math.max(0, bytes.byteLength - 65_557);
  for (let offset = bytes.byteLength - 22; offset >= minimumOffset; offset -= 1) {
    if (readUint32(bytes, offset) !== ZIP_END_OF_CENTRAL_DIRECTORY) continue;
    const commentLength = readUint16(bytes, offset + 20);
    if (offset + 22 + commentLength !== bytes.byteLength) continue;
    const diskNumber = readUint16(bytes, offset + 4);
    const centralDirectoryDisk = readUint16(bytes, offset + 6);
    const entriesOnDisk = readUint16(bytes, offset + 8);
    const entryCount = readUint16(bytes, offset + 10);
    const centralDirectorySize = readUint32(bytes, offset + 12);
    const centralDirectoryOffset = readUint32(bytes, offset + 16);
    if (
      diskNumber !== 0 ||
      centralDirectoryDisk !== 0 ||
      entriesOnDisk !== entryCount ||
      entryCount === 0xffff ||
      centralDirectorySize === 0xffffffff ||
      centralDirectoryOffset === 0xffffffff
    ) {
      return null;
    }
    return { offset, centralDirectoryOffset, centralDirectorySize, entryCount };
  }
  return null;
}

function localFileEntry(
  bytes: Uint8Array,
  localHeaderOffset: number,
): {
  nameOffset: number;
  filenameLength: number;
  dataOffset: number;
} | null {
  if (localHeaderOffset + 30 > bytes.byteLength) return null;
  if (readUint32(bytes, localHeaderOffset) !== ZIP_LOCAL_FILE_HEADER) {
    return null;
  }
  const filenameLength = readUint16(bytes, localHeaderOffset + 26);
  const extraLength = readUint16(bytes, localHeaderOffset + 28);
  const nameOffset = localHeaderOffset + 30;
  const dataOffset = nameOffset + filenameLength + extraLength;
  if (dataOffset > bytes.byteLength) return null;
  return { nameOffset, filenameLength, dataOffset };
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
