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
import { createDocumentRecoveryWriter } from "./document-recovery-writer";

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

function filesDocumentRecoveryWriter() {
  return createDocumentRecoveryWriter({
    isAvailable: filesDatabaseAvailable,
    open: openFilesDatabase,
    recoveryStoreName: STORE_NAME,
    deletionStoreName: DELETION_STORE_NAME,
  });
}

export async function writeDocumentRecoveryDraft(
  draft: DocumentRecoveryDraft,
): Promise<void> {
  // Text/Planevo callers invoke this as `void write…()` on every idle keystroke
  // burst — keep best-effort so blocked storage never becomes an unhandled rejection.
  await filesDocumentRecoveryWriter().writeBestEffort(draft);
}

/**
 * DOCX autosave must observe a durable recovery draft before replacing the
 * original. Unavailable storage, open failure, abort, and quota reject.
 */
export async function writeDocumentRecoveryDraftStrict(
  draft: DocumentRecoveryDraft,
): Promise<void> {
  await filesDocumentRecoveryWriter().writeStrict(draft);
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
