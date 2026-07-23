"use client";

import { useEffect, useState, type CSSProperties, type FocusEventHandler, type MouseEventHandler, type Ref } from "react";
import type { WorkspaceShellData } from "@/lib/queries/workspace-shell";
import type { SidebarView } from "@planevo/core/state/sidebar-state";
import {
  SIDEBAR_PEEK_BOTTOM_GAP_PX,
  SIDEBAR_PEEK_LEFT_OFFSET_PX,
  SIDEBAR_PEEK_TOP_OFFSET_PX,
} from "@planevo/core/state/sidebar-state";
import {
  DEFAULT_WORKSPACE_TREE_PREFERENCE,
  LEGACY_SECTIONS_STORAGE_KEY,
  WORKSPACE_TREE_STORAGE_KEY,
  normalizeWorkspaceTreePreference,
  reduceWorkspaceTreeCollapse,
  serializeWorkspaceTreePreference,
  type WorkspaceTreePreference,
} from "@planevo/core/state/sidebar-section-state";
import { SidebarHeader } from "@/features/shell/sidebar/sidebar-header";
import { SidebarNewButton } from "@/features/shell/sidebar/sidebar-new-button";
import { SidebarPrimaryNav } from "@/features/shell/sidebar/sidebar-primary-nav";
import { WorkspaceTreeSection } from "@/features/shell/sidebar/workspace-tree-section";
import { SidebarFooter } from "@/features/shell/sidebar/sidebar-footer";
import { SidebarResizeHandle } from "@/features/shell/sidebar/sidebar-resize-handle";

export type SidebarProps = {
  shell: WorkspaceShellData;
  view: SidebarView;
  width?: number;
  preview?: boolean;
  peekExiting?: boolean;
  onToggle?: () => void;
  onPin?: () => void;
  onWidthChange?: (width: number) => void;
  onMouseEnter?: MouseEventHandler<HTMLElement>;
  onMouseLeave?: MouseEventHandler<HTMLElement>;
  onFocusCapture?: FocusEventHandler<HTMLElement>;
  onBlurCapture?: FocusEventHandler<HTMLElement>;
  onNavigate?: () => void;
  onOpenSettings?: () => void;
  onOpenSpotlight?: () => void;
  mobile?: boolean;
  headerButtonRef?: Ref<HTMLButtonElement>;
};

export function Sidebar({
  shell,
  view,
  width,
  preview = false,
  peekExiting = false,
  onToggle,
  onPin,
  onWidthChange,
  onMouseEnter,
  onMouseLeave,
  onFocusCapture,
  onBlurCapture,
  onNavigate,
  onOpenSettings,
  onOpenSpotlight,
  mobile = false,
  headerButtonRef,
}: SidebarProps) {
  const overlay = view === "peek";
  const hidden = view === "hidden";
  const showResize = view === "expanded" && !mobile && !preview && Boolean(onWidthChange);
  const [treePreference, setTreePreference] = useState<WorkspaceTreePreference>(
    DEFAULT_WORKSPACE_TREE_PREFERENCE,
  );
  const [treeRestored, setTreeRestored] = useState(preview);

  useEffect(() => {
    if (preview) return;
    const timer = window.setTimeout(() => {
      setTreePreference(
        normalizeWorkspaceTreePreference(
          localStorage.getItem(WORKSPACE_TREE_STORAGE_KEY),
          localStorage.getItem(LEGACY_SECTIONS_STORAGE_KEY),
        ),
      );
      setTreeRestored(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [preview]);

  useEffect(() => {
    if (!preview && treeRestored) {
      localStorage.setItem(
        WORKSPACE_TREE_STORAGE_KEY,
        serializeWorkspaceTreePreference(treePreference),
      );
    }
  }, [preview, treePreference, treeRestored]);

  function toggleTree() {
    setTreePreference((preference) => reduceWorkspaceTreeCollapse(preference));
  }

  if (hidden) return null;

  const widthStyle: CSSProperties | undefined =
    typeof width === "number"
      ? { width, ["--sidebar-width" as string]: `${width}px` }
      : undefined;

  const placement = overlay
    ? preview
      ? "absolute left-0"
      : "fixed left-0"
    : "relative h-full";

  const peekInsetStyle: CSSProperties | undefined = overlay
    ? {
        top: SIDEBAR_PEEK_TOP_OFFSET_PX,
        bottom: SIDEBAR_PEEK_BOTTOM_GAP_PX,
        left: SIDEBAR_PEEK_LEFT_OFFSET_PX,
        height: `calc(100dvh - ${SIDEBAR_PEEK_TOP_OFFSET_PX + SIDEBAR_PEEK_BOTTOM_GAP_PX}px)`,
        ...widthStyle,
      }
    : widthStyle;

  return (
    <aside
      aria-label="Workspace sidebar"
      data-sidebar-view={view}
      data-sidebar-peek-exit={peekExiting ? "true" : undefined}
      data-testid="sidebar"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
      style={{
        ...peekInsetStyle,
        ...(overlay
          ? undefined
          : { transitionDuration: "var(--sidebar-motion-duration-enter)" }),
      }}
      className={`${placement} z-40 box-border flex flex-col overflow-hidden bg-sidebar motion-reduce:transition-none ${
        overlay
          ? "rounded-xl border border-border"
          : "border-r border-border transition-[width] ease-out"
      } ${peekInsetStyle ? "" : "w-sidebar"}`}
    >
      <SidebarHeader
        shell={shell}
        overlay={overlay}
        mobile={mobile}
        onToggle={onToggle}
        onPin={onPin}
        onOpenSettings={onOpenSettings}
        headerButtonRef={headerButtonRef}
      />

      <div className="flex min-h-0 flex-1 flex-col py-2">
        <SidebarNewButton onNavigate={onNavigate} />
        <SidebarPrimaryNav onNavigate={onNavigate} onOpenSpotlight={onOpenSpotlight} />
        <div className="mt-3 min-h-0 flex-1">
          <WorkspaceTreeSection
            pages={shell.pages}
            expanded={treePreference === "expanded"}
            onToggle={toggleTree}
            onNavigate={onNavigate}
            dndId={
              mobile
                ? "workspace-page-tree-mobile"
                : preview
                  ? "workspace-page-tree-preview"
                  : overlay
                    ? "workspace-page-tree-peek"
                    : "workspace-page-tree"
            }
          />
        </div>
        <SidebarFooter
          userDisplayName={shell.userDisplayName}
          userInitials={shell.userInitials}
          onOpenSettings={onOpenSettings}
        />
      </div>

      {showResize && onWidthChange && (
        <SidebarResizeHandle
          width={width ?? 210}
          onWidthChange={onWidthChange}
          onCollapse={() => onToggle?.()}
        />
      )}
    </aside>
  );
}
