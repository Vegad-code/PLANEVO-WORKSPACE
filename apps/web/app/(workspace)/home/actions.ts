"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMutationDataAccess } from "@/lib/data/access";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { createWorkspace, setCurrentWorkspace } from "../actions";

export async function createNamedWorkspace(formData: FormData): Promise<void> {
  const value = formData.get("name");
  const name = typeof value === "string" && value.trim() ? value.trim() : "My workspace";
  const result = await createWorkspace({ name });
  if (!result.success) throw new Error(result.error);
  await setCurrentWorkspace(result.data.workspaceId);
  revalidatePath("/", "layout");
  redirect("/");
}

export async function askPlanevo(formData: FormData): Promise<void> {
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;

  const access = await requireMutationDataAccess();
  const current = await getCurrentWorkspace();
  if (!current) throw new Error("No workspace available.");

  const title = content.length > 60 ? `${content.slice(0, 60)}…` : content;
  const { data, error } = await access.client
    .from("ai_conversations")
    .insert({
      workspace_id: current.workspace.id,
      user_id: access.ownerId,
      title,
    })
    .select("id")
    .single();
  if (error) throw error;

  const { error: messageError } = await access.client.from("ai_messages").insert({
    conversation_id: data.id,
    role: "user",
    content_json: [{ type: "text", text: content }],
  });
  if (messageError) throw messageError;

  revalidatePath("/ai");
  redirect(`/ai/${data.id}`);
}
