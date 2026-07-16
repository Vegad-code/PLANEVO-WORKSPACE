"use client";

import { useState } from "react";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { DeleteEntityControl } from "@/components/ui/delete-entity-control";
import { HoverDeleteAction } from "@/components/ui/hover-delete-action";
import { WorkspaceManagePopover } from "@/features/shell/workspace-manage-popover";
import type { WorkspaceSummary } from "@/lib/queries/workspace-shell";

const PREVIEW_WORKSPACE: WorkspaceSummary = {
  id: "design-workspace",
  name: "Anthony's workspace",
  icon: null,
};

export function DeleteControlsPreview() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(true);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-card border border-border bg-surface-raised p-5">
        <p className="text-body font-medium">Hover-reveal delete</p>
        <p className="mt-1 text-small text-text-secondary">
          Delete appears when you hover a row or card. Hidden at rest.
        </p>
        <div className="mt-4 space-y-3">
          <HoverDeleteAction
            className="rounded-lg border border-border bg-paper px-3 py-2"
            label="Delete Draft the lab report"
            title="Delete “Draft the lab report”?"
            description="This permanently removes the record and all of its property values. This can't be undone."
            confirmLabel="Delete record"
            onConfirm={async () => ({ ok: true })}
          >
            <p className="truncate text-body font-medium">Draft the lab report</p>
          </HoverDeleteAction>
          <div className="rounded-xl border border-dashed border-border px-4 py-3 text-small text-text-muted">
            Resting state — no delete button visible
          </div>
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface-raised p-5">
        <p className="text-body font-medium">Header delete + confirm dialog</p>
        <p className="mt-1 text-small text-text-secondary">
          Labeled destructive actions for pages, databases, and conversations.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <DeleteEntityControl
            label="Delete page"
            title="Delete “Lab notes”?"
            description="This permanently removes the page and any linked file entry. This can't be undone."
            confirmLabel="Delete page"
            onConfirm={async () => ({ ok: true })}
          />
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="h-9 rounded-lg border border-border-strong px-4 text-small font-medium outline-none hover:bg-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Preview confirm dialog
          </button>
        </div>
        <ConfirmDeleteDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title={"Delete \"Anthony's workspace\"?"}
          description="Every page, database, record, file, and conversation in this workspace will be permanently removed."
          confirmLabel="Delete workspace"
          confirmationPhrase="Anthony's workspace"
          onConfirm={async () => ({ ok: true })}
        />
      </div>

      <div className="rounded-card border border-border bg-surface-raised p-5 lg:col-span-2">
        <p className="text-body font-medium">Workspace manage popover</p>
        <p className="mt-1 text-small text-text-secondary">
          Double-click a workspace in the switcher to rename or delete (Notion-style).
        </p>
        <div className="relative mt-4 inline-block">
          <button
            type="button"
            onClick={() => setManageOpen((open) => !open)}
            className="h-9 rounded-lg border border-border-strong px-4 text-small font-medium outline-none hover:bg-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {manageOpen ? "Hide manage popover" : "Show manage popover"}
          </button>
          {manageOpen && (
            <WorkspaceManagePopover
              workspace={PREVIEW_WORKSPACE}
              onClose={() => setManageOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
