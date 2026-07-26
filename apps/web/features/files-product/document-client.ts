"use client";

import type {
  DocumentDescriptor,
  DocumentFormat,
} from "@planevo/core/files/document-descriptor";

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
  return payload as LoadedFileDocument;
}

export async function saveFileDocument(input: {
  fileSourceId: string;
  format: DocumentFormat;
  baseVersion: number;
  content: unknown;
  textMetadata?: TextDocumentMetadata;
  checkpointReason?: "checkpoint" | "close" | "import" | "restore";
}): Promise<FileDocumentSaveResult> {
  const response = await fetch(
    `/api/product-files/${encodeURIComponent(input.fileSourceId)}/document`,
    {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        format: input.format,
        baseVersion: input.baseVersion,
        content: input.content,
        ...(input.textMetadata ? { textMetadata: input.textMetadata } : {}),
        ...(input.checkpointReason
          ? { checkpointReason: input.checkpointReason }
          : {}),
      }),
    },
  );
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
