"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createDatabase } from "@planevo/core/mutations/create-database";
import {
  deleteFileSource,
  updateFileTags,
} from "@planevo/core/mutations/product-files";
// core moveFolder exists for folder reparent-by-drag but is intentionally not wired in v1.
import {
  createFolder,
  deleteFolder,
  renameFolder,
  setFileFolder,
} from "@planevo/core/mutations/file-folders";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { requireDataAccess, requireMutationDataAccess } from "@/lib/data/access";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit.server";
import { createDocumentPage } from "@/lib/mutations/create-foundations";
import { linkResourceToWorkspace } from "@planevo/core/mutations/workspace-links";
import {
  clearRecentItems,
  deleteError,
  isVirtualStoragePath,
  removeStorageObject,
  type DeleteResult,
} from "@/lib/mutations/delete-entities";

export type FilesActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; correlationId?: string };

function filesActionError(
  cause: unknown,
  fallback: string,
): FilesActionResult<never> {
  const correlationId = randomUUID();
  console.error(`[files:${correlationId}]`, cause);
  return {
    ok: false,
    code: "FILES_ACTION_FAILED",
    error: fallback,
    correlationId,
  };
}

const updateTagsSchema = z.object({
  fileSourceId: z.string().uuid(),
  tags: z.array(z.string().trim().min(1).max(50)).max(8),
});

const documentTitleSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
});

const createFolderSchema = z.object({
  name: z.string().trim().min(1).max(80),
  parentId: z.string().uuid().nullish(),
});

const FOLDER_CAP = 500;

export async function createFolderAction(input: {
  name: string;
  parentId?: string | null;
}): Promise<FilesActionResult<{ id: string }>> {
  try {
    const access = await requireMutationDataAccess();
    await enforceRateLimit(access, "files:folder-create", RATE_LIMITS.mutate);
    const parsed = createFolderSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Enter a folder name up to 80 characters." };
    }

    const { count, error: countError } = await access.client
      .from("file_folders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", access.ownerId);
    if (countError) throw countError;
    if ((count ?? 0) >= FOLDER_CAP) {
      return {
        ok: false,
        error: "Folder limit reached (500). Delete some folders first.",
      };
    }

    const folder = await createFolder(access.client, access.ownerId, {
      name: parsed.data.name,
      parentId: parsed.data.parentId ?? null,
    });
    revalidatePath("/files");
    revalidatePath("/", "layout");
    return { ok: true, data: folder };
  } catch (cause) {
    return filesActionError(cause, "Could not create the folder.");
  }
}

const renameFolderSchema = z.object({
  folderId: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
});

export async function renameFolderAction(input: {
  folderId: string;
  name: string;
}): Promise<FilesActionResult> {
  try {
    const access = await requireMutationDataAccess();
    await enforceRateLimit(access, "files:folder-rename", RATE_LIMITS.mutate);
    const parsed = renameFolderSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Enter a folder name up to 80 characters." };
    }
    await renameFolder(access.client, access.ownerId, parsed.data.folderId, parsed.data.name);
    revalidatePath("/files");
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (cause) {
    return filesActionError(cause, "Could not rename the folder.");
  }
}

const deleteFolderSchema = z.object({
  folderId: z.string().uuid(),
});

export async function deleteFolderAction(input: {
  folderId: string;
}): Promise<FilesActionResult> {
  try {
    const access = await requireMutationDataAccess();
    await enforceRateLimit(access, "files:folder-delete", RATE_LIMITS.mutate);
    const parsed = deleteFolderSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Choose a valid folder." };
    }
    await deleteFolder(access.client, access.ownerId, parsed.data.folderId);
    revalidatePath("/files");
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (cause) {
    return filesActionError(cause, "Could not delete the folder.");
  }
}

const moveFileToFolderSchema = z.object({
  fileIds: z.array(z.string().uuid()).min(1).max(50),
  folderId: z.string().uuid().nullable(),
});

