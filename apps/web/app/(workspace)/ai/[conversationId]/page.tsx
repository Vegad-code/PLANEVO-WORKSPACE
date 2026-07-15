import { notFound } from "next/navigation";
import { getDataAccess } from "@/lib/data/access";
import type { Json } from "@/lib/database.types";
import { Icon } from "@/app/components/planevo-icon";
import { saveConversationMessage } from "../actions";

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
  const access = await getDataAccess();
  if (!access) notFound();
  const [{ data: conversation }, { data: messages }] = await Promise.all([
    access.client.from("ai_conversations").select("id,title").eq("id", conversationId).maybeSingle(),
    access.client.from("ai_messages").select("id,role,content_json,created_at").eq("conversation_id", conversationId).order("created_at", { ascending: true }),
  ]);
  if (!conversation) notFound();

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col px-5 py-6 sm:px-8">
      <div className="border-b border-border pb-4"><p className="text-label uppercase text-text-muted">Planevo AI</p><h1 className="mt-2 text-h2">{conversation.title}</h1></div>
      <div className="flex-1 space-y-4 py-6">
        {(messages ?? []).length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center text-center"><Icon name="ai" className="size-6 text-slate" /><p className="mt-4 text-body font-medium">This conversation is empty</p><p className="mt-2 text-small text-text-muted">Your first message will be stored in this workspace conversation.</p></div>
        ) : (messages ?? []).map((message) => (
          <article key={message.id} className={`max-w-2xl rounded-card border p-4 ${message.role === "user" ? "ml-auto border-border bg-surface-raised" : "border-slate bg-slate-tint"}`}><p className="whitespace-pre-wrap text-body">{messageText(message.content_json)}</p></article>
        ))}
      </div>
      <form action={saveConversationMessage} className="sticky bottom-0 border-t border-border bg-paper py-4">
        <input type="hidden" name="conversationId" value={conversationId} />
        <div className="flex items-end gap-3 rounded-card border border-slate bg-surface-raised p-3"><textarea required name="content" rows={2} placeholder="Ask about your workspace…" className="min-h-12 flex-1 resize-none bg-transparent text-body outline-none placeholder:text-text-muted" /><button type="submit" className="h-9 rounded-lg bg-slate px-4 text-small font-medium text-ink outline-none hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink">Send</button></div>
      </form>
    </div>
  );
}
