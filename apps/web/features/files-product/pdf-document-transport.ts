/**
 * PDF structural validator + raw-byte transport for Files save/load.
 *
 * PDF bodies stay opaque from the browser to Storage. Metadata travels in
 * headers so no byte can be coerced through JSON or a text decoder.
 */

import {
  pdfBytesDeclareEncryption,
  validatePdfBytes,
  validatePdfSaveBytes,
} from "../../lib/files/pdf-structure.ts";

export {
  pdfBytesDeclareEncryption,
  validatePdfBytes,
  validatePdfSaveBytes,
};

export const PDF_MIME_TYPE = "application/pdf";

export type DocumentCheckpointReason =
  | "checkpoint"
  | "close"
  | "import"
  | "restore";

const CHECKPOINT_REASONS = new Set<DocumentCheckpointReason>([
  "checkpoint",
  "close",
  "import",
  "restore",
]);

export function buildPdfLoadRequest(input: { fileSourceId: string }): string {
  return `/api/product-files/${encodeURIComponent(input.fileSourceId)}/document?content=pdf`;
}

export function parsePdfResponseVersion(value: string | null): number | null {
  if (value === null || !/^(0|[1-9]\d*)$/.test(value)) return null;
  const version = Number(value);
  return Number.isSafeInteger(version) ? version : null;
}

export function shouldRetryPdfLoad(input: {
  status: number;
  retryHeader: string | null;
  hasRetried: boolean;
}): boolean {
  return (
    !input.hasRetried &&
    input.status === 409 &&
    input.retryHeader === "document-content-mismatch"
  );
}

export function buildPdfSaveRequest(input: {
  fileSourceId: string;
  baseVersion: number;
  content: Uint8Array;
  checkpointReason?: DocumentCheckpointReason;
}): { url: string; init: RequestInit } {
  if (!Number.isSafeInteger(input.baseVersion) || input.baseVersion < 0) {
    throw new Error("A PDF save requires a valid document version.");
  }
  // Save path rejects encrypted packages (load still allows preview-only).
  if (!validatePdfSaveBytes(input.content)) {
    throw new Error(
      pdfBytesDeclareEncryption(input.content)
        ? "Encrypted PDFs cannot be saved back from the editor."
        : "A PDF save requires a structurally valid PDF document.",
    );
  }

  return {
    url: `/api/product-files/${encodeURIComponent(input.fileSourceId)}/document`,
    init: {
      method: "PUT",
      headers: {
        "content-type": PDF_MIME_TYPE,
        "x-planevo-document-format": "pdf",
        "x-planevo-document-version": String(input.baseVersion),
        "x-planevo-document-checkpoint": input.checkpointReason ?? "checkpoint",
      },
      body: input.content as unknown as BodyInit,
    },
  };
}

export function parsePdfSaveMetadata(
  headers: Pick<Headers, "get">,
): { baseVersion: number; checkpointReason: DocumentCheckpointReason } | null {
  if (
    headers.get("content-type")?.trim().toLowerCase() !== PDF_MIME_TYPE ||
    headers.get("x-planevo-document-format") !== "pdf"
  ) {
    return null;
  }

  const rawVersion = headers.get("x-planevo-document-version");
  const checkpointReason =
    headers.get("x-planevo-document-checkpoint") ?? "checkpoint";
  if (
    rawVersion === null ||
    !/^(0|[1-9]\d*)$/.test(rawVersion) ||
    !CHECKPOINT_REASONS.has(checkpointReason as DocumentCheckpointReason)
  ) {
    return null;
  }

  const baseVersion = Number(rawVersion);
  if (!Number.isSafeInteger(baseVersion)) return null;
  return {
    baseVersion,
    checkpointReason: checkpointReason as DocumentCheckpointReason,
  };
}
