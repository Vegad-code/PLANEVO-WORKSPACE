"use client";

import { deletePage } from "@/app/(workspace)/pages/[pageId]/actions";
import { DeleteEntityControl } from "@/components/ui/delete-entity-control";

export function PageHeaderActions({
  pageId,
  pageTitle,
}: {
  pageId: string;
  pageTitle: string;
}) {
  const label = pageTitle.trim() || "Untitled";

  return (
    <DeleteEntityControl
      label="Delete page"
      title={`Delete “${label}”?`}
      description="This permanently removes the page and any linked file entry. Child pages are deleted too. This can't be undone."
      confirmLabel="Delete page"
      onConfirm={() => deletePage(pageId)}
    />
  );
}
