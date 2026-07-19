"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createDatabase } from "@planevo/core/mutations/create-database";
import {
  deleteFileSource,
  updateFileTags,
} from "@planevo/core/mutations/product-files";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { requireDataAccess, requireMutationDataAccess } from "@/lib/data/access";
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

export async function updateProductFileTagsAction(input: {
  fileSourceId: string;
  tags: string[];
}): Promise<FilesActionResult> {
  try {
    const access = await requireMutationDataAccess();
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
    const parsed = deleteProductFileSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Choose a valid file." };
    }

    // Storage first: re-deleting a missing object is a no-op, so a failure
    // between the two steps stays retryable from the UI.
    const { data: file, error } = await access.client
      .from("file_sources")
      .select("storage_path")
      .eq("id", parsed.data.fileSourceId)
      .eq("user_id", access.ownerId)
      .maybeSingle();
    if (error) throw error;
    if (!file) return { ok: false, error: "File not found." };

    await removeStorageObject(access, file.storage_path);
    await deleteFileSource(access.client, access.ownerId, parsed.data.fileSourceId);
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
