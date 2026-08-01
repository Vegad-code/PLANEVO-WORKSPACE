/**
 * PDF fidelity harness — text-centric integrity for the markdown-shell pivot.
 *
 * Two axes:
 * 1) Package snapshot/compare (`comparePdfPackages`) — classifies intact /
 *    packaging_drift / degraded / unreadable. Producer metadata and
 *    recompression/object rewriting stay packaging_drift when extracted text
 *    is preserved. Not a bit-identical page-layout bar.
 * 2) Markdown round-trip — exported bytes must be a valid PDF; body text must
 *    retain user-edited paragraphs/headings; silent empty bodies fail
 *    (MD → PDF → MD via pdf-export + pdf-import).
 */

import { PDFDocument } from "pdf-lib";

import { exportMarkdownToPdf } from "./pdf-export.ts";
import { importPdfToMarkdown } from "./pdf-import.ts";
import { validatePdfBytes } from "./pdf-structure.ts";

export type PdfFidelityDiffKind =
  | "bytes_changed"
  | "text_changed"
  | "page_count_changed"
  | "metadata_changed";

export type PdfPackageSnapshot = {
  readable: boolean;
  pageCount: number;
  byteLength: number;
  bodyPlainText: string;
  normalizedText: string;
  producer: string | null;
  title: string | null;
  unreadableReason: string | null;
};

export type PdfFidelityDiff = {
  kind: PdfFidelityDiffKind;
  before: string | number | null;
  after: string | number | null;
};

export type PdfFidelityVerdict =
  | "intact"
  | "packaging_drift"
  | "degraded"
  | "unreadable";

export type PdfFidelityReport = {
  verdict: PdfFidelityVerdict;
  beforeReadable: boolean;
  afterReadable: boolean;
  unreadableReason: string | null;
  diffs: readonly PdfFidelityDiff[];
  before: PdfPackageSnapshot | null;
  after: PdfPackageSnapshot | null;
};

export type PdfContentIntegrityVerdict =
  | "content_preserved"
  | "content_lost"
  | "structurally_invalid";

export type PdfContentIntegrityReport = {
  verdict: PdfContentIntegrityVerdict;
  packageReadable: boolean;
  pageCount: number;
  bodyPlainText: string | null;
  missingFragments: readonly string[];
  emptyBody: boolean;
  reason: string | null;
};

export type MarkdownPdfRoundTripVerdict =
  | PdfContentIntegrityVerdict
  | "export_failed"
  | "import_failed";

export type MarkdownPdfRoundTripReport = {
  verdict: MarkdownPdfRoundTripVerdict;
  exportWarnings: readonly string[];
  exportedBytes: Uint8Array | null;
  packageIntegrity: PdfContentIntegrityReport | null;
  reimportedMarkdown: string | null;
  missingAfterImport: readonly string[];
  /**
   * Snapshot compare of `basePackage` vs export when a base was supplied.
   * Edited saves often report `degraded` here (page text intentionally
   * changed) while content integrity still passes — that distinction is the
   * markdown-shell reframe. Packaging-only rewrites stay packaging_drift.
   */
  packageCompare: PdfFidelityReport | null;
  reason: string | null;
};

/**
 * Inventory a PDF into a text/structure snapshot for fidelity compare.
 * Returns an unreadable snapshot (readable: false) when magic/pdf-lib fail.
 */
export async function inventoryPdfPackage(input: {
  bytes: Uint8Array;
}): Promise<PdfPackageSnapshot> {
  if (!validatePdfBytes(input.bytes)) {
    return {
      readable: false,
      pageCount: 0,
      byteLength: input.bytes.byteLength,
      bodyPlainText: "",
      normalizedText: "",
      producer: null,
      title: null,
      unreadableReason: "PDF structure is invalid (missing %PDF or %%EOF).",
    };
  }

  let pageCount = 0;
  let producer: string | null = null;
  let title: string | null = null;

  try {
    const doc = await PDFDocument.load(input.bytes, { ignoreEncryption: true });
    pageCount = doc.getPageCount();
    producer = doc.getProducer() ?? null;
    title = doc.getTitle() ?? null;
  } catch (error) {
    return {
      readable: false,
      pageCount: 0,
      byteLength: input.bytes.byteLength,
      bodyPlainText: "",
      normalizedText: "",
      producer: null,
      title: null,
      unreadableReason:
        error instanceof Error
          ? error.message
          : "pdf-lib could not parse the PDF.",
    };
  }

  const bodyPlainText = await extractPdfBodyPlainText({ bytes: input.bytes });
  return {
    readable: true,
    pageCount,
    byteLength: input.bytes.byteLength,
    bodyPlainText,
    normalizedText: normalizeForMatch(bodyPlainText),
    producer,
    title,
    unreadableReason: null,
  };
}

