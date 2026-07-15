import type { FocusEventHandler, MouseEventHandler, Ref } from "react";
import type { WorkspaceShellData } from "@/lib/queries/workspace-shell";
import { Icon } from "@/components/ui/planevo-icon";
import { NavItem } from "@/features/shell/nav-item";
import type { SidebarView } from "@planevo/core/state/sidebar-state";
import { WorkspaceSwitcher } from "@/features/shell/workspace-switcher";

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
  onNavigate?: () => void;
  onOpenSettings?: () => void;
  mobile?: boolean;
  headerButtonRef?: Ref<HTMLButtonElement>;
};

const primaryItems = [
  { label: "Home", icon: "workspace", href: "/" },
  { label: "Tasks", icon: "tasks", href: "/tasks" },
  { label: "Calendar", icon: "calendar", href: "/calendar" },
  { label: "Files", icon: "files", href: "/files" },
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
  onNavigate,
  onOpenSettings,
  mobile = false,
  headerButtonRef,
}: SidebarProps) {
  const compact = view === "rail";
  const overlay = view === "peek";
  const workspaceName = shell.workspace?.name ?? "Planevo";
  const workspaceInitial =
    shell.workspace?.icon ?? workspaceName.charAt(0).toUpperCase();
  const pageItems = shell.pages;
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
        <WorkspaceSwitcher
          workspaces={shell.workspaces}
          activeWorkspaceId={shell.workspace?.id ?? null}
          compact={compact}
          workspaceName={workspaceName}
          workspaceInitial={workspaceInitial}
        />

        {!compact && (
          <button
            ref={headerButtonRef}
            type="button"
            onClick={overlay ? onPin : onToggle}
            aria-label={mobile ? "Close navigation" : overlay ? "Pin sidebar open" : "Collapse sidebar"}
            title={mobile ? undefined : overlay ? "Pin sidebar open" : "Collapse sidebar (⌘\\)"}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted outline-none transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
          >
            <Icon name={mobile ? "close" : overlay ? "pin" : "panel-close"} />
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
            <NavItem key={item.label} {...item} compact={compact} onNavigate={onNavigate} />
          ))}
        </nav>

        {!compact && (
          <div className="mt-5 min-h-0 flex-1 overflow-y-auto">
            <p className="px-5 text-label uppercase text-text-muted">Pinned</p>
            <p className="px-5 pt-2 text-small text-text-muted">
              Pin a page to keep it close.
            </p>
            <p className="mt-5 px-5 text-label uppercase text-text-muted">Pages</p>
            <nav aria-label="Pages" className="mt-2 space-y-0.5">
              {pageItems.map((page) => (
                <NavItem
                  key={page.id}
                  href={`/pages/${page.id}`}
                  label={page.label}
                  icon="page"
                  depth={page.depth}
                  onNavigate={onNavigate}
                />
              ))}
              {pageItems.length === 0 && (
                <p className="px-5 py-2 text-small text-text-muted">
                  Your pages will appear here.
                </p>
              )}
            </nav>
          </div>
        )}

        {compact && <div className="min-h-4 flex-1" aria-hidden="true" />}

        <div className="mt-auto shrink-0 border-t border-border pt-2">
          {!compact && <p className="px-5 pb-1 text-label uppercase text-text-muted">AI</p>}
          <nav aria-label="AI navigation" className="space-y-0.5">
            <NavItem href="/ai" label="Planevo AI" icon="ai" variant="ai" compact={compact} onNavigate={onNavigate} />
            <NavItem href="/agents" label="Agents" icon="agents" compact={compact} onNavigate={onNavigate} />
          </nav>
        </div>
      </div>

      <div className="min-h-12 shrink-0" aria-hidden="true" />

      <div className="shrink-0 border-t border-border p-2">
        <NavItem
          icon="settings"
          label="Settings"
          compact={compact}
          onClick={onOpenSettings}
        />
      </div>
    </aside>
  );
}
