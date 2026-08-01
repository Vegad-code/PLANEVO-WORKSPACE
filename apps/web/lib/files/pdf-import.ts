/**
 * PDF → markdown import for the Files markdown-shell editor.
 *
 * Uses pdfjs-dist text extraction. Text-extractable PDFs become markdown-ish
 * source; scanned / empty / encrypted PDFs return preview-only so the panel
 * keeps the iframe path with an honest banner. Never opens an empty editor
 * for a document with no extractable text.
 *
 * Worker path: browser loads `/pdf.worker.min.mjs` from `apps/web/public`.
 * Node tests use the pdfjs legacy build (no DOMMatrix / worker threads).
 */

import {
  findPdfHeaderOffset,
  validatePdfBytes,
} from "./pdf-structure.ts";

export const PDF_IMPORT_LIMITS_BANNER =
  "Some layout, images, and fonts may not carry over.";

export const PDF_IMPORT_SCANNED_BANNER =
  "This PDF has no editable text. Preview only — use Save a copy to keep a separate PDF on your computer or in Planevo Files.";

export const PDF_IMPORT_ENCRYPTED_BANNER =
  "This PDF is password-protected. Remove its password, then open it again.";

/** Minimum non-whitespace characters before a PDF counts as editable. */
const MIN_EDITABLE_TEXT_CHARS = 8;

/**
 * Vertical gap (PDF user units) that starts a new paragraph.
 * pdf-lib V1 body lines are typically ~18 units apart; keep this under that
 * so real paragraphs split, while same-paragraph wrapped lines (~12–14) stay.
 */
const PARAGRAPH_Y_GAP = 16;

/** Same-line Y tolerance in PDF user units. */
const SAME_LINE_Y_TOLERANCE = 4;

export type PdfImportSuccess = {
  kind: "ok";
  markdown: string;
  warnings: readonly string[];
};

export type PdfImportPreviewOnly = {
  kind: "preview-only";
  reason: "scanned" | "encrypted" | "empty" | "unreadable";
  error: string;
  warnings: readonly string[];
};

export type PdfImportFailure = {
  kind: "error";
  error: string;
};

export type PdfImportResult =
  | PdfImportSuccess
  | PdfImportPreviewOnly
  | PdfImportFailure;

export type PdfTextItem = {
  str: string;
  transform?: number[];
  hasEOL?: boolean;
  width?: number;
  height?: number;
};

export type PdfPageTextContent = {
  items: readonly PdfTextItem[];
};

export type PdfJsPage = {
  getTextContent: () => Promise<PdfPageTextContent>;
};

export type PdfJsDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfJsPage>;
  destroy?: () => Promise<void> | void;
};

export type PdfJsLoadingTask = {
  promise: Promise<PdfJsDocument>;
};

/**
 * Test seam — production uses pdfjs-dist. Injected getDocument keeps node:test
 * free of worker/CSP concerns while still exercising extraction heuristics.
 */
export type PdfImportGetDocument = (input: {
  data: Uint8Array;
  disableWorker?: boolean;
  password?: string;
}) => PdfJsLoadingTask;

export type ImportPdfToMarkdownArgs = {
  bytes: Uint8Array;
  getDocument?: PdfImportGetDocument;
};

let cachedGetDocument: PdfImportGetDocument | null = null;

async function defaultGetDocument(): Promise<PdfImportGetDocument> {
  if (cachedGetDocument) return cachedGetDocument;

  const isNode = typeof window === "undefined";
  if (isNode) {
    // Legacy build works in Node without DOMMatrix / worker threads.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    cachedGetDocument = (input) =>
      (pdfjs.getDocument as (params: Record<string, unknown>) => PdfJsLoadingTask)({
        data: input.data,
        useSystemFonts: true,
        isEvalSupported: false,
        disableWorker: true,
        ...(input.password ? { password: input.password } : {}),
      });
    return cachedGetDocument;
  }

  const pdfjs = await import("pdfjs-dist");
  // Served from apps/web/public — avoids Turbopack worker URL / CSP traps.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  cachedGetDocument = (input) =>
    (pdfjs.getDocument as (params: Record<string, unknown>) => PdfJsLoadingTask)({
      data: input.data,
      useSystemFonts: true,
      isEvalSupported: false,
      ...(input.password ? { password: input.password } : {}),
    });
  return cachedGetDocument;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").trim();
}

