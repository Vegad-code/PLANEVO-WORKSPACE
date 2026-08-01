"use client";

import {
  decodeEditableText,
  encodeEditableText,
} from "@planevo/core/files/text-roundtrip";
import { documentFormatForFile } from "@planevo/core/files/document-descriptor";
import type { ProductFileItem } from "./files-table";
import type {
  FileDocumentSaveResult,
  LoadedFileDocument,
  TextDocumentMetadata,
} from "./document-client";
import {
  clearDocumentRecoveryDraft,
  readDocumentRecoveryDraft,
} from "./document-recovery";
import { FILES_STORES, openFilesDatabase } from "./files-database";
import {
  MAX_LOCAL_BINARY_REVISION_TOTAL_BYTES,
  canRecordLocalDocumentRevision,
  copyLocalDocumentContent,
  localBinaryDocumentContent,
  localDocumentContentBytes,
  localDocumentContentSizeBytes,
  localTextDocumentContent,
  retainLocalDocumentRevisions,
  type LocalDocumentContent,
} from "./local-document-content";
import {
  LocalDocumentStateConflictError,
  LOCAL_DOCUMENT_HISTORY_DAYS,
  MAX_LOCAL_DOCUMENT_REVISIONS,
  buildRestoredLocalDocumentState,
  reconcileLocalDocumentSource,
  selectGlobalLocalRevisionKeys,
} from "./local-document-state";
import {
  LocalMirrorConflictError,
  readLocalFile,
  withLocalFileLock,
  writeLocalMirror,
} from "./local-file-mirror";

const STORE_NAME = FILES_STORES.localDocumentSidecars;

type LocalRevision = {
  id: string;
  version: number;
  content: LocalDocumentContent;
  sizeBytes: number;
  reason: string;
  createdAt: string;
  expiresAt: string;
};

type LocalDocumentSidecar = {
  fileSourceId: string;
  version: number;
  content: LocalDocumentContent;
  note: string;
  revisions: LocalRevision[];
  /** The exact disk source that this sidecar was last reconciled against. */
  sourceFingerprint?: LocalSourceFingerprint;
  updatedAt: string;
};

type LocalSourceFingerprint = {
  contentHash: string;
  size: number;
  lastModified: number;
};

export type LocalDocumentSaveInput = {
  fileSourceId: string;
  baseVersion: number;
  checkpointReason: "checkpoint" | "close";
} &
  (
    | {
        format: "markdown" | "text";
        content: string;
        textMetadata: TextDocumentMetadata;
      }
    | {
        format: "docx" | "pdf";
        content: Uint8Array;
        textMetadata?: never;
      }
  );

export class LocalFileUnavailableError extends Error {
  readonly availability: "permission-needed" | "missing" | "unsupported";

  constructor(
    availability: "permission-needed" | "missing" | "unsupported",
    message: string,
  ) {
    super(message);
    this.name = "LocalFileUnavailableError";
    this.availability = availability;
  }
}

/** A stable conflict the editor can render as a non-destructive resolve/reload choice. */
export class LocalDocumentVersionConflictError extends LocalMirrorConflictError {
  readonly kind = "local-document-version-conflict" as const;

  constructor(
    message = "This document changed in another Planevo tab. Reload before saving again.",
  ) {
    super(message);
    this.name = "LocalDocumentVersionConflictError";
  }
}

const openDatabase = openFilesDatabase;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTextMetadata(value: unknown): value is TextDocumentMetadata {
  if (!isRecord(value)) return false;
  return (
    typeof value.hasUtf8Bom === "boolean" &&
    (value.newline === "lf" || value.newline === "crlf") &&
    typeof value.trailingNewline === "boolean"
  );
}

