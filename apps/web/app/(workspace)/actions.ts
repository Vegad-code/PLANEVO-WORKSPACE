"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireDataAccess, requireMutationDataAccess } from "@/lib/data/access";
import { WORKSPACE_COOKIE } from "@/lib/data/current-workspace";
import {
  deleteError,
  removeWorkspaceStoragePrefix,
  type DeleteResult,
} from "@/lib/mutations/delete-entities";
import {
  createCalendarDatabaseWithViews as createCalendarFoundation,
  createDocumentPage as createDocumentFoundation,
  createTaskWithRequiredFoundation as createTaskFoundation,
  createWorkspace as createWorkspaceFoundation,
  type CreateTaskWithRequiredFoundationInput,
  type DatabaseFoundationResult,
  type TaskCreationResult,
  type WorkspaceCreationResult,
} from "@/lib/mutations/create-foundations";

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

function errorMessage(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

async function runFoundationAction<T>(
  operation: () => Promise<T>,
  fallback: string,
): Promise<ActionResult<T>> {
  try {
    const data = await operation();
    revalidatePath("/", "layout");
    return { success: true, data };
  } catch (cause) {
    return { success: false, error: errorMessage(cause, fallback) };
  }
}

export async function bootstrapWorkspace(): Promise<ActionResult<WorkspaceCreationResult>> {
  try {
    const access = await requireMutationDataAccess();
    const { data, error } = await access.client
      .from("workspaces")
      .select("id")
      .eq("owner_id", access.ownerId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return { success: true, data: { workspaceId: data.id } };
  } catch (cause) {
    return {
      success: false,
      error: errorMessage(cause, "Failed to inspect the current workspace."),
    };
  }

  return createWorkspace({ name: "My workspace" });
}

export async function setCurrentWorkspace(workspaceId: string): Promise<void> {
  const access = await requireDataAccess();
  const { data, error } = await access.client
    .from("workspaces")
    .select("id")
    .eq("id", workspaceId)
    .eq("owner_id", access.ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Workspace not found.");

  const store = await cookies();
  store.set(WORKSPACE_COOKIE, workspaceId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}

export async function createInitialWorkspace(): Promise<void> {
  const result = await bootstrapWorkspace();
  if (!result.success) throw new Error(result.error);
  revalidatePath("/", "layout");
}

export async function createWorkspace(input: {
  name: string;
  icon?: string | null;
}): Promise<ActionResult<WorkspaceCreationResult>> {
  return runFoundationAction(
    () => createWorkspaceFoundation(input),
    "Failed to create the workspace.",
  );
}

export async function createCalendarDatabaseWithViews(input: {
  workspaceId: string;
  name?: string;
}): Promise<ActionResult<DatabaseFoundationResult>> {
  return runFoundationAction(
    () => createCalendarFoundation(input),
    "Failed to create the calendar.",
  );
}

export async function createTaskWithRequiredFoundation(
  input: CreateTaskWithRequiredFoundationInput,
): Promise<ActionResult<TaskCreationResult>> {
  return runFoundationAction(
    () => createTaskFoundation(input),
    "Failed to create the task.",
  );
}

export async function createPageAndOpen(): Promise<void> {
  const { getCurrentWorkspace } = await import("@/lib/data/current-workspace");
  const current = await getCurrentWorkspace();
  const workspaceId = current
    ? current.workspace.id
    : (await createWorkspaceFoundation({ name: "My workspace" })).workspaceId;
  const { pageId } = await createDocumentFoundation({ workspaceId });
  revalidatePath("/", "layout");
  redirect(`/pages/${pageId}`);
}

export async function renameWorkspace(input: {
  workspaceId: string;
  name: string;
}): Promise<ActionResult> {
  const name = input.name.trim();
  if (!name) return { success: false, error: "Workspace name is required." };

  try {
    const access = await requireDataAccess();
    const { error } = await access.client
      .from("workspaces")
      .update({ name })
      .eq("id", input.workspaceId)
      .eq("owner_id", access.ownerId);
    if (error) throw error;
    revalidatePath("/", "layout");
    return { success: true, data: undefined };
  } catch (cause) {
    return { success: false, error: errorMessage(cause, "Failed to rename the workspace.") };
  }
}

export async function deleteWorkspace(input: {
  workspaceId: string;
  confirmationName: string;
}): Promise<DeleteResult> {
  try {
    const access = await requireDataAccess();
    const { data: workspace, error: workspaceError } = await access.client
      .from("workspaces")
      .select("id, name")
      .eq("id", input.workspaceId)
      .eq("owner_id", access.ownerId)
      .maybeSingle();
    if (workspaceError) throw workspaceError;
    if (!workspace) return { ok: false, error: "Workspace not found." };
    if (input.confirmationName.trim() !== workspace.name) {
      return { ok: false, error: "The workspace name doesn't match." };
    }

    await removeWorkspaceStoragePrefix(access, input.workspaceId);

    const store = await cookies();
    const activeId = store.get(WORKSPACE_COOKIE)?.value;
    if (activeId === input.workspaceId) {
      const { data: nextWorkspace, error: nextError } = await access.client
        .from("workspaces")
        .select("id")
        .eq("owner_id", access.ownerId)
        .neq("id", input.workspaceId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (nextError) throw nextError;
      if (nextWorkspace) {
        store.set(WORKSPACE_COOKIE, nextWorkspace.id, {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          sameSite: "lax",
        });
      } else {
        store.delete(WORKSPACE_COOKIE);
      }
    }

    const { error } = await access.client
      .from("workspaces")
      .delete()
      .eq("id", input.workspaceId);
    if (error) throw error;

    revalidatePath("/", "layout");
  } catch (cause) {
    return deleteError(cause, "Failed to delete the workspace.");
  }

  redirect("/");
}

