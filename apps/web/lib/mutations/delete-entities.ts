import type { RecentTargetType } from "@planevo/api/rpc";
import type { DataAccess } from "@planevo/core/types/data-access";

export type DeleteResult = { ok: true } | { ok: false; error: string };

export function deleteError(cause: unknown, fallback: string): DeleteResult {
  return { ok: false, error: cause instanceof Error ? cause.message : fallback };
}

export async function clearRecentItems(
  access: DataAccess,
  input: { workspaceId: string; targetType: RecentTargetType; targetId: string },
): Promise<void> {
  const { error } = await access.client
    .from("recent_items")
    .delete()
    .eq("workspace_id", input.workspaceId)
    .eq("target_type", input.targetType)
    .eq("target_id", input.targetId);
  if (error) throw error;
}

const WORKSPACE_FILES_BUCKET = "workspace-files";

export function isVirtualStoragePath(storagePath: string): boolean {
  return storagePath.startsWith("page:");
}

export async function removeStorageObject(
  access: DataAccess,
  storagePath: string,
): Promise<void> {
  if (!storagePath || isVirtualStoragePath(storagePath)) return;
  const { error } = await access.client.storage
    .from(WORKSPACE_FILES_BUCKET)
    .remove([storagePath]);
  if (error) throw error;
}

/** Removes every blob under `{workspaceId}/` in the workspace-files bucket. */
export async function removeWorkspaceStoragePrefix(
  access: DataAccess,
  workspaceId: string,
): Promise<void> {
  const prefix = `${workspaceId}/`;
  const paths: string[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await access.client.storage
      .from(WORKSPACE_FILES_BUCKET)
      .list(workspaceId, { limit, offset });
    if (error) throw error;
    if (!data?.length) break;
    for (const item of data) {
      if (item.name) paths.push(`${prefix}${item.name}`);
    }
    if (data.length < limit) break;
    offset += limit;
  }

  if (paths.length === 0) return;

  const { error: removeError } = await access.client.storage
    .from(WORKSPACE_FILES_BUCKET)
    .remove(paths);
  if (removeError) throw removeError;
}

export function virtualPageStoragePath(pageId: string): string {
  return `page:${pageId}`;
}