function localContentFromStored(
  value: unknown,
  legacyTextMetadata?: unknown,
): LocalDocumentContent | null {
  if (typeof value === "string" && isTextMetadata(legacyTextMetadata)) {
    return localTextDocumentContent({
      text: value,
      textMetadata: legacyTextMetadata,
    });
  }
  if (!isRecord(value)) return null;
  if (
    value.kind === "text" &&
    typeof value.text === "string" &&
    isTextMetadata(value.textMetadata)
  ) {
    return localTextDocumentContent({
      text: value.text,
      textMetadata: value.textMetadata,
    });
  }
  if (
    value.kind === "binary" &&
    (value.bytes instanceof ArrayBuffer || ArrayBuffer.isView(value.bytes))
  ) {
    const bytes = value.bytes instanceof ArrayBuffer
      ? new Uint8Array(value.bytes)
      : new Uint8Array(value.bytes.buffer, value.bytes.byteOffset, value.bytes.byteLength);
    return localBinaryDocumentContent(bytes);
  }
  return null;
}

function localRevisionFromStored(value: unknown): LocalRevision | null {
  if (!isRecord(value)) return null;
  const content = localContentFromStored(value.content, value.textMetadata);
  if (
    !content ||
    typeof value.id !== "string" ||
    typeof value.version !== "number" ||
    typeof value.sizeBytes !== "number" ||
    typeof value.reason !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.expiresAt !== "string"
  ) {
    return null;
  }
  return {
    id: value.id,
    version: value.version,
    content,
    sizeBytes: value.sizeBytes,
    reason: value.reason,
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
  };
}

function localSidecarFromStored(value: unknown): LocalDocumentSidecar | null {
  if (!isRecord(value)) return null;
  const content = localContentFromStored(value.content, value.textMetadata);
  if (
    !content ||
    typeof value.fileSourceId !== "string" ||
    typeof value.version !== "number" ||
    typeof value.note !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return null;
  }
  return {
    fileSourceId: value.fileSourceId,
    version: value.version,
    content,
    note: value.note,
    revisions: Array.isArray(value.revisions)
      ? value.revisions
          .map(localRevisionFromStored)
          .filter((revision): revision is LocalRevision => revision !== null)
      : [],
    sourceFingerprint: isRecord(value.sourceFingerprint) &&
      typeof value.sourceFingerprint.contentHash === "string" &&
      typeof value.sourceFingerprint.size === "number" &&
      typeof value.sourceFingerprint.lastModified === "number"
      ? {
          contentHash: value.sourceFingerprint.contentHash,
          size: value.sourceFingerprint.size,
          lastModified: value.sourceFingerprint.lastModified,
        }
      : undefined,
    updatedAt: value.updatedAt,
  };
}

async function readSidecar(
  fileSourceId: string,
): Promise<LocalDocumentSidecar | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .get(fileSourceId);
      request.onsuccess = () => resolve(localSidecarFromStored(request.result));
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

async function writeSidecar(sidecar: LocalDocumentSidecar): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(sidecar);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function bytesForContent(content: LocalDocumentContent): Uint8Array {
  return content.kind === "binary"
    ? localDocumentContentBytes(content)
    : encodeEditableText({
        text: content.text,
        ...content.textMetadata,
      });
}

function revisionQuotaKey(fileSourceId: string, revisionId: string): string {
  return `${fileSourceId}:${revisionId}`;
}

/**
 * Hash recovery draft bytes the same way a completed disk write would, so a crash between
 * disk commit and sidecar commit can be recognized as a finished partial save.
 */
async function recoveryDraftContentHash(
  content: unknown,
  sidecarContent: LocalDocumentContent | null,
): Promise<string | null> {
  if (content instanceof ArrayBuffer) {
    return sha256(new Uint8Array(content));
  }
  if (ArrayBuffer.isView(content)) {
    return sha256(
      new Uint8Array(content.buffer, content.byteOffset, content.byteLength),
    );
  }
  if (typeof content === "string" && sidecarContent?.kind === "text") {
    return sha256(
      encodeEditableText({
        text: content,
        ...sidecarContent.textMetadata,
      }),
    );
  }
  if (typeof content === "string") {
    return sha256(new TextEncoder().encode(content));
  }
  return null;
}

async function readAllSidecars(): Promise<LocalDocumentSidecar[]> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .getAll();
      request.onsuccess = () => {
        const rows = Array.isArray(request.result) ? request.result : [];
        resolve(
          rows
            .map(localSidecarFromStored)
            .filter((sidecar): sidecar is LocalDocumentSidecar => sidecar !== null),
        );
      };
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

