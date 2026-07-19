export const TASK_ATTACHMENT_BUCKET = "workspace-files";
export const MAX_TASK_ATTACHMENTS = 5;
export const MAX_TASK_ATTACHMENT_BYTES = 25 * 1024 * 1024;

export type UploadedTaskAttachment = {
  sourceId: string;
  storagePath: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  claimOperationKey: string;
};

export type TaskAttachmentSourceMetadata = {
  source_kind: "task-attachment";
  bucket: typeof TASK_ATTACHMENT_BUCKET;
  path: string;
  cleanup_required: boolean;
  task_attachment_state: "unclaimed" | "cleanup_pending" | "claimed";
  failure_stage: "storage" | "database" | null;
  failure_message?: string;
  claimed_task_id?: string;
};

export function taskAttachmentSourceMetadata(
  storagePath: string,
): TaskAttachmentSourceMetadata {
  return {
    source_kind: "task-attachment",
    bucket: TASK_ATTACHMENT_BUCKET,
    path: storagePath,
    cleanup_required: true,
    task_attachment_state: "unclaimed",
    failure_stage: null,
  };
}

export function isVisibleFileSourceMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return true;
  }
  const value = metadata as Record<string, unknown>;
  const isRecoverableReservation =
    value.source_kind === "task-attachment" &&
    value.task_attachment_state !== "claimed";
  return !isRecoverableReservation;
}

/**
 * Return the storage object name only when the path belongs directly to the
 * selected workspace folder. Task uploads never accept nested or cross-
 * workspace paths supplied by the client.
 */
export function taskAttachmentObjectName(
  storagePath: string,
  workspaceId: string,
): string | null {
  const prefix = `${workspaceId}/`;
  if (!storagePath.startsWith(prefix)) return null;

  const objectName = storagePath.slice(prefix.length);
  return objectName && !objectName.includes("/") ? objectName : null;
}