function itemY(item: PdfTextItem): number {
  return Array.isArray(item.transform) && typeof item.transform[5] === "number"
    ? item.transform[5]
    : 0;
}

function itemX(item: PdfTextItem): number {
  return Array.isArray(item.transform) && typeof item.transform[4] === "number"
    ? item.transform[4]
    : 0;
}

/** Font size from the text matrix (column vector length) or explicit height. */
function itemFontSize(item: PdfTextItem): number {
  if (typeof item.height === "number" && item.height > 0) {
    return item.height;
  }
  if (!Array.isArray(item.transform) || item.transform.length < 4) {
    return 12;
  }
  const a = item.transform[0] ?? 0;
  const b = item.transform[1] ?? 0;
  const c = item.transform[2] ?? 0;
  const d = item.transform[3] ?? 0;
  const fromMatrix = Math.max(Math.hypot(a, b), Math.hypot(c, d));
  return fromMatrix > 0 ? fromMatrix : 12;
}

function sortItemsReadingOrder(
  items: readonly PdfTextItem[],
): PdfTextItem[] {
  return [...items].sort((left, right) => {
    const yDelta = itemY(right) - itemY(left);
    if (Math.abs(yDelta) > SAME_LINE_Y_TOLERANCE) {
      return yDelta;
    }
    return itemX(left) - itemX(right);
  });
}

/**
 * Group pdf.js text items into paragraphs. Items are sorted into reading
 * order; close Y stays on one line; larger gaps (scaled by font size) start
 * a new paragraph. hasEOL forces a line break.
 */
export function textItemsToMarkdown(
  pages: readonly { pageNumber: number; items: readonly PdfTextItem[] }[],
): string {
  const blocks: string[] = [];

  for (const page of pages) {
    if (page.items.length === 0) continue;

    const ordered = sortItemsReadingOrder(page.items);
    const lines: { y: number; fontSize: number; parts: string[] }[] = [];

    for (const item of ordered) {
      const text = item.str ?? "";
      const fontSize = itemFontSize(item);
      const y = itemY(item);

      if (!text) {
        if (item.hasEOL && lines.length > 0) {
          // Soft break already represented by advancing to the next item's line.
        }
        continue;
      }

      const last = lines[lines.length - 1];
      const sameLine =
        last !== undefined && Math.abs(last.y - y) <= SAME_LINE_Y_TOLERANCE;

      if (!sameLine) {
        lines.push({ y, fontSize, parts: [text] });
      } else {
        const needsSpace =
          last.parts.length > 0 &&
          !/\s$/.test(last.parts[last.parts.length - 1]!) &&
          !/^\s/.test(text);
        last.parts.push(needsSpace ? ` ${text}` : text);
        last.y = y;
        last.fontSize = Math.max(last.fontSize, fontSize);
      }

      if (item.hasEOL) {
        // Force the next non-empty item onto a new line even if Y is close.
        lines.push({ y: y - SAME_LINE_Y_TOLERANCE - 1, fontSize, parts: [] });
      }
    }

    let paragraph: string[] = [];
    let previousY: number | null = null;

    for (const line of lines) {
      const joined = line.parts.join("").replace(/[ \t]+/g, " ").trim();
      if (!joined) continue;

      if (
        previousY !== null &&
        previousY - line.y > PARAGRAPH_Y_GAP &&
        paragraph.length > 0
      ) {
        blocks.push(paragraph.join(" "));
        paragraph = [];
      }
      paragraph.push(joined);
      previousY = line.y;
    }
    if (paragraph.length > 0) {
      blocks.push(paragraph.join(" "));
    }
  }

  return normalizeWhitespace(blocks.join("\n\n"));
}

function isEncryptedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();
  const code =
    "code" in error && typeof (error as { code?: unknown }).code === "number"
      ? (error as { code: number }).code
      : null;
  // pdf.js PasswordResponses.NEED_PASSWORD = 1, INCORRECT_PASSWORD = 2
  if (code === 1 || code === 2) return true;
  return (
    /password|encrypt|need.?password/i.test(message) ||
    /passwordexception/i.test(name)
  );
}