/**
 * Snapshot-by-snapshot fidelity compare. Text loss yields `degraded`.
 * Byte/metadata/page-count drift with preserved text yields
 * `packaging_drift`. Identical snapshots yield `intact`.
 *
 * Never claims bit-identical layout — only text + structural readability.
 */
export async function comparePdfPackages(input: {
  before: Uint8Array;
  after: Uint8Array;
}): Promise<PdfFidelityReport> {
  const before = await inventoryPdfPackage({ bytes: input.before });
  const after = await inventoryPdfPackage({ bytes: input.after });

  if (!before.readable && !after.readable) {
    return unreadableReport({
      beforeReadable: false,
      afterReadable: false,
      reason: "Neither PDF is structurally readable.",
      before,
      after,
    });
  }
  if (!before.readable) {
    return unreadableReport({
      beforeReadable: false,
      afterReadable: true,
      reason: before.unreadableReason ?? "Before PDF is not readable.",
      before,
      after,
    });
  }
  if (!after.readable) {
    return unreadableReport({
      beforeReadable: true,
      afterReadable: false,
      reason: after.unreadableReason ?? "After PDF is not readable.",
      before,
      after,
    });
  }

  const diffs: PdfFidelityDiff[] = [];

  if (before.normalizedText !== after.normalizedText) {
    diffs.push({
      kind: "text_changed",
      before: before.normalizedText,
      after: after.normalizedText,
    });
  }
  if (before.pageCount !== after.pageCount) {
    diffs.push({
      kind: "page_count_changed",
      before: before.pageCount,
      after: after.pageCount,
    });
  }
  if (
    before.producer !== after.producer ||
    before.title !== after.title
  ) {
    diffs.push({
      kind: "metadata_changed",
      before: `${before.producer ?? ""}|${before.title ?? ""}`,
      after: `${after.producer ?? ""}|${after.title ?? ""}`,
    });
  }
  if (!bytesEqual(input.before, input.after)) {
    diffs.push({
      kind: "bytes_changed",
      before: before.byteLength,
      after: after.byteLength,
    });
  }

  return {
    verdict: verdictFromDiffs(diffs),
    beforeReadable: true,
    afterReadable: true,
    unreadableReason: null,
    diffs,
    before,
    after,
  };
}

export function isPdfFidelityDegraded(input: {
  report: PdfFidelityReport;
}): boolean {
  return input.report.verdict === "degraded";
}

export function summarizePdfFidelityReport(input: {
  report: PdfFidelityReport;
}): string {
  const { report } = input;
  switch (report.verdict) {
    case "intact":
      return `Intact: text and structure match (${report.after?.pageCount ?? 0} page(s)).`;
    case "packaging_drift":
      return `Packaging drift only: extracted text preserved; ${report.diffs.length} packaging/structural diff(s).`;
    case "degraded":
      return `Degraded: extracted text lost or changed; ${report.diffs.length} total diff(s).`;
    case "unreadable":
      return `Unreadable: ${report.unreadableReason ?? "packages could not be inventoried."}`;
    default: {
      const _exhaustive: never = report.verdict;
      return _exhaustive;
    }
  }
}

/**
 * Extract plain text via the same import path the editor uses. Returns "" when
 * the PDF has no extractable text (scanned / empty) rather than inventing body.
 */
export async function extractPdfBodyPlainText(input: {
  bytes: Uint8Array;
}): Promise<string> {
  const imported = await importPdfToMarkdown({ bytes: input.bytes });
  if (imported.kind === "ok") return imported.markdown;
  return "";
}

/**
 * Content-integrity gate for a saved PDF: structurally readable, pdf-lib
 * loadable, non-empty body when fragments are expected, and every required
 * fragment present in extracted plain text.
 */
export async function assertPdfContentIntegrity(input: {
  bytes: Uint8Array;
  requiredFragments?: readonly string[];
}): Promise<PdfContentIntegrityReport> {
  const requiredFragments = input.requiredFragments ?? [];

  if (!validatePdfBytes(input.bytes)) {
    return {
      verdict: "structurally_invalid",
      packageReadable: false,
      pageCount: 0,
      bodyPlainText: null,
      missingFragments: [...requiredFragments],
      emptyBody: true,
      reason: "PDF structure is invalid (missing %PDF or %%EOF).",
    };
  }

  let pageCount = 0;
  try {
    const doc = await PDFDocument.load(input.bytes, { ignoreEncryption: true });
    pageCount = doc.getPageCount();
    if (pageCount < 1) {
      return {
        verdict: "structurally_invalid",
        packageReadable: true,
        pageCount: 0,
        bodyPlainText: null,
        missingFragments: [...requiredFragments],
        emptyBody: true,
        reason: "PDF has no pages.",
      };
    }
  } catch (error) {
    return {
      verdict: "structurally_invalid",
      packageReadable: false,
      pageCount: 0,
      bodyPlainText: null,
      missingFragments: [...requiredFragments],
      emptyBody: true,
      reason:
        error instanceof Error
          ? error.message
          : "pdf-lib could not parse the PDF.",
    };
  }

  const bodyPlainText = await extractPdfBodyPlainText({ bytes: input.bytes });
  const normalizedBody = normalizeForMatch(bodyPlainText);
  const emptyBody = normalizedBody.length === 0;
  const missingFragments = requiredFragments.filter(
    (fragment) => !normalizedBody.includes(normalizeForMatch(fragment)),
  );

  if (requiredFragments.length > 0 && emptyBody) {
    return {
      verdict: "content_lost",
      packageReadable: true,
      pageCount,
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
      pageCount,
      bodyPlainText,
      missingFragments,
      emptyBody,
      reason: `Silent content loss: missing ${missingFragments.join(", ")}.`,
    };
  }

  return {
    verdict: "content_preserved",
    packageReadable: true,
    pageCount,
    bodyPlainText,
    missingFragments: [],
    emptyBody,
    reason: null,
  };
}

