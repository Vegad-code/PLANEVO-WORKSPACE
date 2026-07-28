import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../types/database.types";
import type { FileSourceRow } from "../types/files";

function nowIso(): string {
  return new Date().toISOString();
}

export type CreateFileSourceRecordInput = {
  /** Storage still lives under workspace paths (design spec V1). */
  workspaceId: string;
  storagePath: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number | null;
  operationKey?: string;
  folder?: string;
};

/** Insert the metadata row for an uploaded product file (owned by userId). */
export async function createFileSourceRecord(
  client: SupabaseClient<Database>,
  userId: string,
  input: CreateFileSourceRecordInput,
): Promise<FileSourceRow> {
  const metadata: Record<string, unknown> = { source_kind: "product-upload" };
  if (input.folder) metadata.folder = input.folder;
  const { data, error } = await client
    .from("file_sources")
    .insert({
      workspace_id: input.workspaceId,
      created_by: userId,
      user_id: userId,
      storage_path: input.storagePath,
      storage_kind: "cloud",
      name: input.name,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      ingestion_status: "pending",
      operation_key: input.operationKey ?? null,
      metadata_json: metadata as Json,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Replace the tag list inside metadata_json, preserving other keys. */
export async function updateFileTags(
  client: SupabaseClient<Database>,
  userId: string,
  fileSourceId: string,
  tags: string[],
): Promise<void> {
  const { data, error } = await client
    .from("file_sources")
    .select("metadata_json")
    .eq("id", fileSourceId)
    .eq("user_id", userId)
    .single();
  if (error) throw error;
  const metadata =
    data.metadata_json && typeof data.metadata_json === "object" && !Array.isArray(data.metadata_json)
      ? (data.metadata_json as Record<string, unknown>)
      : {};
  const { error: updateError } = await client
    .from("file_sources")
    .update({
      metadata_json: { ...metadata, tags } as Json,
      updated_at: nowIso(),
    })
    .eq("id", fileSourceId)
    .eq("user_id", userId);
  if (updateError) throw updateError;
}

/**
 * Delete the metadata row and return its storage_path so the caller can
 * remove the storage object (web layer owns the storage client call).
 */
export async function deleteFileSource(
  client: SupabaseClient<Database>,
  userId: string,
  fileSourceId: string,
): Promise<{ storagePath: string }> {
  const { data, error } = await client
    .from("file_sources")
    .delete()
    .eq("id", fileSourceId)
    .eq("user_id", userId)
    .select("storage_path")
    .single();
  if (error) throw error;
  return { storagePath: data.storage_path };
}
