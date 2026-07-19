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
} | null> {
  const { data, error } = await access.client
    .from("file_sources")
    .select("metadata_json,storage_path")
    .eq("id", sourceId)
    .eq("user_id", access.ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    metadata: jsonObject(data.metadata_json),
    storagePath: data.storage_path,
  };
}

function cleanupOperations(access: DataAccess): TaskAttachmentCleanupOperations {
  return {
    async markPending(target, failureStage, failureMessage) {
      const { data, error } = await access.client.rpc(
        "begin_task_attachment_cleanup",
        {
          p_owner_id: access.ownerId,
          p_file_source_id: target.sourceId,
          p_storage_path: target.storagePath,
          p_failure_stage: failureStage,
          p_failure_message: failureMessage ?? null,
        },
      );
      if (error) throw error;
      if (!data) throw new Error("Attachment cleanup marker was not persisted.");
    },
    async removeStorage(target) {
      const { error } = await access.client.storage
        .from(TASK_ATTACHMENT_BUCKET)
        .remove([target.storagePath]);
      if (error) throw error;
      if (await storageObjectExists(access, target.storagePath)) {
        throw new Error("Attachment object still exists after cleanup.");
      }
    },
    async deleteSource(target) {
      const { data, error } = await access.client.rpc(
        "finalize_task_attachment_cleanup",
        {
          p_owner_id: access.ownerId,
          p_file_source_id: target.sourceId,
          p_storage_path: target.storagePath,
        },
      );
      if (error) throw error;
      return data;
    },
  };
}

async function storageObjectExists(
  access: DataAccess,
  storagePath: string,
): Promise<boolean> {
  const separator = storagePath.lastIndexOf("/");
  if (separator < 1) throw new Error("Attachment cleanup path is invalid.");
  const folder = storagePath.slice(0, separator);
  const name = storagePath.slice(separator + 1);
  const { data, error } = await access.client.storage
    .from(TASK_ATTACHMENT_BUCKET)
    .list(folder, { limit: 2, search: name });
  if (error) throw error;
  return (data ?? []).some((entry) => entry.name === name);
}

export async function cleanupOwnedTaskAttachment(
  access: DataAccess,
  target: TaskAttachmentCleanupTarget,
): Promise<TaskAttachmentCleanupResult> {
  const source = await sourceRecord(access, target.sourceId);
  if (!source) {
    return (await storageObjectExists(access, target.storagePath))
      ? {
          ok: false,
          target,
          stage: "database",
          operation: "mark_pending",
          error: "Attachment source is absent while its object remains.",
          cleanupPending: true,
        }
      : { ok: true, target };
  }
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
