"use server";

import { revalidatePath } from "next/cache";
import { getDataAccess } from "@/lib/data/access";
import type { Database } from "@/lib/database.types";
import {
  getOrCreateDefaultWorkspace,
  listPagesForWorkspace,
} from "@/lib/queries/workspace-shell";

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

async function requireDataAccess() {
  const access = await getDataAccess();
  if (!access) {
    return null;
  }
  return access;
}

export async function bootstrapWorkspace(): Promise<
  ActionResult<Database["public"]["Tables"]["workspaces"]["Row"]>
> {
  const access = await requireDataAccess();
  if (!access) {
    return {
      success: false,
      error:
        "No data access. Add PLANEVO_DEV_OWNER_ID and a server secret key (SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY) to .env.local, then run npm run db:seed.",
    };
  }

  try {
    const workspace = await getOrCreateDefaultWorkspace(
      access.client,
      access.ownerId,
    );
    revalidatePath("/", "layout");
    return { success: true, data: workspace };
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Failed to bootstrap workspace";
    return { success: false, error: message };
  }
}

export async function createWorkspace(input: {
  name: string;
  icon?: string | null;
}): Promise<ActionResult<Database["public"]["Tables"]["workspaces"]["Row"]>> {
  const access = await requireDataAccess();
  if (!access) {
    return { success: false, error: "No data access configured." };
  }

  const name = input.name.trim();
  if (!name) {
    return { success: false, error: "Workspace name is required" };
  }

  const payload: Database["public"]["Tables"]["workspaces"]["Insert"] = {
    owner_id: access.ownerId,
    name,
    icon: input.icon ?? null,
  };

  const { data, error } = await access.client
    .from("workspaces")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true, data };
}

export async function updateWorkspace(input: {
  workspaceId: string;
  name?: string;
  icon?: string | null;
}): Promise<ActionResult<Database["public"]["Tables"]["workspaces"]["Row"]>> {
  const access = await requireDataAccess();
  if (!access) {
    return { success: false, error: "No data access configured." };
  }

  const updates: Database["public"]["Tables"]["workspaces"]["Update"] = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) return { success: false, error: "Workspace name is required" };
    updates.name = name;
  }
  if (input.icon !== undefined) updates.icon = input.icon;

  const { data, error } = await access.client
    .from("workspaces")
    .update(updates)
    .eq("id", input.workspaceId)
    .eq("owner_id", access.ownerId)
    .select("*")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true, data };
}

export async function createPage(input: {
  workspaceId: string;
  title: string;
  parentPageId?: string | null;
}): Promise<ActionResult<Database["public"]["Tables"]["pages"]["Row"]>> {
  const access = await requireDataAccess();
  if (!access) {
    return { success: false, error: "No data access configured." };
  }

  const title = input.title.trim() || "Untitled";
  const siblings = await listPagesForWorkspace(access.client, input.workspaceId);
  const siblingCount = siblings.filter(
    (page) => page.parent_page_id === (input.parentPageId ?? null),
  ).length;

  const payload: Database["public"]["Tables"]["pages"]["Insert"] = {
    workspace_id: input.workspaceId,
    parent_page_id: input.parentPageId ?? null,
    title,
    position: siblingCount,
  };

  const { data, error } = await access.client
    .from("pages")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true, data };
}
