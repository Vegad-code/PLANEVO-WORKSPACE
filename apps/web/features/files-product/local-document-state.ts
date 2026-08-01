/**
 * Pure local-document durability decisions: reconcile disk vs sidecar vs recovery, make restore
 * undoable, and pick which revision keys survive global quota pressure.
 *
 * No React, DOM, or IndexedDB — `local-file-repository.ts` owns I/O and applies these results.
 */

import {
  copyLocalDocumentContent,
  localDocumentContentSizeBytes,
  retainLocalDocumentRevisions,
  type LocalDocumentContent,
} from "./local-document-content.ts";

export const LOCAL_DOCUMENT_HISTORY_DAYS = 7;
export const MAX_LOCAL_DOCUMENT_REVISIONS = 20;

export class LocalDocumentStateConflictError extends Error {
  readonly kind = "local-document-state-conflict" as const;

  constructor(
    message = "The original file changed while Planevo still has unsaved recovery work. Resolve the conflict before reopening it.",
  ) {
    super(message);
    this.name = "LocalDocumentStateConflictError";
  }
}

export type LocalDocumentRecoveryRef = {
  baseVersion: number;
  contentHash: string;
};

export type ReconcileLocalDocumentSourceInput = {
  version: number;
  /** Last known disk content hash recorded on the sidecar fingerprint. */
  sourceHash: string;
  /** Hash of the sidecar's current content bytes. */
  sidecarHash: string;
  /** Hash of the bytes currently on disk. */
  diskHash: string;
  recovery: LocalDocumentRecoveryRef | null;
};

export type ReconcileLocalDocumentSourceResult = {
  action: "adopt-disk" | "keep-sidecar";
  version: number;
  checkpointPriorContent: boolean;
  clearRecovery: boolean;
  reason: "same-source" | "completed-partial-save" | "external-source";
};

/**
 * Decide how to reconcile an on-disk file with its Planevo sidecar and any recovery draft.
 *
 * Disk-first saves can finish the write and crash before the sidecar commits. When the recovery
 * draft matches the new disk bytes and the sidecar is still at the pre-save source, adopting the
 * disk completes that partial save instead of treating it as an external conflict.
 */
export function reconcileLocalDocumentSource(
  input: ReconcileLocalDocumentSourceInput,
): ReconcileLocalDocumentSourceResult {
  const { version, sourceHash, sidecarHash, diskHash, recovery } = input;

  if (diskHash === sourceHash) {
    return {
      action: "keep-sidecar",
      version,
      checkpointPriorContent: false,
      clearRecovery: false,
      reason: "same-source",
    };
  }

  const sidecarMatchesSource = sidecarHash === sourceHash;
  const recoveryMatchesDisk =
    recovery !== null &&
    recovery.contentHash === diskHash &&
    recovery.baseVersion === version;

  if (recoveryMatchesDisk && sidecarMatchesSource) {
    return {
      action: "adopt-disk",
      version: version + 1,
      checkpointPriorContent: true,
      clearRecovery: true,
      reason: "completed-partial-save",
    };
  }

  // Disk moved while Planevo still holds meaningful local work — never clobber either side.
  if (recovery !== null || !sidecarMatchesSource) {
    throw new LocalDocumentStateConflictError();
  }

  return {
    action: "adopt-disk",
    version: version + 1,
    checkpointPriorContent: true,
    clearRecovery: false,
    reason: "external-source",
  };
}

export type LocalDocumentRevisionSnapshot = {
  id: string;
  version: number;
  content: LocalDocumentContent;
  sizeBytes: number;
  reason: string;
  createdAt: string;
  expiresAt: string;
};

export type BuildRestoredLocalDocumentStateInput = {
  version: number;
  baseVersion: number;
  content: LocalDocumentContent;
  revisions: readonly LocalDocumentRevisionSnapshot[];
  revisionId: string;
  revisionIdFactory: () => string;
  now: Date;
};

export type RestoredLocalDocumentState = {
  version: number;
  content: LocalDocumentContent;
  revisions: LocalDocumentRevisionSnapshot[];
};

/**
 * Restore a prior revision under a compare-and-swap on `baseVersion`, checkpointing the live
 * content first so the restore itself is undoable.
 */
export function buildRestoredLocalDocumentState(
  input: BuildRestoredLocalDocumentStateInput,
): RestoredLocalDocumentState {
  if (input.baseVersion !== input.version) {
    throw new LocalDocumentStateConflictError(
      "This document changed in another Planevo tab. Reload before restoring again.",
    );
  }

  const target = input.revisions.find(
    (revision) => revision.id === input.revisionId,
  );
  if (!target) {
    throw new Error("That local revision is unavailable.");
  }

  const now = input.now;
  const expiresAt = new Date(
    now.getTime() + LOCAL_DOCUMENT_HISTORY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const undoCheckpoint: LocalDocumentRevisionSnapshot = {
    id: input.revisionIdFactory(),
    version: input.version,
    content: copyLocalDocumentContent(input.content),
    sizeBytes: localDocumentContentSizeBytes(input.content),
    reason: "restore",
    createdAt: now.toISOString(),
    expiresAt,
  };

  return {
    version: input.version + 1,
    content: copyLocalDocumentContent(target.content),
    revisions: retainLocalDocumentRevisions([
      undoCheckpoint,
      ...input.revisions.filter(
        (revision) => new Date(revision.expiresAt).getTime() > now.getTime(),
      ),
    ]).slice(0, MAX_LOCAL_DOCUMENT_REVISIONS),
  };
}

export type LocalRevisionQuotaEntry = {
  key: string;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string;
};

/**
 * Drop expired revision keys, then keep newest-first keys that still fit the global byte budget.
 * Callers map `fileSourceId:revisionId` keys back onto per-document sidecar arrays.
 */
export function selectGlobalLocalRevisionKeys({
  revisions,
  maximumBytes,
  now,
}: {
  revisions: readonly LocalRevisionQuotaEntry[];
  maximumBytes: number;
  now: Date;
}): Set<string> {
  const live = revisions.filter(
    (revision) => new Date(revision.expiresAt).getTime() > now.getTime(),
  );
  const newestFirst = [...live].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );

  const retained = new Set<string>();
  let usedBytes = 0;
  for (const revision of newestFirst) {
    if (revision.sizeBytes < 0) continue;
    if (usedBytes + revision.sizeBytes > maximumBytes) continue;
    retained.add(revision.key);
    usedBytes += revision.sizeBytes;
  }
  return retained;
}
