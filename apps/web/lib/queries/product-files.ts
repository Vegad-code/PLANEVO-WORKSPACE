import "server-only";

import {
  loadProductFiles,
  summarizeStorageBytes,
} from "@planevo/core/queries/product-files";
import { STORAGE_CAP_BYTES } from "@planevo/core/types/files";
import { getDataAccess, type DataAccess } from "@/lib/data/access";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { PRODUCT_FILES_BUCKET } from "@/lib/files/product-files";
import type { FilesScope } from "@/lib/files/scope-prefs";
import type { ProductFileItem } from "@/features/files-product/files-table";

const SIGNED_URL_TTL_SECONDS = 900;

export type FilesPageData =
  | {
      status: "unauthenticated";
      scope: FilesScope;
    }
  | {
      status: "ready";
      scope: FilesScope;
      files: ProductFileItem[];
      workspaceId: string | null;
      firstName: string | null;
      usedBytes: number;
      capBytes: number;
    };

async function loadFirstName(access: DataAccess): Promise<string | null> {
  if (access.mode !== "auth") return null;
  const {
    data: { user },
  } = await access.client.auth.getUser();
  const fullName = user?.user_metadata?.full_name;
  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim().split(/\s+/)[0] ?? null;
  }
  const emailName = user?.email?.split("@")[0]?.trim();
  return emailName || null;
}

/** Total bytes across ALL the user's files — the table list is capped, the
 * storage meter must not be. */
async function loadUsedBytes(access: DataAccess): Promise<number> {
  const { data, error } = await access.client
    .from("file_sources")
    .select("size_bytes")
    .eq("user_id", access.ownerId);
  if (error) throw error;
  return summarizeStorageBytes(data ?? []);
}

/** Server loader for the Files product cabinet. */
export async function loadFilesPageData(
  scope: FilesScope = "all",
): Promise<FilesPageData> {
  const currentWorkspace = await getCurrentWorkspace();
  const access = currentWorkspace?.access ?? (await getDataAccess());

  if (!access) {
    return { status: "unauthenticated", scope };
  }

  const workspaceId = currentWorkspace?.workspace.id ?? null;
  const [files, firstName, usedBytes] = await Promise.all([
    loadProductFiles(
      access.client,
      access.ownerId,
      scope === "workspace" && workspaceId ? { workspaceId } : {},
    ),
    loadFirstName(access),
    loadUsedBytes(access),
  ]);

  // Page-backed rows use virtual "page:" paths — no storage object to sign.
  const storageBacked = files.filter((file) => !file.storage_path.startsWith("page:"));
  const signedUrls = new Map<string, string>();
  if (storageBacked.length > 0) {
    const { data: signed, error } = await access.client.storage
      .from(PRODUCT_FILES_BUCKET)
      .createSignedUrls(
        storageBacked.map((file) => file.storage_path),
        SIGNED_URL_TTL_SECONDS,
      );
    if (!error) {
      signed?.forEach((result, index) => {
        if (result.signedUrl) {
          signedUrls.set(storageBacked[index]!.storage_path, result.signedUrl);
        }
      });
    }
  }

  return {
    status: "ready",
    scope,
    files: files.map((file) => ({
      ...file,
      previewUrl: signedUrls.get(file.storage_path) ?? null,
    })),
    workspaceId,
    firstName,
    usedBytes,
    capBytes: STORAGE_CAP_BYTES,
  };
}
