"use server";

import { revalidatePath } from "next/cache";
import {
  createFoundationMutations,
  type FoundationRpcClient,
} from "@planevo/core/mutations/create-foundations";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { createTaskWithRequiredFoundation } from "../actions";

export type TaskFormState =
  | { status: "idle"; message: null }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

function optionalString(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function recreateTaskDatabase(): Promise<void> {
  const current = await getCurrentWorkspace();
  if (!current) throw new Error("Workspace not found.");

  const mutations = createFoundationMutations(
    current.access.client as unknown as FoundationRpcClient,
    current.access.ownerId,
  );
  await mutations.createTaskDatabaseWithViews({
    workspaceId: current.workspace.id,
    name: "Tasks",
  });

  revalidatePath("/tasks");
  revalidatePath("/", "layout");
}

export async function submitTask(
  _previousState: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const title = optionalString(formData, "title");
  if (!title) return { status: "error", message: "Add a task title to continue." };

  // Resolved server-side — the form's workspace id is never trusted.
  const workspaceId = (await getCurrentWorkspace())?.workspace.id ?? null;
  const dueDateValue = optionalString(formData, "dueDate");
  const estimateValue = optionalString(formData, "estimateMinutes");
  const tags = (optionalString(formData, "tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const result = await createTaskWithRequiredFoundation({
    workspaceId,
    title,
    description: optionalString(formData, "description"),
    status: optionalString(formData, "status") ?? "Not started",
    priority: optionalString(formData, "priority"),
    dueDate: dueDateValue ? new Date(dueDateValue).toISOString() : null,
    estimateMinutes: estimateValue ? Number.parseInt(estimateValue, 10) : null,
    tags,
    attachments: [],
  });

  if (!result.success) return { status: "error", message: result.error };

  revalidatePath("/tasks");
  revalidatePath("/", "layout");
  return { status: "success", message: "Task created." };
}
