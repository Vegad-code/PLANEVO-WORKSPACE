"use server";

import { revalidatePath } from "next/cache";
import { createDatabase } from "@planevo/core/mutations/create-database";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { requireDataAccess } from "@/lib/data/access";
import {
  clearRecentItems,
  deleteError,
  isVirtualStoragePath,
  removeStorageObject,
  type DeleteResult,
} from "@/lib/mutations/delete-entities";

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
