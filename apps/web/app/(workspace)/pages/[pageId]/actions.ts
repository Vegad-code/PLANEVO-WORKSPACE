"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireDataAccess } from "@/lib/data/access";
import {
  clearRecentItems,
  deleteError,
  virtualPageStoragePath,
  type DeleteResult,
} from "@/lib/mutations/delete-entities";

// BlockNote documents are arrays of block objects. Cap the serialized size so
// a runaway document can't blow up the row (~2MB of JSON).
const MAX_CONTENT_BYTES = 2 * 1024 * 1024;

async function requireOwnedPage(pageId: string) {
  const access = await requireDataAccess();
  const { data, error } = await access.client
    .from("pages")
    .select("id, workspace_id, workspaces!inner(owner_id)")
    .eq("id", pageId)
    .eq("workspaces.owner_id", access.ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Page not found.");
  return { access, pageId: data.id };
}

export async function savePageContent(
  pageId: string,
  content: unknown,
): Promise<{ ok: boolean; error?: string }> {
  if (!Array.isArray(content)) {
    return { ok: false, error: "Page content must be a list of blocks." };
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(content);
  } catch {
    return { ok: false, error: "Page content is not serializable." };
  }
  if (serialized.length > MAX_CONTENT_BYTES) {
    return { ok: false, error: "This page is too large to save." };
  }

  try {
    const { access } = await requireOwnedPage(pageId);
    const { error } = await access.client
      .from("pages")
      .update({ content_json: JSON.parse(serialized) })
      .eq("id", pageId);
    if (error) throw error;
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to save the page.",
    };
  }
}

/**
 * Retroactive structure v1 (PRD §5.3 #1, checklist slice): promote written
 * list items into real task records in the workspace's default task database.
 */
export async function promoteItemsToTasks(
  pageId: string,
  titles: string[],
): Promise<{ ok: boolean; created: number; error?: string }> {
  const cleaned = titles.map((title) => title.trim()).filter(Boolean).slice(0, 50);
  if (cleaned.length === 0) {
    return { ok: false, created: 0, error: "Select bullet or checklist items first." };
  }

  try {
    await requireOwnedPage(pageId);
    const { createTaskWithRequiredFoundation } = await import(
      "@/lib/mutations/create-foundations"
    );
    // ponytail: one RPC per item — selections are small; batch RPC if bulk
    // promotion ever exceeds dozens of items.
    for (const title of cleaned) {
      await createTaskWithRequiredFoundation({ title });
    }
    revalidatePath("/tasks");
    revalidatePath("/", "layout");
    return { ok: true, created: cleaned.length };
  } catch (cause) {
    return {
      ok: false,
      created: 0,
      error: cause instanceof Error ? cause.message : "Failed to create tasks.",
    };
  }
}

export async function updatePageTitle(pageId: string, title: string): Promise<void> {
  const { access } = await requireOwnedPage(pageId);
  const { error } = await access.client
    .from("pages")
    .update({ title: title.trim() || "Untitled" })
    .eq("id", pageId);
  if (error) throw error;
  revalidatePath("/", "layout");
}

export async function deletePage(pageId: string): Promise<DeleteResult> {
  try {
    const access = await requireDataAccess();
    const { data: page, error: pageError } = await access.client
      .from("pages")
      .select("id, workspace_id, workspaces!inner(owner_id)")
      .eq("id", pageId)
      .eq("workspaces.owner_id", access.ownerId)
      .maybeSingle();
    if (pageError) throw pageError;
    if (!page) return { ok: false, error: "Page not found." };

    const { error: fileError } = await access.client
      .from("file_sources")
      .delete()
      .or(`page_id.eq.${pageId},storage_path.eq.${virtualPageStoragePath(pageId)}`);
    if (fileError) throw fileError;

    await clearRecentItems(access, {
      workspaceId: page.workspace_id,
      targetType: "page",
      targetId: pageId,
    });

    const { error } = await access.client.from("pages").delete().eq("id", pageId);
    if (error) throw error;

    revalidatePath("/files");
    revalidatePath("/", "layout");
  } catch (cause) {
    return deleteError(cause, "Failed to delete the page.");
  }

  redirect("/");
}