/**
 * Apply the global revision budget across every local sidecar so one document's history
 * cannot silently exhaust IndexedDB quota for the rest.
 */
async function pruneGlobalLocalRevisions(now: Date): Promise<void> {
  const sidecars = await readAllSidecars();
  if (sidecars.length === 0) return;

  const quotaEntries = sidecars.flatMap((sidecar) =>
    sidecar.revisions.map((revision) => ({
      key: revisionQuotaKey(sidecar.fileSourceId, revision.id),
      sizeBytes: revision.sizeBytes,
      createdAt: revision.createdAt,
      expiresAt: revision.expiresAt,
    })),
  );
  const retained = selectGlobalLocalRevisionKeys({
    revisions: quotaEntries,
    maximumBytes: MAX_LOCAL_BINARY_REVISION_TOTAL_BYTES,
    now,
  });

  for (const sidecar of sidecars) {
    const nextRevisions = sidecar.revisions.filter((revision) =>
      retained.has(revisionQuotaKey(sidecar.fileSourceId, revision.id)),
    );
    if (nextRevisions.length === sidecar.revisions.length) continue;
    await writeSidecar({
      ...sidecar,
      revisions: nextRevisions,
      updatedAt: now.toISOString(),
    });
  }
}

function sourceFingerprint(input: {
  contentHash: string;
  size: number;
  lastModified: number;
}): LocalSourceFingerprint {
  return {
    contentHash: input.contentHash,
    size: input.size,
    lastModified: input.lastModified,
  };
}

function activeRevisions({
  current,
  revisions,
  now,
  version,
  reason = "external-source",
}: {
  current: LocalDocumentContent;
  revisions: LocalRevision[];
  now: Date;
  version: number;
  reason?: string;
}): LocalRevision[] {
  const currentRevision = canRecordLocalDocumentRevision(current)
    ? [
        {
          id: crypto.randomUUID(),
          version,
          content: copyLocalDocumentContent(current),
          sizeBytes: localDocumentContentSizeBytes(current),
          reason,
          createdAt: now.toISOString(),
          expiresAt: new Date(
            now.getTime() + LOCAL_DOCUMENT_HISTORY_DAYS * 24 * 60 * 60 * 1000,
          ).toISOString(),
        },
      ]
    : [];
  return retainLocalDocumentRevisions(
    [
      ...currentRevision,
      ...revisions.filter(
        (revision) => new Date(revision.expiresAt).getTime() > now.getTime(),
      ),
    ].slice(0, MAX_LOCAL_DOCUMENT_REVISIONS),
  );
}

function descriptorCapabilities() {
  return {
    editPlanevoDocuments: true as const,
    editTextDocuments: true as const,
    automaticIndexing: false,
    createCommentThreads: false,
    localMirror: true,
    pdfAnnotations: false,
  };
}

function loadedRevisions(sidecar: LocalDocumentSidecar) {
  return sidecar.revisions.map((revision) => ({
    id: revision.id,
    version: revision.version,
    size_bytes: revision.sizeBytes,
    reason: revision.reason,
    created_at: revision.createdAt,
    expires_at: revision.expiresAt,
  }));
}

function unavailableMessage(
  state: "permission-needed" | "missing" | "unsupported",
  name: string,
): string {
  if (state === "permission-needed") {
    return `Reconnect ${name} to continue editing.`;
  }
  if (state === "missing") {
    return `${name} was moved or deleted. Locate it again to continue.`;
  }
  return "This browser cannot reopen local computer files.";
}

