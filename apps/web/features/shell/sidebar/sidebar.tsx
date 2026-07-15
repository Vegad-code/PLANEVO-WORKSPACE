"use client";

import { useEffect, useState, type CSSProperties, type FocusEventHandler, type MouseEventHandler, type Ref } from "react";
import type { WorkspaceShellData } from "@/lib/queries/workspace-shell";
import type { SidebarView } from "@planevo/core/state/sidebar-state";
import {
  DEFAULT_SIDEBAR_SECTION_STATE,
  normalizeSectionState,
  reduceSectionCollapse,
  serializeSectionState,
  type SidebarSectionId,
  type SidebarSectionState,
} from "@planevo/core/state/sidebar-section-state";
import { SidebarHeader } from "@/features/shell/sidebar/sidebar-header";
import { SidebarQuickActions } from "@/features/shell/sidebar/sidebar-quick-actions";
import {
  SidebarDestinationNav,
  SidebarHomeNav,
} from "@/features/shell/sidebar/sidebar-primary-nav";
import { SidebarSections } from "@/features/shell/sidebar/sidebar-sections";
import { SidebarFooter } from "@/features/shell/sidebar/sidebar-footer";
import { SidebarResizeHandle } from "@/features/shell/sidebar/sidebar-resize-handle";

const SECTION_STORAGE_KEY = "planevo.sidebar.sections";

export type SidebarProps = {
  shell: WorkspaceShellData;
  view: SidebarView;
  width?: number;
  preview?: boolean;
  onToggle?: () => void;
  onPin?: () => void;
  onWidthChange?: (width: number) => void;
  onMouseEnter?: MouseEventHandler<HTMLElement>;
  onMouseLeave?: MouseEventHandler<HTMLElement>;
  onFocusCapture?: FocusEventHandler<HTMLElement>;
  onBlurCapture?: FocusEventHandler<HTMLElement>;
  onNavigate?: () => void;
  onOpenSettings?: () => void;
  mobile?: boolean;
  headerButtonRef?: Ref<HTMLButtonElement>;
};

export function Sidebar({
  shell,
  view,
  width,
  preview = false,
  onToggle,
  onPin,
  onWidthChange,
  onMouseEnter,
  onMouseLeave,
  onFocusCapture,
  onBlurCapture,
  onNavigate,
  onOpenSettings,
  mobile = false,
  headerButtonRef,
}: SidebarProps) {
  const overlay = view === "peek";
  const hidden = view === "hidden";
  const showResize = view === "expanded" && !mobile && !preview && Boolean(onWidthChange);
  const [sectionState, setSectionState] = useState<SidebarSectionState>(
    DEFAULT_SIDEBAR_SECTION_STATE,
  );
  const [sectionsRestored, setSectionsRestored] = useState(false);

  useEffect(() => {
    if (preview) {
      setSectionsRestored(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setSectionState(normalizeSectionState(localStorage.getItem(SECTION_STORAGE_KEY)));
      setSectionsRestored(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [preview]);

  useEffect(() => {
    if (!preview && sectionsRestored) {
      localStorage.setItem(SECTION_STORAGE_KEY, serializeSectionState(sectionState));
    }
  }, [preview, sectionState, sectionsRestored]);

  function toggleSection(id: SidebarSectionId) {
    setSectionState((state) => reduceSectionCollapse(state, id));
  }

  if (hidden) return null;

  const placement = overlay
    ? preview
      ? "absolute inset-y-0 left-0"
      : "fixed inset-y-0 left-0"
    : "relative h-full";

  const widthStyle: CSSProperties | undefined =
    typeof width === "number"
      ? { width, ["--sidebar-width" as string]: `${width}px` }
      : undefined;

  return (
    <aside
      aria-label="Workspace sidebar"
      data-sidebar-view={view}
      data-testid="sidebar"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocusCapture={onFocusCapture}
      onBlurCapture={onBlurCapture}
      style={widthStyle}
      className={`${placement} z-40 flex flex-col overflow-hidden border-r border-border bg-sidebar transition-[width] duration-200 motion-reduce:transition-none ${
        widthStyle ? "" : "w-sidebar"
      }`}
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
        <SidebarHomeNav onNavigate={onNavigate} />
        <SidebarQuickActions onNavigate={onNavigate} />
        <SidebarDestinationNav onNavigate={onNavigate} />
        <div className="mt-3 min-h-0 flex-1">
          <SidebarSections
            pages={shell.pages}
            sectionState={sectionState}
            onToggleSection={toggleSection}
            onNavigate={onNavigate}
          />
        </div>
        <SidebarFooter onNavigate={onNavigate} />
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
