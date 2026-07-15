import type { FocusEventHandler, MouseEventHandler } from "react";
import type { WorkspaceShellData } from "@/lib/queries/workspace-shell";
import { Icon } from "./planevo-icon";
import { NavItem } from "./nav-item";
import type { SidebarView } from "./sidebar-state";

type SidebarProps = {
  shell: WorkspaceShellData;
  view: SidebarView;
  preview?: boolean;
  onToggle?: () => void;
  onPin?: () => void;
  onMouseEnter?: MouseEventHandler<HTMLElement>;
  onMouseLeave?: MouseEventHandler<HTMLElement>;
  onFocusCapture?: FocusEventHandler<HTMLElement>;
  onBlurCapture?: FocusEventHandler<HTMLElement>;
};

const primaryItems = [
  { label: "Workspace", icon: "workspace", active: true },
  { label: "Tasks", icon: "tasks" },
  { label: "Calendar", icon: "calendar" },
  { label: "Files", icon: "files" },
] as const;


export function Sidebar({
  shell,
  view,
  preview = false,
  onToggle,
  onPin,
  onMouseEnter,
  onMouseLeave,
  onFocusCapture,
  onBlurCapture,
}: SidebarProps) {
  const compact = view === "rail";
  const overlay = view === "peek";
  const workspaceName = shell.workspace?.name ?? "Anthony's workspace";
  const workspaceInitial = shell.workspace?.icon ?? workspaceName.charAt(0).toUpperCase();
  const pageItems = shell.pages;
  const accountName = shell.userDisplayName ?? "Anthony";
  const accountInitials = shell.userInitials ?? "AP";
  const placement = overlay
    ? preview
      ? "absolute inset-y-0 left-0"
      : "fixed inset-y-0 left-0"
    : "relative h-full";

  return (
    <aside
      aria-label="Workspace sidebar"
      data-sidebar-view={view}
      data-testid="sidebar"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
      className={`${placement} z-40 flex flex-col overflow-hidden border-r border-border bg-sidebar transition-all duration-200 motion-reduce:transition-none ${
        compact ? "w-rail" : "w-sidebar"
      }`}
    >
      <div className={`flex h-14 shrink-0 items-center border-b border-border ${compact ? "justify-center" : "gap-2 px-2"}`}>
        <button
          type="button"
          aria-label="Switch workspace"
          title={compact ? workspaceName : undefined}
          className={`flex min-w-0 items-center rounded-lg outline-none transition-colors hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
            compact ? "size-9 justify-center" : "h-9 flex-1 gap-2 px-2"
          }`}
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

        {!compact && (
          <button
            type="button"
            onClick={overlay ? onPin : onToggle}
            aria-label={overlay ? "Pin sidebar open" : "Collapse sidebar"}
            title={overlay ? "Pin sidebar open" : "Collapse sidebar (⌘\\)"}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted outline-none transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
          >
            <Icon name={overlay ? "pin" : "panel-close"} />
          </button>
        )}
      </div>

      {compact && (
        <button
          type="button"
          onClick={onToggle}
          aria-label="Expand sidebar"
          title="Expand sidebar (⌘\\)"
          className="mx-auto mt-2 flex size-9 shrink-0 items-center justify-center rounded-lg text-text-muted outline-none transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
        >
          <Icon name="panel-open" />
        </button>
      )}

      <div className="flex min-h-0 flex-1 flex-col py-2">
        <nav aria-label="Workspace navigation" className="shrink-0 space-y-0.5">
          {primaryItems.map((item) => (
            <NavItem key={item.label} {...item} compact={compact} />
          ))}
        </nav>

        {!compact && (
          <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
            <p className="px-5 text-label uppercase text-text-muted">Pages</p>
            <nav aria-label="Pages" className="mt-2 space-y-0.5">
              {pageItems.map((page) => (
                <NavItem
                  key={page.id}
                  label={page.label}
                  icon="page"
                  depth={page.depth}
                />
              ))}
            </nav>
          </div>
        )}

        {compact && <div className="min-h-4 flex-1" aria-hidden="true" />}

        <div className="mt-auto shrink-0 border-t border-border pt-2">
          {!compact && <p className="px-5 pb-1 text-label uppercase text-text-muted">AI</p>}
          <nav aria-label="AI navigation" className="space-y-0.5">
            <NavItem label="Planevo AI" icon="ai" variant="ai" compact={compact} />
            <NavItem label="Agents" icon="agents" compact={compact} />
          </nav>
        </div>
      </div>

      <div className="min-h-12 shrink-0" aria-hidden="true" />

      <div className="shrink-0 border-t border-border p-2">
        <button
          type="button"
          aria-label={compact ? "Open account and settings" : undefined}
          title={compact ? "Account and settings" : undefined}
          className={`flex h-10 w-full items-center rounded-lg text-small outline-none transition-colors hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
            compact ? "justify-center" : "gap-3 px-2"
          }`}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-raised text-label font-medium">
            {accountInitials}
          </span>
          {!compact && (
            <>
              <span className="min-w-0 flex-1 truncate text-left">{accountName}</span>
              <Icon name="settings" className="size-4 shrink-0 text-text-muted" />
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