export function summarizePdfContentIntegrityReport(input: {
  report: PdfContentIntegrityReport;
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
export async function evaluateMarkdownPdfRoundTrip(input: {
  markdown: string;
  /** Fragments that must survive export and re-import. Defaults from markdown. */
  requiredFragments?: readonly string[];
  basePackage?: Uint8Array;
}): Promise<MarkdownPdfRoundTripReport> {
  const requiredFragments =
    input.requiredFragments ??
    deriveRequiredFragmentsFromMarkdown({ markdown: input.markdown });

  const exported = await exportMarkdownToPdf({
    markdown: input.markdown,
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

  const packageIntegrity = await assertPdfContentIntegrity({
    bytes: exported.bytes,
    requiredFragments,
  });

  const packageCompare =
    input.basePackage !== undefined
      ? await comparePdfPackages({
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

  const imported = await importPdfToMarkdown({ bytes: exported.bytes });
  if (imported.kind !== "ok") {
    return {
      verdict: "import_failed",
      exportWarnings: exported.warnings,
      exportedBytes: exported.bytes,
      packageIntegrity,
      reimportedMarkdown: null,
      missingAfterImport: [...requiredFragments],
      packageCompare,
      reason:
        imported.kind === "error"
          ? imported.error
          : imported.error ?? "PDF re-import did not yield editable text.",
    };
  }

  const reimportedForMatch = normalizeForMatch(imported.markdown);
  const missingAfterImport = requiredFragments.filter(
    (fragment) => !reimportedForMatch.includes(normalizeForMatch(fragment)),
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

export function summarizeMarkdownPdfRoundTripReport(input: {
  report: MarkdownPdfRoundTripReport;
}): string {
  const { report } = input;
  switch (report.verdict) {
    case "content_preserved":
      return "Markdown↔PDF round-trip preserved edited content.";
    case "content_lost":
      return `Content lost: ${report.reason ?? "edited fragments missing."}`;
    case "structurally_invalid":
      return `Structurally invalid: ${report.reason ?? "export was not a valid PDF."}`;
    case "export_failed":
      return `Export failed: ${report.reason ?? "unknown export error."}`;
    case "import_failed":
      return `Import failed: ${report.reason ?? "re-import did not yield text."}`;
    default: {
      const _exhaustive: never = report.verdict;
      return _exhaustive;
    }
  }
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

    const listItem = line
      .replace(/^[-*+]\s+/, "")
      .replace(/^\d+\.\s+/, "")
      .replace(/^>\s?/, "");
    const plain = stripMarkdownInline(listItem);
    if (plain.length > 0) fragments.push(plain);
  }

  return uniqueFragments(fragments);
}

export function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[#*_`>\-•]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function verdictFromDiffs(
  diffs: readonly PdfFidelityDiff[],
): PdfFidelityVerdict {
  if (diffs.length === 0) return "intact";

  let hasContentLoss = false;
  let hasPackagingDrift = false;
  for (const diff of diffs) {
    switch (diff.kind) {
      case "text_changed":
        hasContentLoss = true;
        break;
      case "bytes_changed":
      case "page_count_changed":
      case "metadata_changed":
        hasPackagingDrift = true;
        break;
      default: {
        const _exhaustive: never = diff.kind;
        void _exhaustive;
        break;
      }
    }
  }

  // Text loss dominates even when packaging also drifted.
  if (hasContentLoss) return "degraded";
  if (hasPackagingDrift) return "packaging_drift";
  return "intact";
}

function unreadableReport(input: {
  beforeReadable: boolean;
  afterReadable: boolean;
  reason: string;
  before: PdfPackageSnapshot;
  after: PdfPackageSnapshot;
}): PdfFidelityReport {
  return {
    verdict: "unreadable",
    beforeReadable: input.beforeReadable,
    afterReadable: input.afterReadable,
    unreadableReason: input.reason,
    diffs: [],
    before: input.before,
    after: input.after,
  };
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}
