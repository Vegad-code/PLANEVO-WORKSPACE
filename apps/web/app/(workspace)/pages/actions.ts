"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireDataAccess } from "@/lib/data/access";

const reorderPageSchema = z.object({
  pageId: z.string().uuid(),
  parentPageId: z.string().uuid().nullable(),
  position: z.number().finite(),
});

async function requireOwnedPage(pageId: string) {
  const access = await requireDataAccess();
  const { data, error } = await access.client
    .from("pages")
    .select("id, workspace_id, parent_page_id, workspaces!inner(owner_id)")
    .eq("id", pageId)
    .eq("workspaces.owner_id", access.ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Page not found.");
  return { access, page: data };
}

async function getParentPageId(
  access: Awaited<ReturnType<typeof requireDataAccess>>,
  pageId: string,
): Promise<string | null> {
  const { data, error } = await access.client
    .from("pages")
    .select("parent_page_id")
    .eq("id", pageId)
    .maybeSingle();
  if (error) throw error;
  return data?.parent_page_id ?? null;
}

async function isDescendantOf(
  access: Awaited<ReturnType<typeof requireDataAccess>>,
  ancestorId: string,
  candidateId: string,
): Promise<boolean> {
  let current: string | null = candidateId;
  const visited = new Set<string>();

  while (current) {
    if (current === ancestorId) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    current = await getParentPageId(access, current);
  }

  return false;
}

export async function reorderPage(input: {
  pageId: string;
  parentPageId: string | null;
  position: number;
}): Promise<{ ok: boolean; error?: string }> {
  const parsed = reorderPageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid reorder request." };
  }

  const { pageId, parentPageId, position } = parsed.data;

  try {
    const { access, page } = await requireOwnedPage(pageId);

    if (parentPageId === pageId) {
      return { ok: false, error: "A page cannot be nested under itself." };
    }

    if (parentPageId) {
      const { data: parentPage, error: parentError } = await access.client
        .from("pages")
        .select("id, workspace_id, workspaces!inner(owner_id)")
        .eq("id", parentPageId)
        .eq("workspaces.owner_id", access.ownerId)
        .maybeSingle();
      if (parentError) throw parentError;
      if (!parentPage) {
        return { ok: false, error: "Parent page not found." };
      }
      if (parentPage.workspace_id !== page.workspace_id) {
        return { ok: false, error: "Parent page must belong to the same workspace." };
      }
      if (await isDescendantOf(access, pageId, parentPageId)) {
        return { ok: false, error: "A page cannot be nested under its own descendant." };
      }
    }

    const { error } = await access.client
      .from("pages")
      .update({ parent_page_id: parentPageId, position })
      .eq("id", pageId);
    if (error) throw error;

    revalidatePath("/", "layout");
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to reorder the page.",
    };
  }
}
