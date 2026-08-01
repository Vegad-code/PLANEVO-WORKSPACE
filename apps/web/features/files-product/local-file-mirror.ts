"use client";

import { FILES_STORES, openFilesDatabase } from "./files-database";
import {
  DOCX_MIME_TYPE,
  validateLocalEditableFileMetadata,
} from "./local-document-content";

type FilePermissionMode = "read" | "readwrite";

type PlanevoFileHandle = {
  name: string;
  getFile: () => Promise<File>;
  queryPermission: (options: {
    mode: FilePermissionMode;
  }) => Promise<PermissionState>;
  requestPermission: (options: {
    mode: FilePermissionMode;
  }) => Promise<PermissionState>;
  createWritable: (options?: {
    keepExistingData?: boolean;
    mode?: "exclusive" | "siloed";
  }) => Promise<{
    write: (data: BufferSource | Blob | string) => Promise<void>;
    close: () => Promise<void>;
    abort: () => Promise<void>;
  }>;
};

export type PickedLocalFile = {
  handle: PlanevoFileHandle;
  file: File;
  bytes: Uint8Array;
};

export type LocalFileReadResult =
  | { state: "available"; file: File; bytes: Uint8Array }
  | { state: "permission-needed"; name: string }
  | { state: "missing"; name: string }
  | { state: "unsupported" };

type LocalMirrorRecord = {
  fileSourceId: string;
  handle: PlanevoFileHandle;
  name: string;
  size: number;
  lastModified: number;
  contentHash?: string;
  updatedAt: string;
};

export type LocalDocumentDeletionSnapshot = {
  fileSourceId: string;
  recoveryDraft?: unknown;
  mirrorRecord?: LocalMirrorRecord;
  localSidecar?: unknown;
};

export type LocalMirrorStatus =
  | { state: "unsupported" }
  | { state: "disconnected" }
  | { state: "connected"; name: string; permission: PermissionState }
  | { state: "permission-needed"; name: string }
  | { state: "missing"; name: string };

export class LocalMirrorConflictError extends Error {
  readonly kind:
    | "local-file-conflict"
    | "local-document-version-conflict" = "local-file-conflict";

  constructor(message = "The computer file changed outside Planevo.") {
    super(message);
    this.name = "LocalMirrorConflictError";
  }
}

const RECOVERY_STORE_NAME = FILES_STORES.documentRecovery;
const STORE_NAME = FILES_STORES.localFileMirrors;
const DELETION_STORE_NAME = FILES_STORES.deletionTombstones;
const LOCAL_DOCUMENT_STORE_NAME = FILES_STORES.localDocumentSidecars;

export type LocateLocalMirrorInput = {
  fileSourceId: string;
  /** The source identity captured when the document was last safely opened. */
  expectedSourceHash?: string;
  /** Convenience for callers that have the source bytes but not their hash. */
  expectedContent?: Uint8Array;
  format: "markdown" | "text" | "docx";
  /** Only pass this after the user explicitly chose Save As. */
  allowSaveAs?: boolean;
};

function pickerWindow(): Window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
  }) => Promise<PlanevoFileHandle[]>;
} {
  return window;
}

async function fileHash(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await file.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function isDocxFile(file: File): boolean {
  return fileExtension(file.name) === "docx" &&
    (!file.type || file.type === DOCX_MIME_TYPE || file.type === "application/octet-stream");
}

function assertLocalEditableFile(file: File): void {
  validateLocalEditableFileMetadata({
    name: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  });
}

/**
 * One lock spans a local document's sidecar version check, disk write, and sidecar commit.
 * Callers that are already inside this lock pass `alreadyLocked` to writeLocalMirror so we
 * never request the non-reentrant Web Lock a second time.
 */
export async function withLocalFileLock<T>({
  fileSourceId,
  operation,
}: {
  fileSourceId: string;
  operation: () => Promise<T>;
}): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks) {
    throw new Error("Automatic computer writeback requires browser file locking.");
  }
  return navigator.locks.request(
    `planevo-file-${fileSourceId}`,
    { mode: "exclusive" },
    operation,
  );
}

export function supportsLocalFileMirror(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof pickerWindow().showOpenFilePicker === "function" &&
    typeof navigator.locks?.request === "function" &&
    window.isSecureContext
  );
}