function previewOnly(input: {
  reason: PdfImportPreviewOnly["reason"];
  error: string;
  warnings?: readonly string[];
}): PdfImportPreviewOnly {
  return {
    kind: "preview-only",
    reason: input.reason,
    error: input.error,
    warnings: input.warnings ?? [input.error],
  };
}

function unreadablePreview(error: unknown): PdfImportPreviewOnly {
  const detail =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : null;
  const warning = detail
    ? `Planevo could not extract text from this PDF (${detail}). Preview stays available.`
    : "Planevo could not extract text from this PDF. Preview stays available.";
  return previewOnly({
    reason: "unreadable",
    error: detail ?? "Planevo could not read this PDF.",
    warnings: [warning],
  });
}

async function destroyDocument(document: PdfJsDocument): Promise<void> {
  try {
    await document.destroy?.();
  } catch {
    // Ignore cleanup failures — extraction already finished or failed.
  }
}

export function pdfImportBannerText(input: {
  warnings: readonly string[];
}): string | null {
  if (input.warnings.length === 0) return null;
  if (input.warnings.includes(PDF_IMPORT_SCANNED_BANNER)) {
    return PDF_IMPORT_SCANNED_BANNER;
  }
  if (input.warnings.includes(PDF_IMPORT_ENCRYPTED_BANNER)) {
    return PDF_IMPORT_ENCRYPTED_BANNER;
  }
  if (input.warnings.some((warning) => /could not extract text/i.test(warning))) {
    return input.warnings[0] ?? "Planevo could not extract text from this PDF.";
  }
  return PDF_IMPORT_LIMITS_BANNER;
}

/**
 * Extract markdown from PDF bytes, or report preview-only / error.
 */
export async function importPdfToMarkdown({
  bytes,
  getDocument,
}: ImportPdfToMarkdownArgs): Promise<PdfImportResult> {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    return { kind: "error", error: "PDF bytes are empty or invalid." };
  }

  const headerOffset = findPdfHeaderOffset(bytes);
  if (headerOffset === null) {
    return { kind: "error", error: "This file is not a valid PDF." };
  }

  // Production path: reject truncated packages before pdfjs. Injected
  // getDocument (tests) may use synthetic %PDF stubs without %%EOF.
  if (!getDocument) {
    const structural = bytes.subarray(headerOffset);
    if (!validatePdfBytes(structural)) {
      return {
        kind: "error",
        error: "This PDF looks incomplete or corrupted.",
      };
    }
  }

  const resolveGetDocument = getDocument ?? (await defaultGetDocument());
  // Copy so callers keep an immutable source buffer (mirrors DOCX toMammothInput).
  const data = new Uint8Array(bytes);

  let document: PdfJsDocument;
  try {
    document = await resolveGetDocument({
      data,
      disableWorker: true,
    }).promise;
  } catch (error) {
    if (isEncryptedError(error)) {
      return previewOnly({
        reason: "encrypted",
        error: PDF_IMPORT_ENCRYPTED_BANNER,
      });
    }
    return unreadablePreview(error);
  }

  try {
    if (document.numPages < 1) {
      return previewOnly({
        reason: "empty",
        error: PDF_IMPORT_SCANNED_BANNER,
      });
    }

    const pages: { pageNumber: number; items: readonly PdfTextItem[] }[] = [];
    try {
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push({ pageNumber, items: content.items });
      }
    } catch (error) {
      if (isEncryptedError(error)) {
        return previewOnly({
          reason: "encrypted",
          error: PDF_IMPORT_ENCRYPTED_BANNER,
        });
      }
      // Keep preview-only so the panel can still offer the iframe path.
      return unreadablePreview(error);
    }

    const markdown = textItemsToMarkdown(pages);
    const significant = markdown.replace(/\s+/g, "");
    if (significant.length < MIN_EDITABLE_TEXT_CHARS) {
      return previewOnly({
        reason: significant.length === 0 ? "scanned" : "empty",
        error: PDF_IMPORT_SCANNED_BANNER,
      });
    }

    return {
      kind: "ok",
      markdown,
      warnings: [PDF_IMPORT_LIMITS_BANNER],
    };
  } finally {
    await destroyDocument(document);
  }
}
