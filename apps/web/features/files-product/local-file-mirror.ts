"use client";

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
};

export type LocalMirrorStatus =
  | { state: "unsupported" }
  | { state: "disconnected" }
  | { state: "connected"; name: string; permission: PermissionState }
  | { state: "permission-needed"; name: string }
  | { state: "missing"; name: string };

export class LocalMirrorConflictError extends Error {
  constructor(message = "The computer file changed outside Planevo.") {
    super(message);
    this.name = "LocalMirrorConflictError";
  }
}

const DATABASE_NAME = "planevo-files";
const DATABASE_VERSION = 3;
const RECOVERY_STORE_NAME = "document-recovery";
const STORE_NAME = "local-file-mirrors";
const DELETION_STORE_NAME = "file-deletion-tombstones";

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

export function supportsLocalFileMirror(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof pickerWindow().showOpenFilePicker === "function" &&
    typeof navigator.locks?.request === "function" &&
    window.isSecureContext
  );
}

function openMirrorDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(RECOVERY_STORE_NAME)) {
        database.createObjectStore(RECOVERY_STORE_NAME, {
          keyPath: "fileSourceId",
        });
      }
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "fileSourceId" });
      }
      if (!database.objectStoreNames.contains(DELETION_STORE_NAME)) {
        database.createObjectStore(DELETION_STORE_NAME, {
          keyPath: "fileSourceId",
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

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
  const picker = pickerWindow().showOpenFilePicker;
  if (!supportsLocalFileMirror() || !picker) return { state: "unsupported" };
  const [handle] = await picker({
    multiple: false,
    types: [
      {
        description: "Editable text documents",
        accept: {
          "text/plain": [".txt", ".md", ".markdown"],
          "text/markdown": [".md", ".markdown"],
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
  const [selectedHash, expectedHash] = await Promise.all([
    fileHash(file),
    fileHash(new Blob([expectedContent.slice().buffer as ArrayBuffer])),
  ]);
  if (selectedHash !== expectedHash) {
    throw new LocalMirrorConflictError(
      "That file does not match the current Planevo document. Choose the original file before enabling automatic writeback.",
    );
  }
  await writeRecord({
    fileSourceId,
    handle,
    name: handle.name,
    size: file.size,
    lastModified: file.lastModified,
    contentHash: selectedHash,
    updatedAt: new Date().toISOString(),
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
): Promise<void> {
  const record = await readRecord(fileSourceId);
  if (!record) return;
  const permission = await record.handle.queryPermission({ mode: "readwrite" });
  if (permission !== "granted") {
    throw new Error("Reconnect the computer file to keep saving to it.");
  }

  if (!navigator.locks) {
    throw new Error(
      "Automatic computer writeback requires browser file locking.",
    );
  }
  await navigator.locks.request(
    `planevo-file-${fileSourceId}`,
    { mode: "exclusive" },
    async () => writeWithHandle(record, data),
  );
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
        [RECOVERY_STORE_NAME, STORE_NAME, DELETION_STORE_NAME],
        "readwrite",
      );
      const recoveryStore = transaction.objectStore(RECOVERY_STORE_NAME);
      const mirrorStore = transaction.objectStore(STORE_NAME);
      transaction.objectStore(DELETION_STORE_NAME).put({
        fileSourceId,
        startedAt: new Date().toISOString(),
      });
      const recoveryRequest = recoveryStore.get(fileSourceId);
      const mirrorRequest = mirrorStore.get(fileSourceId);
      const snapshot: LocalDocumentDeletionSnapshot = { fileSourceId };
      let readsCompleted = 0;

      function deleteAfterReads() {
        readsCompleted += 1;
        if (readsCompleted !== 2) return;
        recoveryStore.delete(fileSourceId);
        mirrorStore.delete(fileSourceId);
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
        [RECOVERY_STORE_NAME, STORE_NAME, DELETION_STORE_NAME],
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
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}
