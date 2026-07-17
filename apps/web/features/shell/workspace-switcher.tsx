"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { signOut } from "@/app/(auth)/actions";
import {
  renameWorkspace,
  setCurrentWorkspace,
  updateWorkspaceIcon,
} from "@/app/(workspace)/actions";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import type { WorkspaceSummary } from "@/lib/queries/workspace-shell";
import { Icon } from "@/components/ui/planevo-icon";
import { WorkspaceCreateButton } from "@/features/shell/workspace-create-button";
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
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(workspaceName);
  const [displayName, setDisplayName] = useState(workspaceName);
  const [displayIcon, setDisplayIcon] = useState(workspaceInitial);
  const [managingWorkspace, setManagingWorkspace] = useState<WorkspaceSummary | null>(null);
  const [isPending, startTransition] = useTransition();
  const switchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayName(workspaceName);
    setDraftName(workspaceName);
    setDisplayIcon(workspaceInitial);
  }, [workspaceName, workspaceInitial]);

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

  function beginRename() {
    setDraftName(displayName);
    setEditingName(true);
    requestAnimationFrame(() => nameInputRef.current?.select());
  }

  function cancelRename() {
    setDraftName(displayName);
    setEditingName(false);
  }

  function commitRename() {
    const nextName = draftName.trim();
    if (!nextName || !activeWorkspaceId) {
      cancelRename();
      return;
    }
    if (nextName === displayName) {
      setEditingName(false);
      return;
    }

    startTransition(async () => {
      const result = await renameWorkspace({ workspaceId: activeWorkspaceId, name: nextName });
      if (result.success) {
        setDisplayName(nextName);
        setEditingName(false);
      } else {
        setDraftName(displayName);
        setEditingName(false);
      }
    });
  }

  function handleIconChange(icon: string | null) {
    if (!activeWorkspaceId) return;
    const nextIcon = icon ?? displayName.charAt(0).toUpperCase();
    setDisplayIcon(nextIcon);
    startTransition(async () => {
      const result = await updateWorkspaceIcon({ workspaceId: activeWorkspaceId, icon });
      if (!result.success) {
        setDisplayIcon(workspaceInitial);
      }
    });
  }

  const memberLabel = memberCount === 1 ? "1 member" : `${memberCount} members`;

  return (
    <div className="relative min-w-0 flex-1">
      <div
        className={`flex h-9 min-w-0 w-full items-center gap-1 rounded-lg px-1 outline-none transition-colors hover:bg-surface-raised focus-within:bg-surface-raised ${
          isPending ? "opacity-60" : ""
        }`}
      >
        <div className="shrink-0 [&_button]:size-7 [&_button]:text-body">
          <EmojiPicker
            value={displayIcon.length <= 2 ? displayIcon : null}
            onChange={handleIconChange}
            label="Workspace icon"
          />
        </div>
        {editingName ? (
          <input
            ref={nameInputRef}
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitRename();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancelRename();
              }
            }}
            aria-label="Workspace name"
            className="min-w-0 flex-1 truncate rounded-md bg-paper px-1 text-small font-medium outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          />
        ) : (
          <button
            type="button"
            onClick={beginRename}
            className="min-w-0 flex-1 truncate rounded-md px-1 text-left text-small font-medium outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {displayName}
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Switch workspace"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-muted outline-none hover:bg-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <Icon name="chevron-down" className="size-4" />
        </button>
      </div>

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
                {displayIcon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-small font-medium text-ink">{displayName}</p>
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
              <p className="truncate px-2 pb-1 pt-1 text-label text-text-muted">{userEmail}</p>
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
              <WorkspaceCreateButton onCreated={closeMenus} />
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
