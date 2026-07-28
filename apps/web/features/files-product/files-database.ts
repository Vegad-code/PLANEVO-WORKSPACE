"use client";

/**
 * Single owner of the Files product's IndexedDB database.
 *
 * Every store below lives in ONE database, so the name, the version, and the full schema have to
 * be declared in exactly one place. They previously were not: three modules each opened
 * "planevo-files" with their own `indexedDB.open()` call, and when one asked for version 3 while
 * the others asked for 4, the browser threw
 * `VersionError: The requested version (3) is less than the existing version (4)`
 * on every read and write from the stale module.
 *
 * Adding a store means adding it to FILES_STORES, creating it in the upgrade handler, and bumping
 * FILES_DATABASE_VERSION once — here, not at a call site.
 */

const DATABASE_NAME = "planevo-files";

/** Bump when FILES_STORES gains an entry. Never fork this per module. */
export const FILES_DATABASE_VERSION = 4;

export const FILES_STORES = {
  documentRecovery: "document-recovery",
  localFileMirrors: "local-file-mirrors",
  deletionTombstones: "file-deletion-tombstones",
  localDocumentSidecars: "local-document-sidecars",
} as const;

export type FilesStoreName =
  (typeof FILES_STORES)[keyof typeof FILES_STORES];

export function filesDatabaseAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export function openFilesDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, FILES_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      // Every store, every time — an upgrade from any older version must land on the full schema.
      for (const store of Object.values(FILES_STORES)) {
        if (!database.objectStoreNames.contains(store)) {
          database.createObjectStore(store, { keyPath: "fileSourceId" });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    // Fires when another tab holds an open connection at the older version; without this the
    // promise would hang forever instead of failing in a way callers can report.
    request.onblocked = () =>
      reject(
        new Error(
          "Another Planevo tab is using an older version of local storage. Close it and reload.",
        ),
      );
  });
}

/**
 * Run one request against one store and close the connection.
 *
 * Connections are opened per operation rather than pooled because these stores are written at
 * human speed (a recovery draft per idle keystroke burst), and a long-lived connection would
 * block upgrades in other tabs.
 */
export async function withFilesStore<T>({
  store,
  mode,
  operation,
}: {
  store: FilesStoreName;
  mode: IDBTransactionMode;
  operation: (store: IDBObjectStore) => IDBRequest<T>;
}): Promise<T> {
  const database = await openFilesDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(store, mode);
      const request = operation(transaction.objectStore(store));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.onerror = () => reject(transaction.error);
    });
  } finally {
    database.close();
  }
}
