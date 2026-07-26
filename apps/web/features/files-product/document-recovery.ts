"use client";

export type DocumentRecoveryDraft = {
  fileSourceId: string;
  baseVersion: number;
  content: unknown;
  updatedAt: string;
};

const DATABASE_NAME = "planevo-files";
const DATABASE_VERSION = 3;
const STORE_NAME = "document-recovery";
const MIRROR_STORE_NAME = "local-file-mirrors";
const DELETION_STORE_NAME = "file-deletion-tombstones";

function openRecoveryDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "fileSourceId" });
      }
      if (!database.objectStoreNames.contains(MIRROR_STORE_NAME)) {
        database.createObjectStore(MIRROR_STORE_NAME, {
          keyPath: "fileSourceId",
        });
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

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openRecoveryDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}

export async function readDocumentRecoveryDraft(
  fileSourceId: string,
): Promise<DocumentRecoveryDraft | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    return (
      (await withStore<DocumentRecoveryDraft | undefined>("readonly", (store) =>
        store.get(fileSourceId),
      )) ?? null
    );
  } catch {
    return null;
  }
}

export async function writeDocumentRecoveryDraft(
  draft: DocumentRecoveryDraft,
): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const database = await openRecoveryDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        [STORE_NAME, DELETION_STORE_NAME],
        "readwrite",
      );
      const tombstoneRequest = transaction
        .objectStore(DELETION_STORE_NAME)
        .get(draft.fileSourceId);
      tombstoneRequest.onsuccess = () => {
        if (tombstoneRequest.result === undefined) {
          transaction.objectStore(STORE_NAME).put(draft);
        }
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  } catch {
    // Canonical save remains available when browser recovery storage is blocked.
  } finally {
    database.close();
  }
}

export async function clearDocumentRecoveryDraft(
  fileSourceId: string,
): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    await deleteDocumentRecoveryDraft(fileSourceId);
  } catch {
    // A stale recovery draft is ignored when its base version no longer matches.
  }
}

export async function deleteDocumentRecoveryDraft(
  fileSourceId: string,
): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await withStore("readwrite", (store) => store.delete(fileSourceId));
}
