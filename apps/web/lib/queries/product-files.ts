import "server-only";

import {
  loadProductFiles,
  summarizeStorageBytes,
} from "@planevo/core/queries/product-files";
import {
  loadFolderTree,
  type FolderTreeItem,
} from "@planevo/core/queries/file-folders";
import { storageCapBytesForPlan } from "@planevo/core/types/plans";
import { getDataAccess, type DataAccess } from "@/lib/data/access";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { PRODUCT_FILES_BUCKET } from "@/lib/files/product-files";
import { resolveUserPlan } from "@/lib/files/user-plan";
import type { FilesScope } from "@/lib/files/scope-prefs";
import type { ProductFileItem } from "@/features/files-product/files-table";
import type { OwnerDisplay } from "@/features/files-product/kb-contracts";

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
      folders: FolderTreeItem[];
      workspaceId: string | null;
      firstName: string | null;
      owner: OwnerDisplay;
      usedBytes: number;
      capBytes: number;
    };

type AuthUser = {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
} | null;

const FALLBACK_OWNER: OwnerDisplay = {
  email: "you@planevo.app",
  name: null,
  avatarUrl: null,
};

/** Single auth.getUser() round trip shared by firstName + owner display below.
 * Dev/alias mode has no auth session — never throw, just fall back. */
async function loadAuthUser(access: DataAccess): Promise<AuthUser> {
  if (access.mode !== "auth") return null;
  try {
    const {
      data: { user },
    } = await access.client.auth.getUser();
    return user ?? null;
  } catch {
    return null;
  }
}

function firstNameFromUser(user: AuthUser): string | null {
  const fullName = user?.user_metadata?.full_name;
  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim().split(/\s+/)[0] ?? null;
  }
  const emailName = user?.email?.split("@")[0]?.trim();
  return emailName || null;
}

function ownerDisplayFromUser(user: AuthUser): OwnerDisplay {
  if (!user) return FALLBACK_OWNER;
  return {
    email: user.email ?? FALLBACK_OWNER.email,
    name:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null,
    avatarUrl: (user.user_metadata?.avatar_url as string | undefined) ?? null,
  };
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
  const plan = await resolveUserPlan(access);
  const [files, authUser, usedBytes, folders] = await Promise.all([
    loadProductFiles(
      access.client,
      access.ownerId,
      scope === "workspace" && workspaceId ? { workspaceId } : {},
    ),
    loadAuthUser(access),
    loadUsedBytes(access),
    loadFolderTree(access.client, access.ownerId),
  ]);
  const firstName = firstNameFromUser(authUser);
  const owner = ownerDisplayFromUser(authUser);

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
    folders,
    workspaceId,
    firstName,
    owner,
    usedBytes,
    capBytes: storageCapBytesForPlan(plan),
  };
}
