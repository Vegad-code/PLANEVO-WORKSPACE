"use client";

import { useTransition } from "react";
import { deletePage, duplicatePageAsTemplate } from "@/app/(workspace)/pages/[pageId]/actions";
import { DeleteEntityControl } from "@/components/ui/delete-entity-control";

export function PageHeaderActions({
  pageId,
  pageTitle,
}: {
  pageId: string;
  pageTitle: string;
}) {
  const label = pageTitle.trim() || "Untitled";
  const [isDuplicating, startDuplicate] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={isDuplicating}
        onClick={() => startDuplicate(() => duplicatePageAsTemplate(pageId))}
        className="h-8 rounded-lg border border-border-strong bg-paper px-3 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
      >
        {isDuplicating ? "Duplicating…" : "Duplicate as template"}
      </button>
      <DeleteEntityControl
        label="Delete page"
        title={`Delete “${label}”?`}
        description="This permanently removes the page and any linked file entry. Child pages are deleted too. This can't be undone."
        confirmLabel="Delete page"
        onConfirm={() => deletePage(pageId)}
      />
    </div>
  );
}
