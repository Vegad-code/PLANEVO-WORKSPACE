"use client";

import type { MouseEventHandler, Ref } from "react";
import { Icon } from "@/components/ui/planevo-icon";
import { SIDEBAR_PEEK_EDGE_WIDTH_PX } from "@planevo/core/state/sidebar-state";

type SidebarPeekTriggerProps = {
  showEdgeTrigger: boolean;
  showRevealButton: boolean;
  onOpenPeek: () => void;
  onSchedulePeek: MouseEventHandler<HTMLElement>;
  onScheduleDismissPeek: MouseEventHandler<HTMLElement>;
  /** Mobile: opens the navigation drawer (replaces removed TopBar hamburger). */
  onOpenNavigation?: () => void;
  navigationOpen?: boolean;
  menuButtonRef?: Ref<HTMLButtonElement>;
};

/**
 * Left-edge hover zone + floating menu when the sidebar is hidden.
 * Edge hover uses a delayed peek; the menu button is click-only so it does not
 * compete with the edge zone (Notion separates bar control from edge hover).
 * On mobile, the floating control opens the navigation drawer.
 */
export function SidebarPeekTrigger({
  showEdgeTrigger,
  showRevealButton,
  onOpenPeek,
  onSchedulePeek,
  onScheduleDismissPeek,
  onOpenNavigation,
  navigationOpen = false,
  menuButtonRef,
}: SidebarPeekTriggerProps) {
  return (
    <>
      {showEdgeTrigger && (
        <div
          data-testid="sidebar-edge-trigger"
          role="presentation"
          aria-hidden="true"
          style={{ width: SIDEBAR_PEEK_EDGE_WIDTH_PX }}
          onMouseEnter={onSchedulePeek}
          onMouseLeave={onScheduleDismissPeek}
          className="fixed inset-y-0 left-0 z-50 hidden bg-transparent md:block"
        />
      )}

      {showEdgeTrigger && showRevealButton && (
        <button
          type="button"
          data-testid="sidebar-reveal-button"
          aria-label="Open sidebar"
          title="Open sidebar (⌘\\)"
          onClick={onOpenPeek}
          className="fixed top-3 left-3 z-50 hidden size-8 items-center justify-center rounded-lg border border-border bg-surface-raised text-text-secondary outline-none transition-colors hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none md:flex"
        >
          <Icon name="menu" className="size-4" />
        </button>
      )}

      {onOpenNavigation && (
        <button
          ref={menuButtonRef}
          type="button"
          data-testid="mobile-nav-trigger"
          aria-label="Open navigation"
          aria-expanded={navigationOpen}
          onClick={onOpenNavigation}
          className="fixed top-3 left-3 z-50 flex size-8 items-center justify-center rounded-lg border border-border bg-surface-raised text-text-secondary outline-none transition-colors hover:bg-paper hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none md:hidden"
        >
          <Icon name="menu" className="size-4" />
        </button>
      )}
    </>
  );
}
