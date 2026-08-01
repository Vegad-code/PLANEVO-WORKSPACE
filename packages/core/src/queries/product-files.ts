import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import type { FileSourceRow } from "../types/files";
import { fileFolder, fileTags, isVisibleFileMetadata } from "../types/files.ts";
import { listWorkspaceResourceIds } from "./workspace-links.ts";

export type FileSourceWithMeta = FileSourceRow & {
  folder: string | null;
  tags: string[];
};

export type LoadProductFilesOptions = {
  /** F-02 "This workspace" filter — only files linked into this workspace. */
  workspaceId?: string;
};

/**
 * A user's file library ordered newest first. Unclaimed upload reservations
 * are filtered out; folder and tags are lifted from metadata_json for the
 * cabinet UI.
 */
export async function loadProductFiles(
  client: SupabaseClient<Database>,
  userId: string,
  options: LoadProductFilesOptions = {},
): Promise<FileSourceWithMeta[]> {
  let query = client.from("file_sources").select("*").eq("user_id", userId);
  if (options.workspaceId) {
    const linkedIds = await listWorkspaceResourceIds(client, {
      workspaceId: options.workspaceId,
      resourceType: "file",
    });
    if (linkedIds.length > 0) {
      const idList = linkedIds.join(",");
      query = query.or(
        `workspace_id.eq.${options.workspaceId},id.in.(${idList})`,
      );
    } else {
      query = query.eq("workspace_id", options.workspaceId);
    }
  }
  const { data, error } = await query
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    // ponytail: newest 200 files; add paging when a library outgrows this.
    .limit(200);
  if (error) throw error;

  return ((data ?? []) as FileSourceRow[])
    .filter((row) => isVisibleFileMetadata(row.metadata_json))
    .map((row) => ({
      ...row,
      folder: fileFolder(row.metadata_json),
      tags: fileTags(row.metadata_json),
    }));
}

/** Total bytes used, for the storage meter. Null sizes count as zero. */
export function summarizeStorageBytes(
  files: Pick<FileSourceRow, "size_bytes">[],
): number {
  return files.reduce((total, file) => total + (file.size_bytes ?? 0), 0);
}
