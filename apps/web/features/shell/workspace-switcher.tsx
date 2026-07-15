"use client";

import { useRef, useState, useTransition } from "react";
import { signOut } from "@/app/(auth)/actions";
import { setCurrentWorkspace } from "@/app/(workspace)/actions";
import type { WorkspaceSummary } from "@/lib/queries/workspace-shell";
import { Icon } from "@/components/ui/planevo-icon";
import { WorkspaceComposer } from "@/features/home/workspace-composer";
import { WorkspaceManagePopover } from "@/features/shell/workspace-manage-popover";

const SWITCH_DELAY_MS = 250;

type WorkspaceSwitcherProps = {
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string | null;
  workspaceName: string;
  workspaceInitial: string;
  userEmail?: string | null;
  memberCount?: number;
  planLabel?: string;
  onOpenSettings?: () => void;
};

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  workspaceName,
  workspaceInitial,
  userEmail = null,
  memberCount = 1,
  planLabel = "Free plan",
  onOpenSettings,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [managingWorkspace, setManagingWorkspace] = useState<WorkspaceSummary | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const switchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function switchTo(workspaceId: string) {
    setOpen(false);
    setManagingWorkspace(null);
    if (workspaceId === activeWorkspaceId) return;
    startTransition(() => setCurrentWorkspace(workspaceId));
  }

  function scheduleSwitch(workspaceId: string) {
    if (switchTimer.current) clearTimeout(switchTimer.current);
    switchTimer.current = setTimeout(() => {
      switchTo(workspaceId);
      switchTimer.current = null;
    }, SWITCH_DELAY_MS);
  }

  function openManage(workspace: WorkspaceSummary) {
    if (switchTimer.current) {
      clearTimeout(switchTimer.current);
      switchTimer.current = null;
    }
    setManagingWorkspace(workspace);
  }

  function closeMenus() {
    setOpen(false);
    setManagingWorkspace(null);
  }

  const memberLabel = memberCount === 1 ? "1 member" : `${memberCount} members`;

  return (
    <div className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Switch workspace"
        className={`flex h-9 min-w-0 w-full items-center gap-2 rounded-lg px-2 outline-none transition-colors hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
          isPending ? "opacity-60" : ""
        }`}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-surface-raised text-label font-medium text-ink">
          {workspaceInitial}
        </span>
        <span className="min-w-0 flex-1 truncate text-left text-small font-medium">
          {workspaceName}
        </span>
        <Icon name="chevron-down" className="size-4 shrink-0 text-text-muted" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close workspace menu"
            onClick={closeMenus}
            className="fixed inset-0 z-40 cursor-default"
            tabIndex={-1}
          />
          <div
            role="menu"
            aria-label="Workspace menu"
            className="absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-border bg-surface-raised p-1"
            onKeyDown={(event) => {
              if (event.key === "Escape") closeMenus();
            }}
          >
            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-paper text-small font-medium text-ink">
                {workspaceInitial}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-small font-medium text-ink">{workspaceName}</p>
                <p className="truncate text-label text-text-muted">
                  {planLabel} · {memberLabel}
                </p>
              </div>
            </div>

            <div className="my-1 border-t border-border" />

            <button
              type="button"
              role="menuitem"
              title="Upgrade — coming soon"
              disabled
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-small text-text-muted opacity-60"
            >
              <Icon name="upgrade" className="size-4 shrink-0" />
              Upgrade
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenus();
                onOpenSettings?.();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-small outline-none hover:bg-sidebar focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <Icon name="settings" className="size-4 shrink-0 text-text-secondary" />
              Settings
            </button>
            <button
              type="button"
              role="menuitem"
              title="Invite members — coming soon"
              disabled
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-small text-text-muted opacity-60"
            >
              <Icon name="invite" className="size-4 shrink-0" />
              Invite members
            </button>

            <div className="my-1 border-t border-border" />

            {userEmail && (
              <p className="truncate px-2 pb-1 pt-1 text-label text-text-muted">
                {userEmail}
              </p>
            )}

            {workspaces.map((workspace) => (
              <div key={workspace.id} className="relative">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => scheduleSwitch(workspace.id)}
                  onDoubleClick={(event) => {
                    event.preventDefault();
                    openManage(workspace);
                  }}
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
                {managingWorkspace?.id === workspace.id && (
                  <WorkspaceManagePopover
                    workspace={workspace}
                    onClose={() => setManagingWorkspace(null)}
                  />
                )}
              </div>
            ))}

            <div className="mt-1 border-t border-border pt-1">
              <WorkspaceComposer />
              <p className="px-2 pb-1 pt-2 text-label text-text-muted">
                Double-click a workspace to rename or delete.
              </p>
            </div>

            <div className="my-1 border-t border-border" />

            <form action={signOut}>
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-small outline-none hover:bg-sidebar focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <Icon name="logout" className="size-4 shrink-0 text-text-secondary" />
                Log out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
