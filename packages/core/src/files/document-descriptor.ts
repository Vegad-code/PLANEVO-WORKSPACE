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
  canonicalSource: "planevo" | "storage";
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

export function isEditableDocumentFormat(
  format: DocumentFormat,
): boolean {
  return (
    format === "planevo" ||
    format === "markdown" ||
    format === "text"
  );
}
