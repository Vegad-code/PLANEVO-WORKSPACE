"use client";

import { createClient } from "@/utils/supabase/client";
import {
  discardTaskAttachmentUploads,
  TaskAttachmentCleanupError,
} from "@/lib/tasks/task-attachment-client";
import type { TaskAttachmentCleanupTarget } from "@/lib/tasks/task-attachment-cleanup";
import { requireTaskAttachmentSize } from "@/lib/tasks/task-attachment-integrity";
import {
  MAX_TASK_ATTACHMENTS,
  TASK_ATTACHMENT_BUCKET,
  type UploadedTaskAttachment,
} from "@/lib/tasks/task-attachments";

type UploadTargetResponse = {
  sourceId?: string;
  path?: string;
  token?: string;
  error?: string;
};

async function requestUploadTarget(file: File): Promise<{
  sourceId: string;
  path: string;
  token: string;
}> {
  requireTaskAttachmentSize(file.size);
  const response = await fetch("/api/task-attachments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    }),
  });
  const payload = (await response.json().catch(() => null)) as
    | UploadTargetResponse
    | null;
  if (
    !response.ok ||
    !payload?.sourceId ||
    !payload.path ||
    !payload.token
  ) {
    throw new Error(payload?.error ?? `Could not upload ${file.name}.`);
  }
  return {
    sourceId: payload.sourceId,
    path: payload.path,
    token: payload.token,
  };
}

export { discardTaskAttachmentUploads };

export async function uploadTaskAttachments(
  files: File[],
): Promise<UploadedTaskAttachment[]> {
  if (files.length === 0) return [];
  if (files.length > MAX_TASK_ATTACHMENTS) {
    throw new Error(`Attach up to ${MAX_TASK_ATTACHMENTS} files per task.`);
  }

  const client = createClient();
  const issuedTargets: TaskAttachmentCleanupTarget[] = [];
  const uploaded: UploadedTaskAttachment[] = [];

  try {
    for (const file of files) {
      requireTaskAttachmentSize(file.size);
      const target = await requestUploadTarget(file);
      issuedTargets.push({
        sourceId: target.sourceId,
        storagePath: target.path,
      });

      const { error } = await client.storage
        .from(TASK_ATTACHMENT_BUCKET)
        .uploadToSignedUrl(target.path, target.token, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (error) throw error;

      uploaded.push({
        sourceId: target.sourceId,
        storagePath: target.path,
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
    }
    return uploaded;
  } catch (cause) {
    try {
      await discardTaskAttachmentUploads(issuedTargets);
    } catch (cleanupCause) {
      if (cleanupCause instanceof TaskAttachmentCleanupError) {
        const uploadMessage =
          cause instanceof Error ? cause.message : "Attachment upload failed.";
        throw new TaskAttachmentCleanupError(
          `${uploadMessage} ${cleanupCause.message}`,
          cleanupCause.pendingTargets,
        );
      }
      throw cleanupCause;
    }
    throw cause;
  }
}
