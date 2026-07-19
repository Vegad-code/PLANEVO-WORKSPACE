import { requireTaskAttachmentCleanupCandidate } from "./task-attachment-integrity.ts";

export type TaskAttachmentCleanupTarget = {
  sourceId: string;
  storagePath: string;
};

export type TaskAttachmentCleanupFailureStage = "storage" | "database";

export type TaskAttachmentCleanupOperations = {
  markPending: (
    target: TaskAttachmentCleanupTarget,
    failureStage: TaskAttachmentCleanupFailureStage | null,
    failureMessage?: string,
  ) => Promise<void>;
  removeStorage: (target: TaskAttachmentCleanupTarget) => Promise<void>;
  /** Return true only after confirming that the source row is absent. */
  deleteSource: (target: TaskAttachmentCleanupTarget) => Promise<boolean>;
};

export type TaskAttachmentCleanupResult =
  | { ok: true; target: TaskAttachmentCleanupTarget }
  | {
      ok: false;
      target: TaskAttachmentCleanupTarget;
      stage: TaskAttachmentCleanupFailureStage;
      operation: "mark_pending" | "remove_storage" | "delete_source";
      error: string;
      cleanupPending: true;
    };

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : "Unknown cleanup failure.";
}

async function recordFailure(
  target: TaskAttachmentCleanupTarget,
  operations: TaskAttachmentCleanupOperations,
  stage: TaskAttachmentCleanupFailureStage,
  cause: unknown,
): Promise<void> {
  try {
    await operations.markPending(target, stage, errorMessage(cause));
  } catch {
    // Every issued source starts with cleanupRequired=true. If this diagnostic
    // update fails, preserving the row still keeps it visible for recovery.
  }
}

/**
 * Cleanup is deliberately ordered: mark recoverable state, remove Storage,
 * then delete and confirm the database row. A failed step returns an explicit
 * pending result; it never reports success while either resource is known to
 * remain.
 */
export async function cleanupTaskAttachment(
  target: TaskAttachmentCleanupTarget,
  operations: TaskAttachmentCleanupOperations,
): Promise<TaskAttachmentCleanupResult> {
  try {
    await operations.markPending(target, null);
  } catch (cause) {
    return {
      ok: false,
      target,
      stage: "database",
      operation: "mark_pending",
      error: errorMessage(cause),
      cleanupPending: true,
    };
  }

  try {
    await operations.removeStorage(target);
  } catch (cause) {
    await recordFailure(target, operations, "storage", cause);
    return {
      ok: false,
      target,
      stage: "storage",
      operation: "remove_storage",
      error: errorMessage(cause),
      cleanupPending: true,
    };
  }

  try {
    const sourceAbsent = await operations.deleteSource(target);
    if (!sourceAbsent) throw new Error("Attachment source still exists after cleanup.");
  } catch (cause) {
    await recordFailure(target, operations, "database", cause);
    return {
      ok: false,
      target,
      stage: "database",
      operation: "delete_source",
      error: errorMessage(cause),
      cleanupPending: true,
    };
  }

  return { ok: true, target };
}

/** Guard the cleanup state machine so a committed/claimed source is immutable. */
export async function cleanupTaskAttachmentReservation(
  target: TaskAttachmentCleanupTarget,
  metadata: unknown,
  operations: TaskAttachmentCleanupOperations,
): Promise<TaskAttachmentCleanupResult> {
  requireTaskAttachmentCleanupCandidate(metadata);
  return cleanupTaskAttachment(target, operations);
}
