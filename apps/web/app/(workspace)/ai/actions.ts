"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMutationDataAccess } from "@/lib/data/access";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { createWorkspace } from "@/lib/mutations/create-foundations";
import {
  clearRecentItems,
  deleteError,
  type DeleteResult,
} from "@/lib/mutations/delete-entities";

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

  // Ownership check in app code — defense in depth over RLS, which the
  // dev-mode service-role client bypasses.
  const { workspaceId } = await currentWorkspaceId();
  const { data: conversation, error: conversationError } = await access.client
    .from("ai_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversation) throw new Error("Conversation not found.");

  const { error } = await access.client.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content_json: [{ type: "text", text: content }],
  });
  if (error) throw error;
  revalidatePath(`/ai/${conversationId}`);
  redirect(`/ai/${conversationId}`);
}

export async function deleteConversation(conversationId: string): Promise<DeleteResult> {
  try {
    const access = await requireMutationDataAccess();
    const { workspaceId } = await currentWorkspaceId();
    const { data: conversation, error: conversationError } = await access.client
      .from("ai_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (conversationError) throw conversationError;
    if (!conversation) return { ok: false, error: "Conversation not found." };

    await clearRecentItems(access, {
      workspaceId,
      targetType: "conversation",
      targetId: conversationId,
    });

    const { error } = await access.client
      .from("ai_conversations")
      .delete()
      .eq("id", conversationId);
    if (error) throw error;

    revalidatePath("/ai");
    revalidatePath("/", "layout");
  } catch (cause) {
    return deleteError(cause, "Failed to delete the conversation.");
  }

  redirect("/ai");
}
