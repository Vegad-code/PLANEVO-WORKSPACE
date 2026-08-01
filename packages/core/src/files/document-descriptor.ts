import type { DocumentCapabilities } from "./document-capabilities.ts";

export const DOCUMENT_FORMATS = [
  "planevo",
  "markdown",
  "text",
  "pdf",
  "docx",
  "binary",
] as const;

export type DocumentFormat = (typeof DOCUMENT_FORMATS)[number];

export type DocumentDescriptor = {
  fileSourceId: string;
  pageId: string | null;
  name: string;
  mimeType: string | null;
  format: DocumentFormat;
  currentVersion: number;
  contentHash: string | null;
  indexedVersion: number | null;
  capabilities: DocumentCapabilities;
  canonicalSource: "planevo" | "storage" | "local";
};

export function documentFormatForFile(input: {
  name: string;
  mimeType: string | null;
  pageId: string | null;
}): DocumentFormat {
  if (
    input.pageId ||
    input.mimeType === "application/x-planevo-page"
  ) {
    return "planevo";
  }

  const lowerName = input.name.toLowerCase();
  const mimeType = input.mimeType?.toLowerCase() ?? "";

  if (
    lowerName.endsWith(".md") ||
    lowerName.endsWith(".markdown") ||
    mimeType === "text/markdown"
  ) {
    return "markdown";
  }
  if (
    lowerName.endsWith(".txt") ||
    mimeType === "text/plain"
  ) {
    return "text";
  }
  if (lowerName.endsWith(".pdf") || mimeType === "application/pdf") {
    return "pdf";
  }
  if (
    lowerName.endsWith(".docx") ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  return "binary";
}

/**
 * Static editability for list UI and API guards. PDF is intentionally excluded:
 * text vs scanned is decided at open time via `openPdfDocument` (runtime probe).
 * The Files panel still opens PDFs — see `requiresRuntimeEditProbe`.
 */
export function isEditableDocumentFormat(
  format: DocumentFormat,
): boolean {
  return (
    format === "planevo" ||
    format === "markdown" ||
    format === "text" ||
    format === "docx"
  );
}

/** Formats that open the editor panel but may fall back to preview-only after probe. */
export function requiresRuntimeEditProbe(
  format: DocumentFormat,
): boolean {
  return format === "pdf";
}

export function opensInDocumentEditorPanel(
  format: DocumentFormat,
): boolean {
  return isEditableDocumentFormat(format) || requiresRuntimeEditProbe(format);
}