export async function loadLocalFileDocument(
  file: Pick<ProductFileItem, "id" | "name" | "mime_type">,
): Promise<LoadedFileDocument> {
  return withLocalFileLock({ fileSourceId: file.id, operation: async () => {
    const local = await readLocalFile(file.id);
    if (local.state !== "available") {
      throw new LocalFileUnavailableError(
        local.state,
        unavailableMessage(
          local.state,
          "name" in local ? local.name : file.name,
        ),
      );
    }
    const format = documentFormatForFile({
      name: file.name,
      mimeType: file.mime_type,
      pageId: null,
    });
    if (format !== "markdown" && format !== "text" && format !== "docx" && format !== "pdf") {
      throw new Error("Only Markdown, text, DOCX, and PDF files can stay local-only.");
    }
    const diskContent =
      format === "docx" || format === "pdf"
        ? localBinaryDocumentContent(local.bytes)
        : (() => {
            const decoded = decodeEditableText(local.bytes);
            return localTextDocumentContent({
              text: decoded.text,
              textMetadata: {
                hasUtf8Bom: decoded.hasUtf8Bom,
                newline: decoded.newline,
                trailingNewline: decoded.trailingNewline,
              },
            });
          })();
    const diskHash = await sha256(local.bytes);
    const diskFingerprint = sourceFingerprint({
      contentHash: diskHash,
      size: local.file.size,
      lastModified: local.file.lastModified,
    });
    const existing = await readSidecar(file.id);
    let sidecar: LocalDocumentSidecar;
    if (!existing) {
      sidecar = {
        fileSourceId: file.id,
        version: 0,
        content: diskContent,
        note: "",
        revisions: [],
        sourceFingerprint: diskFingerprint,
        updatedAt: new Date().toISOString(),
      };
    } else {
      const sidecarHash = await sha256(bytesForContent(existing.content));
      const sourceHash =
        existing.sourceFingerprint?.contentHash ?? sidecarHash;
      const draft = await readDocumentRecoveryDraft(file.id);
      const recoveryHash = draft
        ? await recoveryDraftContentHash(draft.content, existing.content)
        : null;
      const recovery =
        draft && recoveryHash
          ? { baseVersion: draft.baseVersion, contentHash: recoveryHash }
          : draft
            ? {
                // Opaque recovery still counts as meaningful local work — never match disk.
                baseVersion: draft.baseVersion,
                contentHash: `__recovery__:${draft.updatedAt}`,
              }
            : null;

      let decision;
      try {
        decision = reconcileLocalDocumentSource({
          version: existing.version,
          sourceHash,
          sidecarHash,
          diskHash,
          recovery,
        });
      } catch (error) {
        if (error instanceof LocalDocumentStateConflictError) {
          throw new LocalMirrorConflictError(error.message);
        }
        throw error;
      }

      const now = new Date();
      if (decision.action === "keep-sidecar") {
        sidecar = {
          ...existing,
          sourceFingerprint: diskFingerprint,
          updatedAt: now.toISOString(),
        };
      } else {
        sidecar = {
          ...existing,
          version: decision.version,
          content: diskContent,
          revisions: decision.checkpointPriorContent
            ? activeRevisions({
                current: existing.content,
                revisions: existing.revisions,
                now,
                version: existing.version,
                reason: decision.reason,
              })
            : existing.revisions,
          sourceFingerprint: diskFingerprint,
          updatedAt: now.toISOString(),
        };
      }
      if (decision.clearRecovery) {
        await clearDocumentRecoveryDraft(file.id);
      }
    }
    await writeSidecar(sidecar);
    await pruneGlobalLocalRevisions(new Date());
    return {
    descriptor: {
      fileSourceId: file.id,
      pageId: null,
      name: file.name,
      mimeType: file.mime_type,
      format,
      currentVersion: sidecar.version,
      contentHash: await sha256(local.bytes),
      indexedVersion: null,
      capabilities: descriptorCapabilities(),
      canonicalSource: "local",
    },
    content:
      sidecar.content.kind === "binary"
        ? localDocumentContentBytes(sidecar.content)
        : sidecar.content.text,
    textMetadata:
      sidecar.content.kind === "text"
        ? sidecar.content.textMetadata
        : undefined,
    note: sidecar.note
      ? { content: sidecar.note, updated_at: sidecar.updatedAt }
      : null,
    revisions: loadedRevisions(sidecar),
    commentThreads: [],
    };
  }});
}

