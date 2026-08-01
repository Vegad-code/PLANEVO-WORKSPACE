export class DocxAutosaveConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocxAutosaveConflictError";
  }
}

export type DocxAutosaveStatus =
  | "saved"
  | "dirty"
  | "saving"
  | "conflict"
  | "error";

export type DocxAutosaveSnapshot = {
  status: DocxAutosaveStatus;
  error: string | null;
  version: number;
};

export type DocxRecoveryDraft = {
  fileSourceId: string;
  content: Uint8Array;
  baseVersion: number;
};

export type CreateDocxAutosaveCoordinatorArgs = {
  fileSourceId: string;
  initialVersion: number;
  serialize: () => Promise<Uint8Array>;
  save: (
    content: Uint8Array,
    baseVersion: number,
    reason: string,
  ) => Promise<{ version: number }>;
  writeRecovery: (draft: DocxRecoveryDraft) => Promise<void>;
  clearRecovery: () => Promise<void>;
};

export type DocxAutosaveCoordinator = {
  markChanged: () => void;
  flush: (reason: string) => Promise<void>;
  captureRecovery: () => Promise<void>;
  whenIdle: () => Promise<void>;
  getSnapshot: () => DocxAutosaveSnapshot;
};

function copyBytes(content: Uint8Array): Uint8Array {
  return new Uint8Array(content);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to save the DOCX.";
}

/**
 * Coordinates browser-independent DOCX serialization with durable recovery. Each source
 * write is preceded by a completed recovery write so a tab crash or failed replacement
 * leaves a draft to restore; callers supply the actual browser or local-file persistence.
 */
export function createDocxAutosaveCoordinator({
  fileSourceId,
  initialVersion,
  serialize,
  save,
  writeRecovery,
  clearRecovery,
}: CreateDocxAutosaveCoordinatorArgs): DocxAutosaveCoordinator {
  let version = initialVersion;
  let status: DocxAutosaveStatus = "saved";
  let error: string | null = null;
  let changedGeneration = 0;
  let savedGeneration = 0;
  let currentFlush: Promise<void> | null = null;
  let workTail: Promise<void> = Promise.resolve();

  const getSnapshot = (): DocxAutosaveSnapshot => ({ status, error, version });

  const setError = (nextError: unknown): void => {
    error = errorMessage(nextError);
    status = "error";
  };

  const enqueue = (operation: () => Promise<void>): Promise<void> => {
    // Chain through prior failures so the serial queue never stalls, but return
    // `scheduled` so callers (especially flush/close) can observe rejection.
    const scheduled = workTail.then(operation, operation);
    workTail = scheduled.catch((nextError: unknown) => {
      // Keep the queue alive. Operations that own failure signaling (flushChanges)
      // already recorded status; only fall back when nothing did.
      if (status !== "conflict" && status !== "error") {
        setError(nextError);
      }
    });
    return scheduled;
  };

  const writeDurableRecovery = async (): Promise<void> => {
    const content = copyBytes(await serialize());
    await writeRecovery({
      fileSourceId,
      content: copyBytes(content),
      baseVersion: version,
    });
  };

  const flushChanges = async (reason: string): Promise<void> => {
    while (savedGeneration < changedGeneration && status !== "conflict") {
      try {
        status = "saving";
        error = null;
        // Capture generation after serialize so bytes match the recorded edit
        // wave — typing during a multi-MB serialize must not stamp N+1 bytes as N.
        const content = copyBytes(await serialize());
        const generation = changedGeneration;

        // Recovery must finish before the original is replaced, and neither adapter receives
        // the serializer-owned array or the other adapter's array.
        await writeRecovery({
          fileSourceId,
          content: copyBytes(content),
          baseVersion: version,
        });
        const result = await save(copyBytes(content), version, reason);
        version = result.version;
        savedGeneration = generation;
        // An edit can land while the source write is in flight. Its recovery
        // draft must remain durable until that newer generation is saved too.
        if (generation === changedGeneration) {
          await clearRecovery();
        }
      } catch (nextError) {
        error = errorMessage(nextError);
        status =
          nextError instanceof DocxAutosaveConflictError ? "conflict" : "error";
        // Rethrow so flush's returned promise rejects — close/openFile can
        // soft-block instead of silently discarding unsaved work.
        throw nextError;
      }
    }

    // markChanged may flip status to dirty while serialize/save is in flight.
    // Reconcile from generation counters so a mid-serialize edit that was
    // absorbed into this flush still reports saved when nothing remains.
    if (status !== "conflict" && status !== "error") {
      status =
        savedGeneration === changedGeneration ? "saved" : "dirty";
    }
  };

  const markChanged = (): void => {
    changedGeneration += 1;
    if (status !== "conflict") {
      status = "dirty";
      error = null;
    }
  };

  const flush = (reason: string): Promise<void> => {
    if (status === "conflict") {
      // Soft-block close: never pretend a conflicted session saved cleanly.
      return (
        currentFlush ??
        Promise.reject(
          new DocxAutosaveConflictError(
            error ?? "This document changed elsewhere. Your edits are still here.",
          ),
        )
      );
    }

    if (currentFlush) {
      return currentFlush;
    }

    const inFlight = enqueue(async () => {
      await flushChanges(reason);
    });
    currentFlush = inFlight;
    // Clear the in-flight handle on settle without creating a second rejecting
    // branch (void finally would surface as unhandledRejection).
    void inFlight.then(
      () => {
        if (currentFlush === inFlight) currentFlush = null;
      },
      () => {
        if (currentFlush === inFlight) currentFlush = null;
      },
    );
    return inFlight;
  };

  const captureRecovery = (): Promise<void> =>
    enqueue(async () => {
      try {
        await writeDurableRecovery();
        if (status !== "conflict") {
          status = "dirty";
          error = null;
        }
      } catch (nextError) {
        if (status !== "conflict") {
          setError(nextError);
        }
      }
    });

  const whenIdle = async (): Promise<void> => {
    let observedTail = workTail;
    while (true) {
      await observedTail;
      if (observedTail === workTail) return;
      observedTail = workTail;
    }
  };

  return { markChanged, flush, captureRecovery, whenIdle, getSnapshot };
}
