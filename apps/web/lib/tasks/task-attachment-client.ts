import type { TaskAttachmentCleanupTarget } from "./task-attachment-cleanup.ts";

export type TaskAttachmentCleanupFetch = (
  input: string,
  init: RequestInit,
) => Promise<Response>;

type CleanupResponse = {
  removed?: number;
  error?: string;
  pending?: TaskAttachmentCleanupTarget[];
};

export class TaskAttachmentCleanupError extends Error {
  readonly pendingTargets: TaskAttachmentCleanupTarget[];

  constructor(message: string, pendingTargets: TaskAttachmentCleanupTarget[]) {
    super(message);
    this.name = "TaskAttachmentCleanupError";
    this.pendingTargets = pendingTargets;
  }
}

/**
 * Request cleanup and require an explicit server confirmation for every target.
 * Network errors, non-2xx responses, and partial acknowledgements remain
 * observable to the caller with the exact targets that still need recovery.
 */
export async function discardTaskAttachmentUploads(
  targets: TaskAttachmentCleanupTarget[],
  fetcher: TaskAttachmentCleanupFetch = fetch,
): Promise<void> {
  if (targets.length === 0) return;

  let response: Response;
  try {
    response = await fetcher("/api/task-attachments", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ uploads: targets }),
    });
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "request failed";
    throw new TaskAttachmentCleanupError(
      `Attachment cleanup request failed: ${detail}. Cleanup remains pending.`,
      targets,
    );
  }

  const payload = (await response.json().catch(() => null)) as CleanupResponse | null;
  if (!response.ok) {
    throw new TaskAttachmentCleanupError(
      payload?.error ?? "Attachment cleanup remains pending.",
      Array.isArray(payload?.pending) ? payload.pending : targets,
    );
  }
  if (payload?.removed !== targets.length) {
    throw new TaskAttachmentCleanupError(
      "The server did not confirm every attachment cleanup. Cleanup remains pending.",
      targets,
    );
  }
}
