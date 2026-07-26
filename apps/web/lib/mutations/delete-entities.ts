import type { RecentTargetType } from "@planevo/api/rpc";
import type { DataAccess } from "@planevo/core/types/data-access";

export type DeleteResult = { ok: true } | { ok: false; error: string };

export function deleteError(cause: unknown, fallback: string): DeleteResult {
  return {
    ok: false,
    error: cause instanceof Error ? cause.message : fallback,
  };
}

export async function clearRecentItems(
  access: DataAccess,
  input: {
    workspaceId: string;
    targetType: RecentTargetType;
    targetId: string;
  },
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

// Buckets whose objects are stored with a `bucket:path` prefix in file_sources.
// Bare paths (product files, task attachments) live in workspace-files.
const PREFIXED_BUCKETS = new Set(["page-assets"]);

export function isVirtualStoragePath(storagePath: string): boolean {
  return storagePath.startsWith("page:");
}

/** Resolve which bucket + object key a stored file_sources.storage_path points at. */
export function parseStorageLocation(
  storagePath: string,
): { bucket: string; path: string } | null {
  if (!storagePath || isVirtualStoragePath(storagePath)) return null;
  const colon = storagePath.indexOf(":");
  if (colon > 0) {
    const prefix = storagePath.slice(0, colon);
    if (PREFIXED_BUCKETS.has(prefix)) {
      return { bucket: prefix, path: storagePath.slice(colon + 1) };
    }
  }
  return { bucket: WORKSPACE_FILES_BUCKET, path: storagePath };
}

export async function removeStorageObject(
  access: DataAccess,
  storagePath: string,
): Promise<void> {
  await removeStorageObjects(access, [storagePath]);
}

export async function removeStorageObjects(
  access: DataAccess,
  storagePaths: string[],
): Promise<void> {
  const pathsByBucket = new Map<string, Set<string>>();
  for (const storagePath of storagePaths) {
    const location = parseStorageLocation(storagePath);
    if (!location) continue;
    const paths = pathsByBucket.get(location.bucket) ?? new Set<string>();
    paths.add(location.path);
    pathsByBucket.set(location.bucket, paths);
  }

  for (const [bucket, pathSet] of pathsByBucket) {
    const paths = [...pathSet];
    for (let start = 0; start < paths.length; start += 100) {
      const { error } = await access.client.storage
        .from(bucket)
        .remove(paths.slice(start, start + 100));
      if (error) throw error;
    }
  }
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
