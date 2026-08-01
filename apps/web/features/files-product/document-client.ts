"use client";

import type {
  DocumentDescriptor,
  DocumentFormat,
} from "@planevo/core/files/document-descriptor";
import {
  buildDocxLoadRequest,
  buildDocxSaveRequest,
  parseDocxResponseVersion,
  shouldRetryDocxLoad,
  type DocumentCheckpointReason,
} from "./docx-document-transport";
import {
  buildPdfLoadRequest,
  buildPdfSaveRequest,
  parsePdfResponseVersion,
  shouldRetryPdfLoad,
} from "./pdf-document-transport";

export type TextDocumentMetadata = {
  hasUtf8Bom: boolean;
  newline: "lf" | "crlf";
  trailingNewline: boolean;
};

export type LoadedFileDocument = {
  descriptor: DocumentDescriptor;
  content: unknown;
  textMetadata?: TextDocumentMetadata;
  note: { content: string; updated_at: string } | null;
  revisions: Array<{
    id: string;
    version: number;
    size_bytes: number;
    reason: string;
    created_at: string;
    expires_at: string;
  }>;
  commentThreads: Array<{
    id: string;
    anchor_json: unknown;
    resolved_at: string | null;
    created_at: string;
    updated_at: string;
    comments: Array<{
      id: string;
      thread_id: string;
      body: string;
      created_at: string;
      updated_at: string;
    }>;
  }>;
};

export type FileDocumentSaveResult = {
  version: number;
  contentHash: string;
  checkpointed: boolean;
  mirrorSaved?: boolean;
  mirrorError?: string | null;
};

export class DocumentVersionConflictError extends Error {
  readonly currentVersion: number | null;

  constructor(currentVersion: number | null) {
    super("This document changed somewhere else.");
    this.name = "DocumentVersionConflictError";
    this.currentVersion = currentVersion;
  }
}

async function responsePayload(
  response: Response,
): Promise<Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as Record<string, unknown>;
}

export async function loadFileDocument(
  fileSourceId: string,
  signal?: AbortSignal,
  retryOnVersionMismatch = true,
): Promise<LoadedFileDocument> {
  const response = await fetch(
    `/api/product-files/${encodeURIComponent(fileSourceId)}/document`,
    { signal, cache: "no-store" },
  );
  const payload = await responsePayload(response);
  if (!response.ok || !payload.descriptor) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : "Could not open this document.",
    );
  }
  const document = payload as LoadedFileDocument;
  if (
    document.descriptor.format !== "docx" &&
    document.descriptor.format !== "pdf"
  ) {
    return document;
  }

  const isPdf = document.descriptor.format === "pdf";
  const binaryResponse = await fetch(
    isPdf
      ? buildPdfLoadRequest({ fileSourceId })
      : buildDocxLoadRequest({ fileSourceId }),
    { signal, cache: "no-store" },
  );
  if (!binaryResponse.ok) {
    const shouldRetry = isPdf
      ? shouldRetryPdfLoad({
          status: binaryResponse.status,
          retryHeader: binaryResponse.headers.get("x-planevo-pdf-retry"),
          hasRetried: !retryOnVersionMismatch,
        })
      : shouldRetryDocxLoad({
          status: binaryResponse.status,
          retryHeader: binaryResponse.headers.get("x-planevo-docx-retry"),
          hasRetried: !retryOnVersionMismatch,
        });
    if (shouldRetry) {
      return loadFileDocument(fileSourceId, signal, false);
    }
    const binaryPayload = await responsePayload(binaryResponse);
    throw new Error(
      typeof binaryPayload.error === "string"
        ? binaryPayload.error
        : isPdf
          ? "Could not load this PDF document."
          : "Could not load this DOCX document.",
    );
  }
  const loadedVersion = isPdf
    ? parsePdfResponseVersion(
        binaryResponse.headers.get("x-planevo-document-version"),
      )
    : parseDocxResponseVersion(
        binaryResponse.headers.get("x-planevo-document-version"),
      );
  if (
    loadedVersion !== null &&
    loadedVersion !== document.descriptor.currentVersion &&
    retryOnVersionMismatch
  ) {
    // A save landed between descriptor and byte reads. One reload aligns the
    // optimistic version with the opaque bytes without trusting stale data.
    return loadFileDocument(fileSourceId, signal, false);
  }
  const loadedHash = binaryResponse.headers.get("x-planevo-content-hash");
  return {
    ...document,
    descriptor:
      loadedVersion !== null &&
      loadedVersion !== document.descriptor.currentVersion
        ? {
            ...document.descriptor,
            currentVersion: loadedVersion,
            contentHash: loadedHash || null,
          }
        : document.descriptor,
    content: new Uint8Array(await binaryResponse.arrayBuffer()),
  };
}

export async function saveFileDocument(input: {
  fileSourceId: string;
  format: DocumentFormat;
  baseVersion: number;
  content: unknown;
  textMetadata?: TextDocumentMetadata;
  checkpointReason?: DocumentCheckpointReason;
}): Promise<FileDocumentSaveResult> {
  const request =
    input.format === "docx"
      ? (() => {
          if (!(input.content instanceof Uint8Array)) {
            throw new Error("DOCX saves require exact byte content.");
          }
          return buildDocxSaveRequest({
            fileSourceId: input.fileSourceId,
            baseVersion: input.baseVersion,
            content: input.content,
            checkpointReason: input.checkpointReason,
          });
        })()
      : input.format === "pdf"
        ? (() => {
            if (!(input.content instanceof Uint8Array)) {
              throw new Error("PDF saves require exact byte content.");
            }
            return buildPdfSaveRequest({
              fileSourceId: input.fileSourceId,
              baseVersion: input.baseVersion,
              content: input.content,
              checkpointReason: input.checkpointReason,
            });
          })()
      : {
          url: `/api/product-files/${encodeURIComponent(input.fileSourceId)}/document`,
          init: {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              format: input.format,
              baseVersion: input.baseVersion,
              content: input.content,
              ...(input.textMetadata
                ? { textMetadata: input.textMetadata }
                : {}),
              ...(input.checkpointReason
                ? { checkpointReason: input.checkpointReason }
                : {}),
            }),
          },
        };
  const response = await fetch(request.url, request.init);
  const payload = await responsePayload(response);
  if (response.status === 409) {
    throw new DocumentVersionConflictError(
      typeof payload.currentVersion === "number"
        ? payload.currentVersion
        : null,
    );
  }
  if (!response.ok || typeof payload.version !== "number") {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : "Could not save this document.",
    );
  }
  return payload as FileDocumentSaveResult;
}

export async function updateFileDocumentSidebar(
  fileSourceId: string,
  update:
    | { action: "save-note"; content: string }
    | {
        action: "create-comment";
        body: string;
        anchor?: Record<string, unknown>;
      }
    | { action: "resolve-comment"; threadId: string; resolved: boolean },
): Promise<void> {
  const response = await fetch(
    `/api/product-files/${encodeURIComponent(fileSourceId)}/document`,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(update),
    },
  );
  const payload = await responsePayload(response);
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : "Could not update this document.",
    );
  }
}

export async function restoreFileDocumentRevision(
  fileSourceId: string,
  revisionId: string,
  baseVersion: number,
): Promise<{ version: number }> {
  const response = await fetch(
    `/api/product-files/${encodeURIComponent(fileSourceId)}/document`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revisionId, baseVersion }),
    },
  );
  const payload = await responsePayload(response);
  if (!response.ok || typeof payload.version !== "number") {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : "Could not restore this version.",
    );
  }
  return { version: payload.version };
}
