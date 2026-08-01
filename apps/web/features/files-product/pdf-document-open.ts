/**
 * PDF open probe — editable markdown shell vs preview-only iframe.
 *
 * Runtime gate (not static descriptor): scanned / encrypted / empty PDFs stay
 * preview-only so list UI never promises edit on non-text files.
 */

import {
  importPdfToMarkdown,
  pdfImportBannerText,
  type PdfImportGetDocument,
  type PdfImportResult,
} from "../../lib/files/pdf-import.ts";

export type OpenPdfDocumentArgs = {
  bytes: Uint8Array;
  /** Test seam — forwarded to importPdfToMarkdown. */
  getDocument?: PdfImportGetDocument;
};

export type OpenPdfDocumentEditable = {
  kind: "editable";
  bytes: Uint8Array;
  markdown: string;
  warnings: readonly string[];
  bannerText: string | null;
};

export type OpenPdfDocumentPreviewOnly = {
  kind: "preview-only";
  reason: "scanned" | "encrypted" | "empty" | "unreadable";
  error: string;
  warnings: readonly string[];
  bannerText: string;
};

export type OpenPdfDocumentFailure = {
  kind: "error";
  error: string;
};

export type OpenPdfDocumentResult =
  | OpenPdfDocumentEditable
  | OpenPdfDocumentPreviewOnly
  | OpenPdfDocumentFailure;

function fromImport(input: {
  imported: PdfImportResult;
  bytes: Uint8Array;
}): OpenPdfDocumentResult {
  const { imported, bytes } = input;
  switch (imported.kind) {
    case "ok":
      return {
        kind: "editable",
        bytes: new Uint8Array(bytes),
        markdown: imported.markdown,
        warnings: imported.warnings,
        bannerText: pdfImportBannerText({ warnings: imported.warnings }),
      };
    case "preview-only":
      return {
        kind: "preview-only",
        reason: imported.reason,
        error: imported.error,
        warnings: imported.warnings,
        bannerText:
          pdfImportBannerText({ warnings: imported.warnings }) ??
          imported.error,
      };
    case "error":
      return { kind: "error", error: imported.error };
    default: {
      const _exhaustive: never = imported;
      return _exhaustive;
    }
  }
}

/**
 * Probe PDF bytes for the Files panel: editable shell or honest preview-only.
 */
export async function openPdfDocument({
  bytes,
  getDocument,
}: OpenPdfDocumentArgs): Promise<OpenPdfDocumentResult> {
  const imported = await importPdfToMarkdown({ bytes, getDocument });
  return fromImport({ imported, bytes });
}
