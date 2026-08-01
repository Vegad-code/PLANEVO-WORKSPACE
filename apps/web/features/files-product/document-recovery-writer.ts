export type DocumentRecoveryDraft = {
  fileSourceId: string;
  baseVersion: number;
  content: unknown;
  updatedAt: string;
};

export type DocumentRecoveryStorage = {
  isAvailable: () => boolean;
  open: () => Promise<Pick<IDBDatabase, "transaction" | "close">>;
  recoveryStoreName: string;
  deletionStoreName: string;
};

export type DocumentRecoveryWriter = {
  writeBestEffort: (draft: DocumentRecoveryDraft) => Promise<void>;
  writeStrict: (draft: DocumentRecoveryDraft) => Promise<void>;
};

function storageUnavailableError(): Error {
  return new Error("Browser recovery storage is unavailable.");
}

async function writeRecoveryDraft(
  storage: DocumentRecoveryStorage,
  draft: DocumentRecoveryDraft,
): Promise<void> {
  if (!storage.isAvailable()) throw storageUnavailableError();

  const database = await storage.open();
  try {
    await new Promise<void>((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = database.transaction(
          [storage.recoveryStoreName, storage.deletionStoreName],
          "readwrite",
        );
      } catch (error) {
        reject(error);
        return;
      }
      const rejectTransaction = () =>
        reject(transaction.error ?? new Error("Recovery transaction failed."));
      transaction.onerror = rejectTransaction;
      transaction.onabort = rejectTransaction;
      transaction.oncomplete = () => resolve();

      try {
        const tombstoneRequest = transaction
          .objectStore(storage.deletionStoreName)
          .get(draft.fileSourceId);
        tombstoneRequest.onerror = () =>
          reject(
            tombstoneRequest.error ??
              new Error("Could not read recovery deletion state."),
          );
        tombstoneRequest.onsuccess = () => {
          if (tombstoneRequest.result === undefined) {
            transaction.objectStore(storage.recoveryStoreName).put(draft);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  } finally {
    database.close();
  }
}

/**
 * Legacy text/Planevo drafts are opportunistic, while DOCX needs an observed
 * durable write before the original binary can be replaced.
 */
export function createDocumentRecoveryWriter(
  storage: DocumentRecoveryStorage,
): DocumentRecoveryWriter {
  return {
    writeBestEffort: async (draft) => {
      try {
        await writeRecoveryDraft(storage, draft);
      } catch {
        // Existing text and Planevo callers deliberately remain non-blocking.
      }
    },
    writeStrict: (draft) => writeRecoveryDraft(storage, draft),
  };
}
