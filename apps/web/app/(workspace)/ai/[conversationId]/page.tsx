import { notFound } from "next/navigation";
import { recordRecentItem } from "@planevo/api/rpc";
import type { Json } from "@planevo/core/types/database.types";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { Icon } from "@/components/ui/planevo-icon";

function messageText(content: Json): string {
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return "";
      return typeof item.text === "string" ? item.text : "";
    })
    .filter(Boolean)
    .join("\n");
}

export default async function AiConversationPage({ params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  const current = await getCurrentWorkspace();
  if (!current) notFound();
  const { access, workspace } = current;

  // Scoped to the current workspace — defense in depth over RLS (dev mode's
  // service-role client bypasses RLS entirely).
  const [{ data: conversation }, { data: messages }] = await Promise.all([
    access.client
      .from("ai_conversations")
      .select("id,title")
      .eq("id", conversationId)
      .eq("workspace_id", workspace.id)
      .maybeSingle(),
    access.client
      .from("ai_messages")
      .select("id,role,content_json,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
  ]);
  if (!conversation) notFound();

  await recordRecentItem(access.client, {
    userId: access.ownerId,
    workspaceId: workspace.id,
    targetType: "conversation",
    targetId: conversation.id,
  });

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col px-5 py-6 sm:px-8">
      <div className="border-b border-border pb-4"><p className="text-label uppercase text-text-muted">Planevo AI</p><h1 className="mt-2 text-h2">{conversation.title}</h1></div>
      <div className="flex-1 space-y-4 py-6">
        {(messages ?? []).length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center text-center"><Icon name="ai" className="size-6 text-slate" /><p className="mt-4 text-body font-medium">This conversation is empty</p><p className="mt-2 text-small text-text-muted">Planevo AI answers arrive with the model layer. Notes you send are saved here meanwhile.</p></div>
        ) : (messages ?? []).map((message) => (
          <article key={message.id} className={`max-w-2xl rounded-card border p-4 ${message.role === "user" ? "ml-auto border-border bg-surface-raised" : "border-slate bg-slate-tint"}`}><p className="whitespace-pre-wrap text-body">{messageText(message.content_json)}</p></article>
        ))}
      </div>
      <div className="sticky bottom-0 border-t border-border bg-paper py-4">
        <div className="flex items-center gap-3 rounded-card border border-slate bg-slate-tint p-4 text-left">
          <Icon name="ai" className="size-5 shrink-0 text-ink" />
          <p className="text-small text-text-secondary">
            Planevo AI is coming soon. This surface is ready — the model layer ships with the
            credit system, and this conversation will pick up right here.
          </p>
        </div>
      </div>
    </div>
  );
}