export async function pickLocalEditableFile(): Promise<PickedLocalFile> {
  const picker = pickerWindow().showOpenFilePicker;
  if (!supportsLocalFileMirror() || !picker) {
    throw new Error(
      "Opening local files requires a secure desktop browser with file access.",
    );
  }
  const [handle] = await picker({
    multiple: false,
    types: [
      {
        description: "Markdown, text, and DOCX documents",
        accept: {
          "text/plain": [".txt", ".md", ".markdown"],
          "text/markdown": [".md", ".markdown"],
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
            ".docx",
          ],
        },
      },
    ],
  });
  if (!handle) throw new DOMException("No file selected.", "AbortError");
  const permission = await handle.requestPermission({ mode: "readwrite" });
  if (permission !== "granted") {
    throw new Error("Planevo needs permission to save back to this file.");
  }
  const file = await handle.getFile();
  assertLocalEditableFile(file);
  return {
    handle,
    file,
    bytes: new Uint8Array(await file.arrayBuffer()),
  };
}

export async function attachPickedLocalFile(
  fileSourceId: string,
  picked: PickedLocalFile,
): Promise<void> {
  await writeRecord({
    fileSourceId,
    handle: picked.handle,
    name: picked.file.name,
    size: picked.file.size,
    lastModified: picked.file.lastModified,
    contentHash: await fileHash(picked.file),
    updatedAt: new Date().toISOString(),
  });
}

export async function readLocalFile(
  fileSourceId: string,
): Promise<LocalFileReadResult> {
  if (!supportsLocalFileMirror()) return { state: "unsupported" };
  const record = await readRecord(fileSourceId);
  if (!record) return { state: "missing", name: "Local file" };
  try {
    const permission = await record.handle.queryPermission({ mode: "readwrite" });
    if (permission !== "granted") {
      return { state: "permission-needed", name: record.name };
    }
    const file = await record.handle.getFile();
    return {
      state: "available",
      file,
      bytes: new Uint8Array(await file.arrayBuffer()),
    };
  } catch (cause) {
    return (cause as { name?: string })?.name === "NotFoundError"
      ? { state: "missing", name: record.name }
      : { state: "permission-needed", name: record.name };
  }
}

const openMirrorDatabase = openFilesDatabase;