export async function moveFileToFolderAction(input: {
  fileIds: string[];
  folderId: string | null;
}): Promise<FilesActionResult> {
  try {
    const access = await requireMutationDataAccess();
    await enforceRateLimit(access, "files:file-move", RATE_LIMITS.mutate);
    const parsed = moveFileToFolderSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Choose valid files and a folder." };
    }
    await setFileFolder(access.client, access.ownerId, parsed.data.fileIds, parsed.data.folderId);
    revalidatePath("/files");
    return { ok: true, data: undefined };
  } catch (cause) {
    return filesActionError(cause, "Could not move the files.");
  }
}

const renameFileSchema = z.object({
  fileSourceId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
});

export async function renameFileAction(input: {
  fileSourceId: string;
  name: string;
}): Promise<FilesActionResult> {
  try {
    const access = await requireMutationDataAccess();
    await enforceRateLimit(access, "files:file-rename", RATE_LIMITS.mutate);
    const parsed = renameFileSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Enter a file name up to 200 characters." };
    }
    const { error } = await access.client
      .from("file_sources")
      .update({ name: parsed.data.name })
      .eq("id", parsed.data.fileSourceId)
      .eq("user_id", access.ownerId);
    if (error) throw error;
    revalidatePath("/files");
    return { ok: true, data: undefined };
  } catch (cause) {
    return filesActionError(cause, "Could not rename the file.");
  }
}

export async function createProductDocumentAction(input?: {
  title?: string;
}): Promise<FilesActionResult<{ fileSourceId: string }>> {
  try {
    const access = await requireMutationDataAccess();
    await enforceRateLimit(access, "files:doc-create", RATE_LIMITS.mutate);
    const current = await getCurrentWorkspace();
    if (!current || current.access.ownerId !== access.ownerId) {
      return { ok: false, error: "Open a workspace before creating a document." };
    }

    const parsed = documentTitleSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return { ok: false, error: "Enter a document title up to 200 characters." };
    }

    const title = parsed.data.title?.trim() || "Untitled";
    const document = await createDocumentPage({
      workspaceId: current.workspace.id,
      title,
    });
    const { data: fileRow, error } = await access.client
      .from("file_sources")
      .insert({
        workspace_id: current.workspace.id,
        page_id: document.pageId,
        created_by: access.ownerId,
        user_id: access.ownerId,
        storage_path: `page:${document.pageId}`,
        name: title,
        mime_type: "application/x-planevo-page",
        ingestion_status: "ready",
        metadata_json: { source_kind: "product-document" },
      })
      .select("id")
      .single();
    if (error) throw error;

    await linkResourceToWorkspace(access.client, access.ownerId, {
      workspaceId: current.workspace.id,
      resourceType: "file",
      resourceId: fileRow.id,
    });

    revalidatePath("/files");
    revalidatePath("/", "layout");
    return { ok: true, data: { fileSourceId: fileRow.id } };
  } catch (cause) {
    return filesActionError(cause, "Could not create the document.");
  }
}

export async function updateProductFileTagsAction(input: {
  fileSourceId: string;
  tags: string[];
}): Promise<FilesActionResult> {
  try {
    const access = await requireMutationDataAccess();
    await enforceRateLimit(access, "files:tags", RATE_LIMITS.mutate);
    const parsed = updateTagsSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Tags must be short labels (up to 8)." };
    }
    await updateFileTags(
      access.client,
      access.ownerId,
      parsed.data.fileSourceId,
      parsed.data.tags,
    );
    revalidatePath("/files");
    return { ok: true, data: undefined };
  } catch (cause) {
    return filesActionError(cause, "Could not update the tags.");
  }
}

export type FileLinkTargets = {
  tasks: { id: string; title: string }[];
  events: { id: string; title: string; startsAt: string }[];
};

const fileIdSchema = z.object({ fileSourceId: z.string().uuid() });