export async function saveLocalFileDocument(
  input: LocalDocumentSaveInput,
): Promise<FileDocumentSaveResult> {
  return withLocalFileLock({ fileSourceId: input.fileSourceId, operation: async () => {
  const sidecar = await readSidecar(input.fileSourceId);
  if (!sidecar) throw new Error("The local document state is unavailable.");
  if (sidecar.version !== input.baseVersion) {
    throw new LocalDocumentVersionConflictError();
  }
  let content;
  switch (input.format) {
    case "docx":
    case "pdf":
      content = localBinaryDocumentContent(input.content);
      break;
    case "markdown":
    case "text":
      content = localTextDocumentContent({
        text: input.content,
        textMetadata: input.textMetadata,
      });
      break;
    default: {
      const _exhaustive: never = input;
      throw new Error(`Unsupported local document format: ${String(_exhaustive)}`);
    }
  }
  const bytes =
    content.kind === "binary"
      ? localDocumentContentBytes(content)
      : encodeEditableText({
          text: content.text,
          ...content.textMetadata,
        });
  await writeLocalMirror(input.fileSourceId, bytes, { alreadyLocked: true });
  const nextVersion = sidecar.version + 1;
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + LOCAL_DOCUMENT_HISTORY_DAYS * 24 * 60 * 60 * 1000,
  );
  const priorRevision = canRecordLocalDocumentRevision(sidecar.content)
    ? [
        {
          id: crypto.randomUUID(),
          version: sidecar.version,
          content: copyLocalDocumentContent(sidecar.content),
          sizeBytes: localDocumentContentSizeBytes(sidecar.content),
          reason: input.checkpointReason,
          createdAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
      ]
    : [];
  const revisions = retainLocalDocumentRevisions([
    ...priorRevision,
    ...sidecar.revisions.filter(
      (revision) => new Date(revision.expiresAt).getTime() > now.getTime(),
    ),
  ].slice(0, MAX_LOCAL_DOCUMENT_REVISIONS));
  await writeSidecar({
    ...sidecar,
    version: nextVersion,
    content,
    revisions,
    sourceFingerprint: sourceFingerprint({
      contentHash: await sha256(bytes),
      size: bytes.byteLength,
      lastModified: Date.now(),
    }),
    updatedAt: now.toISOString(),
  });
  await pruneGlobalLocalRevisions(now);
  return {
    version: nextVersion,
    contentHash: await sha256(bytes),
    checkpointed: true,
    mirrorSaved: true,
    mirrorError: null,
  };
  }});
}

export async function saveLocalFileNote(
  fileSourceId: string,
  note: string,
): Promise<boolean> {
  return withLocalFileLock({ fileSourceId, operation: async () => {
    const sidecar = await readSidecar(fileSourceId);
    if (!sidecar) return false;
    await writeSidecar({
      ...sidecar,
      note,
      updatedAt: new Date().toISOString(),
    });
    return true;
  }});
}

export async function restoreLocalFileRevision(
  fileSourceId: string,
  revisionId: string,
  baseVersion: number,
): Promise<void> {
  await withLocalFileLock({ fileSourceId, operation: async () => {
  const sidecar = await readSidecar(fileSourceId);
  if (!sidecar) throw new Error("That local revision is unavailable.");

  let restored;
  try {
    restored = buildRestoredLocalDocumentState({
      version: sidecar.version,
      baseVersion,
      content: sidecar.content,
      revisions: sidecar.revisions,
      revisionId,
      revisionIdFactory: () => crypto.randomUUID(),
      now: new Date(),
    });
  } catch (error) {
    if (error instanceof LocalDocumentStateConflictError) {
      throw new LocalDocumentVersionConflictError(error.message);
    }
    throw error;
  }

  const bytes =
    restored.content.kind === "binary"
      ? localDocumentContentBytes(restored.content)
      : encodeEditableText({
          text: restored.content.text,
          ...restored.content.textMetadata,
        });
  await writeLocalMirror(fileSourceId, bytes, { alreadyLocked: true });
  const contentHash = await sha256(bytes);
  await writeSidecar({
    ...sidecar,
    version: restored.version,
    content: restored.content,
    revisions: restored.revisions,
    sourceFingerprint: sourceFingerprint({
      contentHash,
      size: bytes.byteLength,
      lastModified: Date.now(),
    }),
    updatedAt: new Date().toISOString(),
  });
  await pruneGlobalLocalRevisions(new Date());
  }});
}
