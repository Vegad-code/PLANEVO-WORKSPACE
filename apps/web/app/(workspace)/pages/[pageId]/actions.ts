"use server";

import { revalidatePath } from "next/cache";
import { requireDataAccess } from "@/lib/data/access";

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

export async function updatePageTitle(pageId: string, title: string): Promise<void> {
  const { access } = await requireOwnedPage(pageId);
  const { error } = await access.client
    .from("pages")
    .update({ title: title.trim() || "Untitled" })
    .eq("id", pageId);
  if (error) throw error;
  revalidatePath("/", "layout");
}
