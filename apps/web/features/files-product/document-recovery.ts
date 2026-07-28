"use client";

export type DocumentRecoveryDraft = {
  fileSourceId: string;
  baseVersion: number;
  content: unknown;
  updatedAt: string;
};

import {
  FILES_STORES,
  filesDatabaseAvailable,
  openFilesDatabase,
  withFilesStore,
} from "./files-database";

const STORE_NAME = FILES_STORES.documentRecovery;
const DELETION_STORE_NAME = FILES_STORES.deletionTombstones;

function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return withFilesStore({ store: STORE_NAME, mode, operation });
}

export async function readDocumentRecoveryDraft(
  fileSourceId: string,
): Promise<DocumentRecoveryDraft | null> {
  if (!filesDatabaseAvailable()) return null;
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
  if (!filesDatabaseAvailable()) return;
  // Opening has to be inside the try: callers invoke this as `void write…()` on every idle
  // keystroke burst, so a rejection here surfaces as an unhandled rejection rather than a
  // recoverable failure. Recovery drafts are best-effort — the canonical save is the real one.
  let database: IDBDatabase;
  try {
    database = await openFilesDatabase();
  } catch {
    return;
  }
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
  if (!filesDatabaseAvailable()) return;
  try {
    await deleteDocumentRecoveryDraft(fileSourceId);
  } catch {
    // A stale recovery draft is ignored when its base version no longer matches.
  }
}

export async function deleteDocumentRecoveryDraft(
  fileSourceId: string,
): Promise<void> {
  if (!filesDatabaseAvailable()) return;
  await withStore("readwrite", (store) => store.delete(fileSourceId));
}
