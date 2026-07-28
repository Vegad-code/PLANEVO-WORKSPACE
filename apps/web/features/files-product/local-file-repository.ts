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
import { readLocalFile, writeLocalMirror } from "./local-file-mirror";
import { FILES_STORES, openFilesDatabase } from "./files-database";

const STORE_NAME = FILES_STORES.localDocumentSidecars;
const LOCAL_HISTORY_DAYS = 7;
const MAX_LOCAL_REVISIONS = 20;

type LocalRevision = {
  id: string;
  version: number;
  content: string;
  textMetadata: TextDocumentMetadata;
  sizeBytes: number;
  reason: string;
  createdAt: string;
  expiresAt: string;
};

type LocalDocumentSidecar = {
  fileSourceId: string;
  version: number;
  content: string;
  textMetadata: TextDocumentMetadata;
  note: string;
  revisions: LocalRevision[];
  updatedAt: string;
};

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

const openDatabase = openFilesDatabase;

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
      request.onsuccess = () =>
        resolve((request.result as LocalDocumentSidecar | undefined) ?? null);
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
  const decoded = decodeEditableText(local.bytes);
  const existing = await readSidecar(file.id);
  const sidecar: LocalDocumentSidecar = {
    fileSourceId: file.id,
    version: existing?.version ?? 0,
    content: decoded.text,
    textMetadata: {
      hasUtf8Bom: decoded.hasUtf8Bom,
      newline: decoded.newline,
      trailingNewline: decoded.trailingNewline,
    },
    note: existing?.note ?? "",
    revisions: existing?.revisions ?? [],
    updatedAt: new Date().toISOString(),
  };
  await writeSidecar(sidecar);
  const format = documentFormatForFile({
    name: file.name,
    mimeType: file.mime_type,
    pageId: null,
  });
  if (format !== "markdown" && format !== "text") {
    throw new Error("Only Markdown and text files can stay local-only.");
  }
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
    content: decoded.text,
    textMetadata: sidecar.textMetadata,
    note: sidecar.note
      ? { content: sidecar.note, updated_at: sidecar.updatedAt }
      : null,
    revisions: loadedRevisions(sidecar),
    commentThreads: [],
  };
}

export async function saveLocalFileDocument(input: {
  fileSourceId: string;
  baseVersion: number;
  content: string;
  textMetadata: TextDocumentMetadata;
  checkpointReason: "checkpoint" | "close";
}): Promise<FileDocumentSaveResult> {
  const sidecar = await readSidecar(input.fileSourceId);
  if (!sidecar) throw new Error("The local document state is unavailable.");
  if (sidecar.version !== input.baseVersion) {
    throw new Error("The local document changed in another Planevo tab.");
  }
  const bytes = encodeEditableText({
    text: input.content,
    hasUtf8Bom: input.textMetadata.hasUtf8Bom,
    newline: input.textMetadata.newline,
    trailingNewline: input.textMetadata.trailingNewline,
  });
  await writeLocalMirror(input.fileSourceId, bytes);
  const nextVersion = sidecar.version + 1;
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + LOCAL_HISTORY_DAYS * 24 * 60 * 60 * 1000,
  );
  const revisions = [
    {
      id: crypto.randomUUID(),
      version: sidecar.version,
      content: sidecar.content,
      textMetadata: sidecar.textMetadata,
      sizeBytes: new TextEncoder().encode(sidecar.content).byteLength,
      reason: input.checkpointReason,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    },
    ...sidecar.revisions.filter(
      (revision) => new Date(revision.expiresAt).getTime() > now.getTime(),
    ),
  ].slice(0, MAX_LOCAL_REVISIONS);
  await writeSidecar({
    ...sidecar,
    version: nextVersion,
    content: input.content,
    textMetadata: {
      hasUtf8Bom: input.textMetadata.hasUtf8Bom,
      newline: input.textMetadata.newline,
      trailingNewline: input.textMetadata.trailingNewline,
    },
    revisions,
    updatedAt: now.toISOString(),
  });
  return {
    version: nextVersion,
    contentHash: await sha256(bytes),
    checkpointed: true,
    mirrorSaved: true,
    mirrorError: null,
  };
}

export async function saveLocalFileNote(
  fileSourceId: string,
  note: string,
): Promise<boolean> {
  const sidecar = await readSidecar(fileSourceId);
  if (!sidecar) return false;
  await writeSidecar({
    ...sidecar,
    note,
    updatedAt: new Date().toISOString(),
  });
  return true;
}

export async function restoreLocalFileRevision(
  fileSourceId: string,
  revisionId: string,
): Promise<void> {
  const sidecar = await readSidecar(fileSourceId);
  const revision = sidecar?.revisions.find((item) => item.id === revisionId);
  if (!sidecar || !revision) throw new Error("That local revision is unavailable.");
  const bytes = encodeEditableText({
    text: revision.content,
    ...revision.textMetadata,
  });
  await writeLocalMirror(fileSourceId, bytes);
  await writeSidecar({
    ...sidecar,
    version: sidecar.version + 1,
    content: revision.content,
    textMetadata: revision.textMetadata,
    updatedAt: new Date().toISOString(),
  });
}
