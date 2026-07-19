"use client";

import { useState, useTransition } from "react";
import {
  deleteWorkspace,
  renameWorkspace,
  updateWorkspaceIcon,
} from "@/app/(workspace)/actions";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { Icon } from "@/components/ui/planevo-icon";
import type { WorkspaceSummary } from "@/lib/queries/workspace-shell";

export function WorkspaceManagePopover({
  workspace,
  onClose,
}: {
  workspace: WorkspaceSummary;
  onClose: () => void;
}) {
  const [name, setName] = useState(workspace.name);
  const [icon, setIcon] = useState(workspace.icon);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteDialogKey, setDeleteDialogKey] = useState(0);
  const [isPending, startTransition] = useTransition();

  function handleRename(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await renameWorkspace({ workspaceId: workspace.id, name });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setError(null);
      onClose();
    });
  }

  function handleIconChange(nextIcon: string | null) {
    setIcon(nextIcon);
    startTransition(async () => {
      const result = await updateWorkspaceIcon({ workspaceId: workspace.id, icon: nextIcon });
      if (!result.success) {
        setError(result.error);
        setIcon(workspace.icon);
      } else {
        setError(null);
      }
    });
  }

  return (
    <>
      <div
        role="dialog"
        aria-label={`Manage ${workspace.name}`}
        className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-surface-raised p-4 shadow-none"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-label uppercase text-text-muted">Workspace</p>
            <h3 className="mt-1 text-h3">Manage workspace</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close workspace manager"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted outline-none hover:bg-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <EmojiPicker value={icon} onChange={handleIconChange} label="Workspace icon" />
          <p className="text-small text-text-secondary">Pick an icon for this workspace.</p>
        </div>

        <form onSubmit={handleRename} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-small font-medium">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="mt-2 h-10 w-full rounded-lg border border-border-strong bg-paper px-3 text-body outline-none focus:border-ink"
            />
          </label>
          {error && (
            <p role="alert" className="rounded-lg bg-brick-tint px-3 py-2 text-small text-ink">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isPending || name.trim() === workspace.name}
            className="h-9 rounded-lg bg-ink px-4 text-small font-medium text-paper outline-none hover:opacity-90 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save name"}
          </button>
        </form>

        <div className="mt-4 border-t border-border pt-4">
          <p className="text-small text-text-secondary">
            Deleting removes every page, database, file, and conversation in this workspace.
          </p>
          <button
            type="button"
            onClick={() => {
              setDeleteDialogKey((key) => key + 1);
              setDeleteOpen(true);
            }}
            className="mt-3 inline-flex h-8 items-center gap-2 rounded-lg border border-border-strong px-3 text-small font-medium text-text-secondary outline-none hover:border-brick hover:text-brick focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Icon name="warning" className="size-4" />
            Delete workspace
          </button>
        </div>
      </div>

      <ConfirmDeleteDialog
        key={deleteDialogKey}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Delete “${workspace.name}”?`}
        description="Every page, database, record, file, and conversation in this workspace will be permanently removed. Storage uploads will be deleted too."
        confirmLabel="Delete workspace"
        confirmationPhrase={workspace.name}
        onConfirm={(typedConfirmation) =>
          deleteWorkspace({
            workspaceId: workspace.id,
            confirmationName: typedConfirmation ?? "",
          })
        }
      />
    </>
  );
}