async function readRecord(
  fileSourceId: string,
): Promise<LocalMirrorRecord | null> {
  if (typeof indexedDB === "undefined") return null;
  const database = await openMirrorDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .get(fileSourceId);
      request.onsuccess = () =>
        resolve((request.result as LocalMirrorRecord | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

async function writeRecord(record: LocalMirrorRecord): Promise<void> {
  const database = await openMirrorDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        [STORE_NAME, DELETION_STORE_NAME],
        "readwrite",
      );
      const tombstoneRequest = transaction
        .objectStore(DELETION_STORE_NAME)
        .get(record.fileSourceId);
      tombstoneRequest.onsuccess = () => {
        if (tombstoneRequest.result === undefined) {
          transaction.objectStore(STORE_NAME).put(record);
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function localMirrorStatus(
  fileSourceId: string,
): Promise<LocalMirrorStatus> {
  if (!supportsLocalFileMirror()) return { state: "unsupported" };
  const record = await readRecord(fileSourceId);
  if (!record) return { state: "disconnected" };
  try {
    const permission = await record.handle.queryPermission({
      mode: "readwrite",
    });
    if (permission !== "granted") {
      return { state: "permission-needed", name: record.name };
    }
    await record.handle.getFile();
    return { state: "connected", name: record.name, permission };
  } catch (cause) {
    return (cause as { name?: string })?.name === "NotFoundError"
      ? { state: "missing", name: record.name }
      : { state: "permission-needed", name: record.name };
  }
}

export async function connectLocalMirror(
  fileSourceId: string,
  expectedContent: Uint8Array,
): Promise<LocalMirrorStatus> {
  return locateAndRebindLocalMirror({
    fileSourceId,
    expectedContent,
    format: "text",
  });
}

/**
 * User-gesture-only recovery for a cleared or moved handle. Unless this is an explicit Save As,
 * the selected source must still be byte-identical to the known source so reconnecting cannot
 * redirect autosave onto a similarly named but different document.
 */
export async function locateAndRebindLocalMirror({
  fileSourceId,
  expectedSourceHash,
  expectedContent,
  format,
  allowSaveAs = false,
}: LocateLocalMirrorInput): Promise<LocalMirrorStatus> {
  const picker = pickerWindow().showOpenFilePicker;
  if (!supportsLocalFileMirror() || !picker) return { state: "unsupported" };
  const [handle] = await picker({
    multiple: false,
    types: [
      {
        description: "Editable Markdown, text, and DOCX documents",
        accept: {
          "text/plain": [".txt", ".md", ".markdown"],
          "text/markdown": [".md", ".markdown"],
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
            ".docx",
          ],
        },
      },
    ],
  });
  if (!handle) return { state: "disconnected" };
  const permission = await handle.requestPermission({ mode: "readwrite" });
  if (permission !== "granted") {
    return { state: "permission-needed", name: handle.name };
  }
  const file = await handle.getFile();
  assertLocalEditableFile(file);
  if (format === "docx" && !isDocxFile(file)) {
    throw new LocalMirrorConflictError("Choose the original DOCX file to reconnect it.");
  }
  const selectedHash = await fileHash(file);
  const contentHash = expectedContent
    ? await fileHash(new Blob([expectedContent.slice().buffer as ArrayBuffer]))
    : undefined;
  const expectedHash = expectedSourceHash ?? contentHash;
  if (!allowSaveAs && !expectedHash) {
    throw new LocalMirrorConflictError(
      "Planevo cannot verify this file without its original source fingerprint.",
    );
  }
  if (!allowSaveAs && selectedHash !== expectedHash) {
    throw new LocalMirrorConflictError(
      "That file does not match the current Planevo document. Choose the original file before enabling automatic writeback.",
    );
  }
  await withLocalFileLock({
    fileSourceId,
    operation: () => writeRecord({
      fileSourceId,
      handle,
      name: handle.name,
      size: file.size,
      lastModified: file.lastModified,
      contentHash: selectedHash,
      updatedAt: new Date().toISOString(),
    }),
  });
  return { state: "connected", name: handle.name, permission };
}

export async function reconnectLocalMirror(
  fileSourceId: string,
): Promise<LocalMirrorStatus> {
  const record = await readRecord(fileSourceId);
  if (!record) return { state: "disconnected" };
  const permission = await record.handle.requestPermission({
    mode: "readwrite",
  });
  return permission === "granted"
    ? { state: "connected", name: record.name, permission }
    : { state: "permission-needed", name: record.name };
}

async function writeWithHandle(
  record: LocalMirrorRecord,
  data: Uint8Array,
): Promise<void> {
  if (await hasDeletionTombstone(record.fileSourceId)) {
    throw new Error(
      "This file is being deleted and can no longer be mirrored.",
    );
  }
  const current = await record.handle.getFile();
  if (
    current.size !== record.size ||
    current.lastModified !== record.lastModified ||
    (record.contentHash !== undefined &&
      (await fileHash(current)) !== record.contentHash)
  ) {
    throw new LocalMirrorConflictError();
  }

  const writable = await record.handle.createWritable({
    keepExistingData: false,
    mode: "exclusive",
  });
  try {
    await writable.write(
      new Blob([data.slice().buffer as ArrayBuffer], {
        type: "application/octet-stream",
      }),
    );
    await writable.close();
  } catch (cause) {
    await writable.abort().catch(() => undefined);
    throw cause;
  }

  const saved = await record.handle.getFile();
  await writeRecord({
    ...record,
    size: saved.size,
    lastModified: saved.lastModified,
    contentHash: await fileHash(saved),
    updatedAt: new Date().toISOString(),
  });

  const channel = new BroadcastChannel(`planevo-file-${record.fileSourceId}`);
  channel.postMessage({ type: "saved", lastModified: saved.lastModified });
  channel.close();
}

export async function writeLocalMirror(
  fileSourceId: string,
  data: Uint8Array,
  options: { alreadyLocked?: boolean } = {},
): Promise<void> {
  const write = async () => {
    const record = await readRecord(fileSourceId);
    if (!record) {
      throw new LocalMirrorConflictError(
        "Planevo can no longer access the original computer file. Locate it before saving.",
      );
    }
    const permission = await record.handle.queryPermission({ mode: "readwrite" });
    if (permission !== "granted") {
      throw new Error("Reconnect the computer file to keep saving to it.");
    }
    await writeWithHandle(record, data);
  };
  if (options.alreadyLocked) {
    await write();
    return;
  }
  await withLocalFileLock({ fileSourceId, operation: write });
}

export async function forgetLocalMirror(fileSourceId: string): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const database = await openMirrorDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(fileSourceId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function detachLocalDocumentStateForDeletion(
  fileSourceId: string,
): Promise<LocalDocumentDeletionSnapshot> {
  const detach = () => detachLocalDocumentStateTransaction(fileSourceId);
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request(
      `planevo-file-${fileSourceId}`,
      { mode: "exclusive" },
      detach,
    );
  }
  return detach();
}

async function detachLocalDocumentStateTransaction(
  fileSourceId: string,
): Promise<LocalDocumentDeletionSnapshot> {
  if (typeof indexedDB === "undefined") return { fileSourceId };
  const database = await openMirrorDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(
        [
          RECOVERY_STORE_NAME,
          STORE_NAME,
          DELETION_STORE_NAME,
          LOCAL_DOCUMENT_STORE_NAME,
        ],
        "readwrite",
      );
      const recoveryStore = transaction.objectStore(RECOVERY_STORE_NAME);
      const mirrorStore = transaction.objectStore(STORE_NAME);
      const sidecarStore = transaction.objectStore(LOCAL_DOCUMENT_STORE_NAME);
      transaction.objectStore(DELETION_STORE_NAME).put({
        fileSourceId,
        startedAt: new Date().toISOString(),
      });
      const recoveryRequest = recoveryStore.get(fileSourceId);
      const mirrorRequest = mirrorStore.get(fileSourceId);
      const sidecarRequest = sidecarStore.get(fileSourceId);
      const snapshot: LocalDocumentDeletionSnapshot = { fileSourceId };
      let readsCompleted = 0;

      function deleteAfterReads() {
        readsCompleted += 1;
        if (readsCompleted !== 3) return;
        recoveryStore.delete(fileSourceId);
        mirrorStore.delete(fileSourceId);
        sidecarStore.delete(fileSourceId);
      }

      recoveryRequest.onsuccess = () => {
        if (recoveryRequest.result !== undefined) {
          snapshot.recoveryDraft = recoveryRequest.result;
        }
        deleteAfterReads();
      };
      mirrorRequest.onsuccess = () => {
        if (mirrorRequest.result !== undefined) {
          snapshot.mirrorRecord = mirrorRequest.result as LocalMirrorRecord;
        }
        deleteAfterReads();
      };
      sidecarRequest.onsuccess = () => {
        if (sidecarRequest.result !== undefined) {
          snapshot.localSidecar = sidecarRequest.result;
        }
        deleteAfterReads();
      };
      transaction.oncomplete = () => resolve(snapshot);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

async function hasDeletionTombstone(fileSourceId: string): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  const database = await openMirrorDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(DELETION_STORE_NAME, "readonly");
      const request = transaction
        .objectStore(DELETION_STORE_NAME)
        .get(fileSourceId);
      request.onsuccess = () => resolve(request.result !== undefined);
      request.onerror = () => reject(request.error);
    });
  } finally {
    database.close();
  }
}

export async function restoreLocalDocumentStateAfterFailedDeletion(
  snapshot: LocalDocumentDeletionSnapshot,
): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const database = await openMirrorDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        [
          RECOVERY_STORE_NAME,
          STORE_NAME,
          DELETION_STORE_NAME,
          LOCAL_DOCUMENT_STORE_NAME,
        ],
        "readwrite",
      );
      transaction
        .objectStore(DELETION_STORE_NAME)
        .delete(snapshot.fileSourceId);
      if (snapshot.recoveryDraft !== undefined) {
        transaction
          .objectStore(RECOVERY_STORE_NAME)
          .put(snapshot.recoveryDraft);
      }
      if (snapshot.mirrorRecord !== undefined) {
        transaction.objectStore(STORE_NAME).put(snapshot.mirrorRecord);
      }
      if (snapshot.localSidecar !== undefined) {
        transaction
          .objectStore(LOCAL_DOCUMENT_STORE_NAME)
          .put(snapshot.localSidecar);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}
