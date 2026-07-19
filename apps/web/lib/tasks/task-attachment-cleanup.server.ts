import type { Json } from "@planevo/core/types/database.types";
import type { DataAccess } from "@/lib/data/access";
import {
  cleanupTaskAttachmentReservation,
  type TaskAttachmentCleanupOperations,
  type TaskAttachmentCleanupResult,
  type TaskAttachmentCleanupTarget,
} from "./task-attachment-cleanup";
import { TASK_ATTACHMENT_BUCKET } from "./task-attachments";

function jsonObject(value: Json): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...value }
    : {};
}

async function sourceRecord(
  access: DataAccess,
  sourceId: string,
): Promise<{
  metadata: Record<string, Json | undefined>;
  storagePath: string;
}> {
  const { data, error } = await access.client
    .from("file_sources")
    .select("metadata_json,storage_path")
    .eq("id", sourceId)
    .eq("user_id", access.ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Attachment source is unavailable for cleanup.");
  return {
    metadata: jsonObject(data.metadata_json),
    storagePath: data.storage_path,
  };
}

function cleanupOperations(access: DataAccess): TaskAttachmentCleanupOperations {
  return {
    async markPending(target, failureStage, failureMessage) {
      const { metadata } = await sourceRecord(access, target.sourceId);
      const nextMetadata = {
        ...metadata,
        source_kind: "task-attachment",
        bucket: TASK_ATTACHMENT_BUCKET,
        path: target.storagePath,
        cleanup_required: true,
        task_attachment_state: "cleanup_pending",
        failure_stage: failureStage,
        failure_message: failureMessage ?? null,
      } as Json;
      const { data, error } = await access.client
        .from("file_sources")
        .update({
          ingestion_status: "failed",
          metadata_json: nextMetadata,
        })
        .eq("id", target.sourceId)
        .eq("user_id", access.ownerId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Attachment cleanup marker was not persisted.");
    },
    async removeStorage(target) {
      const { error } = await access.client.storage
        .from(TASK_ATTACHMENT_BUCKET)
        .remove([target.storagePath]);
      if (error) throw error;
    },
    async deleteSource(target) {
      const { data, error } = await access.client
        .from("file_sources")
        .delete()
        .eq("id", target.sourceId)
        .eq("user_id", access.ownerId)
        .select("id");
      if (error) throw error;
      if ((data ?? []).some((row) => row.id === target.sourceId)) return true;

      const { data: remaining, error: confirmError } = await access.client
        .from("file_sources")
        .select("id")
        .eq("id", target.sourceId)
        .eq("user_id", access.ownerId)
        .maybeSingle();
      if (confirmError) throw confirmError;
      return remaining === null;
    },
  };
}

export async function cleanupOwnedTaskAttachment(
  access: DataAccess,
  target: TaskAttachmentCleanupTarget,
): Promise<TaskAttachmentCleanupResult> {
  const source = await sourceRecord(access, target.sourceId);
  if (source.storagePath !== target.storagePath) {
    throw new Error("Attachment cleanup path does not match its reservation.");
  }

  const { data: links, error: linksError } = await access.client
    .from("file_links")
    .select("id")
    .eq("file_source_id", target.sourceId)
    .limit(1);
  if (linksError) throw linksError;
  if ((links ?? []).length > 0) {
    throw new Error("A claimed attachment cannot be cleaned up.");
  }

  return cleanupTaskAttachmentReservation(
    target,
    source.metadata,
    cleanupOperations(access),
  );
}
