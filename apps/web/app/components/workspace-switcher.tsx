"use client";

import { useState, useTransition } from "react";
import { setCurrentWorkspace } from "@/app/(workspace)/actions";
import type { WorkspaceSummary } from "@/lib/queries/workspace-shell";
import { Icon } from "./planevo-icon";
import { WorkspaceComposer } from "./workspace-composer";

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  compact,
  workspaceName,
  workspaceInitial,
}: {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  compact: boolean;
  workspaceName: string;
  workspaceInitial: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function switchTo(workspaceId: string) {
    setOpen(false);
    if (workspaceId === activeWorkspaceId) return;
    startTransition(() => setCurrentWorkspace(workspaceId));
  }

  return (
    <div className={`relative ${compact ? "" : "min-w-0 flex-1"}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Switch workspace"
        title={compact ? workspaceName : undefined}
        className={`flex min-w-0 items-center rounded-lg outline-none transition-colors hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
          compact ? "size-9 justify-center" : "h-9 w-full gap-2 px-2"
        } ${isPending ? "opacity-60" : ""}`}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-surface-raised text-label font-medium text-ink">
          {workspaceInitial}
        </span>
        {!compact && (
          <>
            <span className="min-w-0 flex-1 truncate text-left text-small font-medium">
              {workspaceName}
            </span>
            <Icon name="chevron-down" className="size-4 shrink-0 text-text-muted" />
          </>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close workspace menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
            tabIndex={-1}
          />
          <div
            role="menu"
            aria-label="Workspaces"
            className="absolute left-0 top-full z-50 mt-1 w-60 rounded-xl border border-border bg-surface-raised p-1"
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
            }}
          >
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                type="button"
                role="menuitem"
                onClick={() => switchTo(workspace.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-small outline-none hover:bg-sidebar focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border-strong bg-paper text-label font-medium">
                  {workspace.icon ?? workspace.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                {workspace.id === activeWorkspaceId && (
                  <Icon name="check" className="size-4 shrink-0 text-text-secondary" />
                )}
              </button>
            ))}
            <div className="mt-1 border-t border-border pt-1">
              <WorkspaceComposer />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
