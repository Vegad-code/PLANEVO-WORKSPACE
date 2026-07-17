"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { stripPageContentForTemplate } from "@planevo/core/mutations/duplicate-page";
import { promoteBlocksToDatabase } from "@planevo/core/mutations/promote-blocks";
import { createDatabase } from "@planevo/core/mutations/create-database";
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
 * F-10: promote list blocks into records, preserving source_block_id for reverse path.
 */
export async function promoteBlocksToRecords(input: {
  pageId: string;
  databaseId: string;
  createNewTaskDatabase?: boolean;
  blocks: Array<{
    blockId: string;
    title: string;
    dueDate?: string | null;
    priority?: string | null;
    status?: string | null;
  }>;
}): Promise<{
  ok: boolean;
  databaseId?: string;
  recordIds?: string[];
  error?: string;
}> {
  const cleaned = input.blocks
    .map((block) => ({
      blockId: block.blockId,
      title: block.title.trim(),
      dueDate: block.dueDate ?? null,
      priority: block.priority ?? null,
      status: block.status ?? null,
    }))
    .filter((block) => block.title.length > 0)
    .slice(0, 50);

  if (cleaned.length === 0) {
    return { ok: false, error: "Nothing to promote." };
  }

  try {
    const { access, pageId: ownedPageId } = await requireOwnedPage(input.pageId);
    void ownedPageId;

    let databaseId = input.databaseId;

    if (input.createNewTaskDatabase) {
      const { data: page, error: pageError } = await access.client
        .from("pages")
        .select("workspace_id")
        .eq("id", input.pageId)
        .maybeSingle();
      if (pageError) throw pageError;
      if (!page) return { ok: false, error: "Page not found." };

      const created = await createDatabase(access.client, access.ownerId, {
        workspaceId: page.workspace_id,
        templateType: "task",
      });
      databaseId = created.databaseId;
    }

    const { data: database, error: databaseError } = await access.client
      .from("databases")
      .select("id, workspaces!inner(owner_id)")
      .eq("id", databaseId)
      .eq("workspaces.owner_id", access.ownerId)
      .maybeSingle();
    if (databaseError) throw databaseError;
    if (!database) return { ok: false, error: "Database not found." };

    const result = await promoteBlocksToDatabase(access.client, access.ownerId, {
      databaseId,
      blocks: cleaned,
    });

    revalidatePath("/tasks");
    revalidatePath(`/databases/${databaseId}`);
    revalidatePath("/", "layout");

    return {
      ok: true,
      databaseId: result.databaseId,
      recordIds: result.recordIds,
    };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to promote blocks.",
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

export async function updatePageIcon(
  pageId: string,
  icon: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { access } = await requireOwnedPage(pageId);
    const cleaned = icon?.trim() || null;
    const { error } = await access.client
      .from("pages")
      .update({ icon: cleaned })
      .eq("id", pageId);
    if (error) throw error;
    revalidatePath("/", "layout");
    revalidatePath(`/pages/${pageId}`);
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to update the icon.",
    };
  }
}

export async function updatePageCover(
  pageId: string,
  coverImage: string | null,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { access } = await requireOwnedPage(pageId);
    const cleaned = coverImage?.trim() || null;
    const { error } = await access.client
      .from("pages")
      .update({ cover_image: cleaned })
      .eq("id", pageId);
    if (error) throw error;
    revalidatePath(`/pages/${pageId}`);
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to update the cover.",
    };
  }
}

/** Create a child page under `parentPageId` and return its id for linking. */
export async function createSubpage(input: {
  parentPageId: string;
  title?: string;
}): Promise<{ ok: boolean; pageId?: string; error?: string }> {
  try {
    const { access } = await requireOwnedPage(input.parentPageId);
    const { data: parent, error: parentError } = await access.client
      .from("pages")
      .select("id, workspace_id, position")
      .eq("id", input.parentPageId)
      .maybeSingle();
    if (parentError) throw parentError;
    if (!parent) return { ok: false, error: "Parent page not found." };

    const { data: siblings, error: siblingsError } = await access.client
      .from("pages")
      .select("position")
      .eq("parent_page_id", parent.id)
      .order("position", { ascending: false })
      .limit(1);
    if (siblingsError) throw siblingsError;

    const nextPosition = (siblings?.[0]?.position ?? -1) + 1;
    const title = input.title?.trim() || "Untitled";

    const { data: created, error: createError } = await access.client
      .from("pages")
      .insert({
        workspace_id: parent.workspace_id,
        parent_page_id: parent.id,
        title,
        position: nextPosition,
      })
      .select("id")
      .single();
    if (createError) throw createError;

    revalidatePath("/", "layout");
    return { ok: true, pageId: created.id };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to create a page.",
    };
  }
}

/** Slash-menu path: create a database from a built-in template under this page. */
export async function createDatabaseFromTemplateAction(input: {
  pageId: string;
  templateType: "task" | "notes" | "project" | "files" | "custom";
  name?: string;
}): Promise<{ ok: boolean; databaseId?: string; pageId?: string | null; error?: string }> {
  try {
    const { access } = await requireOwnedPage(input.pageId);
    const { data: page, error: pageError } = await access.client
      .from("pages")
      .select("id, workspace_id")
      .eq("id", input.pageId)
      .maybeSingle();
    if (pageError) throw pageError;
    if (!page) return { ok: false, error: "Page not found." };

    const created = await createDatabase(access.client, access.ownerId, {
      workspaceId: page.workspace_id,
      templateType: input.templateType,
      name: input.name,
      parentPageId: page.id,
      createPage: true,
    });

    revalidatePath("/", "layout");
    revalidatePath(`/pages/${input.pageId}`);
    if (created.databaseId) revalidatePath(`/databases/${created.databaseId}`);

    return {
      ok: true,
      databaseId: created.databaseId,
      pageId: created.pageId,
    };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to create a database.",
    };
  }
}

/** F-12: duplicate page layout with cleared text and fresh block ids. */
export async function duplicatePageAsTemplate(pageId: string): Promise<void> {
  const { access } = await requireOwnedPage(pageId);
  const { data: source, error: sourceError } = await access.client
    .from("pages")
    .select("id, workspace_id, parent_page_id, title, content_json, icon, position")
    .eq("id", pageId)
    .maybeSingle();
  if (sourceError) throw sourceError;
  if (!source) throw new Error("Page not found.");

  const copyTitle = `${source.title.trim() || "Untitled"} (copy)`;
  const { data: created, error: createError } = await access.client
    .from("pages")
    .insert({
      workspace_id: source.workspace_id,
      parent_page_id: source.parent_page_id,
      title: copyTitle,
      content_json: stripPageContentForTemplate(source.content_json),
      icon: source.icon,
      position: source.position + 0.5,
    })
    .select("id")
    .single();
  if (createError) throw createError;

  revalidatePath("/", "layout");
  redirect(`/pages/${created.id}`);
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
