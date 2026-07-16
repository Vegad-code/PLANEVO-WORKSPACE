"use client";

import { deleteConversation } from "@/app/(workspace)/ai/actions";
import { DeleteEntityControl } from "@/components/ui/delete-entity-control";

export function ConversationHeaderActions({
  conversationId,
  conversationTitle,
}: {
  conversationId: string;
  conversationTitle: string;
}) {
  const label = conversationTitle.trim() || "New conversation";

  return (
    <DeleteEntityControl
      label="Delete conversation"
      title={`Delete “${label}”?`}
      description="This permanently removes the conversation and all saved messages. This can't be undone."
      confirmLabel="Delete conversation"
      onConfirm={() => deleteConversation(conversationId)}
    />
  );
}
