"use client";

import type { MouseEventHandler } from "react";
import { Icon } from "@/components/ui/planevo-icon";
import { SIDEBAR_PEEK_EDGE_WIDTH_PX } from "@planevo/core/state/sidebar-state";

type SidebarPeekTriggerProps = {
  showRevealButton: boolean;
  onOpenPeek: () => void;
  onSchedulePeek: MouseEventHandler<HTMLElement>;
  onScheduleDismissPeek: MouseEventHandler<HTMLElement>;
};

/**
 * Left-edge hover zone (below TopBar) + floating menu when the sidebar is hidden.
 * Edge hover uses a delayed peek; the menu button is click-only so it does not
 * compete with the edge zone (Notion separates bar control from edge hover).
 */
export function SidebarPeekTrigger({
  showRevealButton,
  onOpenPeek,
  onSchedulePeek,
  onScheduleDismissPeek,
}: SidebarPeekTriggerProps) {
  return (
    <>
      <div
        data-testid="sidebar-edge-trigger"
        role="presentation"
        aria-hidden="true"
        style={{ width: SIDEBAR_PEEK_EDGE_WIDTH_PX }}
        onMouseEnter={onSchedulePeek}
        onMouseLeave={onScheduleDismissPeek}
        className="fixed top-14 bottom-0 left-0 z-50 hidden bg-transparent md:block"
      />

      {showRevealButton && (
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
    </>
  );
}
