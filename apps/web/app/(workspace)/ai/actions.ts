"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMutationDataAccess } from "@/lib/data/access";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { createWorkspace } from "@/lib/mutations/create-foundations";

async function currentWorkspaceId(): Promise<{ workspaceId: string; ownerId: string }> {
  const current = await getCurrentWorkspace();
  if (current) {
    return { workspaceId: current.workspace.id, ownerId: current.access.ownerId };
  }
  const access = await requireMutationDataAccess();
  const { workspaceId } = await createWorkspace({ name: "My workspace" });
  return { workspaceId, ownerId: access.ownerId };
}

export async function startAiConversation(): Promise<void> {
  const access = await requireMutationDataAccess();
  const { workspaceId, ownerId } = await currentWorkspaceId();
  const { data, error } = await access.client
    .from("ai_conversations")
    .insert({ workspace_id: workspaceId, user_id: ownerId, title: "New conversation" })
    .select("id")
    .single();
  if (error) throw error;
  revalidatePath("/ai");
  redirect(`/ai/${data.id}`);
}

export async function saveConversationMessage(formData: FormData): Promise<void> {
  const conversationId = String(formData.get("conversationId") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!conversationId || !content) return;
  const access = await requireMutationDataAccess();
  const { error } = await access.client.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content_json: [{ type: "text", text: content }],
  });
  if (error) throw error;
  revalidatePath(`/ai/${conversationId}`);
  redirect(`/ai/${conversationId}`);
}
