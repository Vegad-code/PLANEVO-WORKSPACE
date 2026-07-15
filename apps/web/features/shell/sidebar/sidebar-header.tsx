"use client";

import type { Ref } from "react";
import type { WorkspaceShellData } from "@/lib/queries/workspace-shell";
import { Icon } from "@/components/ui/planevo-icon";
import { WorkspaceSwitcher } from "@/features/shell/workspace-switcher";

type SidebarHeaderProps = {
  shell: WorkspaceShellData;
  overlay: boolean;
  mobile?: boolean;
  onToggle?: () => void;
  onPin?: () => void;
  onOpenSettings?: () => void;
  headerButtonRef?: Ref<HTMLButtonElement>;
};

export function SidebarHeader({
  shell,
  overlay,
  mobile = false,
  onToggle,
  onPin,
  onOpenSettings,
  headerButtonRef,
}: SidebarHeaderProps) {
  const workspaceName = shell.workspace?.name ?? "Planevo";
  const workspaceInitial =
    shell.workspace?.icon ?? workspaceName.charAt(0).toUpperCase();

  return (
    <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-2">
      <WorkspaceSwitcher
        workspaces={shell.workspaces}
        activeWorkspaceId={shell.workspace?.id ?? null}
        workspaceName={workspaceName}
        workspaceInitial={workspaceInitial}
        userEmail={shell.userEmail}
        memberCount={shell.memberCount}
        onOpenSettings={onOpenSettings}
      />
      <button
        ref={headerButtonRef}
        type="button"
        onClick={overlay ? onPin : onToggle}
        aria-label={
          mobile
            ? "Close navigation"
            : overlay
              ? "Lock sidebar open"
              : "Collapse sidebar"
        }
        title={
          mobile
            ? undefined
            : overlay
              ? "Lock sidebar open"
              : "Collapse sidebar (⌘\\)"
        }
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted outline-none transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
      >
        <Icon name={mobile ? "close" : overlay ? "pin" : "panel-close"} />
      </button>
    </div>
  );
}