/** Open tasks and recent/upcoming events a file row can link to. */
export async function loadFileLinkTargetsAction(input: {
  fileSourceId: string;
}): Promise<FilesActionResult<FileLinkTargets>> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = fileIdSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Choose a valid file." };

    const [tasks, events] = await Promise.all([
      access.client
        .from("tasks")
        .select("id,title,status")
        .eq("user_id", access.ownerId)
        .order("position", { ascending: true })
        .limit(100),
      access.client
        .from("calendar_events")
        .select("id,title,starts_at")
        .eq("user_id", access.ownerId)
        .order("starts_at", { ascending: false })
        .limit(50),
    ]);
    if (tasks.error) throw tasks.error;
    if (events.error) throw events.error;

    return {
      ok: true,
      data: {
        tasks: (tasks.data ?? [])
          .filter((task) => task.status !== "done" && task.status !== "cancelled")
          .map((task) => ({ id: task.id, title: task.title })),
        events: (events.data ?? []).map((event) => ({
          id: event.id,
          title: event.title,
          startsAt: event.starts_at,
        })),
      },
    };
  } catch (cause) {
    return filesActionError(cause, "Could not load link targets.");
  }
}

const deleteProductFileSchema = z.object({
  fileSourceId: z.string().uuid(),
});

export async function deleteProductFileAction(input: {
  fileSourceId: string;
}): Promise<FilesActionResult> {
  try {
    const access = await requireMutationDataAccess();
    await enforceRateLimit(access, "files:delete", RATE_LIMITS.mutate);
    const parsed = deleteProductFileSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Choose a valid file." };
    }

    // Storage first: re-deleting a missing object is a no-op, so a failure
    // between the two steps stays retryable from the UI.
    const { data: file, error } = await access.client
      .from("file_sources")
      .select("storage_path, workspace_id")
      .eq("id", parsed.data.fileSourceId)
      .eq("user_id", access.ownerId)
      .maybeSingle();
    if (error) throw error;
    if (!file) return { ok: false, error: "File not found." };

    await removeStorageObject(access, file.storage_path);
    await deleteFileSource(access.client, access.ownerId, parsed.data.fileSourceId);
    // Drop the polymorphic recent_items pointer so no "recent" entry dangles.
    await clearRecentItems(access, {
      workspaceId: file.workspace_id,
      targetType: "file",
      targetId: parsed.data.fileSourceId,
    });
    revalidatePath("/files");
    return { ok: true, data: undefined };
  } catch (cause) {
    return filesActionError(cause, "Could not delete the file.");
  }
}

export async function recreateFilesDatabase(): Promise<void> {
  const current = await getCurrentWorkspace();
  if (!current) throw new Error("Workspace not found.");

  await createDatabase(current.access.client, current.access.ownerId, {
    workspaceId: current.workspace.id,
    templateType: "files",
    name: "Files",
  });

  revalidatePath("/files");
  revalidatePath("/", "layout");
}

async function requireOwnedFileSource(fileId: string) {
  const access = await requireDataAccess();
  const { data, error } = await access.client
    .from("file_sources")
    .select("id, workspace_id, page_id, storage_path, name")
    .eq("id", fileId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("File not found.");

  const { data: workspace, error: workspaceError } = await access.client
    .from("workspaces")
    .select("id")
    .eq("id", data.workspace_id)
    .eq("owner_id", access.ownerId)
    .maybeSingle();
  if (workspaceError) throw workspaceError;
  if (!workspace) throw new Error("File not found.");

  return { access, file: data };
}

export async function deleteFile(fileId: string): Promise<DeleteResult> {
  try {
    const { access, file } = await requireOwnedFileSource(fileId);
    await enforceRateLimit(access, "files:delete-file", RATE_LIMITS.mutate);

    if (file.page_id && isVirtualStoragePath(file.storage_path)) {
      await clearRecentItems(access, {
        workspaceId: file.workspace_id,
        targetType: "page",
        targetId: file.page_id,
      });
      const { error: fileRowError } = await access.client
        .from("file_sources")
        .delete()
        .eq("id", fileId);
      if (fileRowError) throw fileRowError;
      const { error: pageDeleteError } = await access.client
        .from("pages")
        .delete()
        .eq("id", file.page_id);
      if (pageDeleteError) throw pageDeleteError;
    } else {
      await removeStorageObject(access, file.storage_path);
      const { error: rowError } = await access.client
        .from("file_sources")
        .delete()
        .eq("id", fileId);
      if (rowError) throw rowError;
    }

    await clearRecentItems(access, {
      workspaceId: file.workspace_id,
      targetType: "file",
      targetId: fileId,
    });

    revalidatePath("/files");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (cause) {
    return deleteError(cause, "Failed to delete the file.");
  }
}
