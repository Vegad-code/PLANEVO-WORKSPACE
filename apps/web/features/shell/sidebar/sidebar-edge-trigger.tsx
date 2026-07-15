"use client";

import type { MouseEventHandler } from "react";

type SidebarEdgeTriggerProps = {
  onMouseEnter?: MouseEventHandler<HTMLDivElement>;
  onMouseLeave?: MouseEventHandler<HTMLDivElement>;
  onFocus?: () => void;
};

export function SidebarEdgeTrigger({
  onMouseEnter,
  onMouseLeave,
  onFocus,
}: SidebarEdgeTriggerProps) {
  return (
    <div
      data-testid="sidebar-edge-trigger"
      role="presentation"
      tabIndex={-1}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      className="fixed inset-y-0 left-0 z-30 hidden w-3 md:block"
      aria-hidden="true"
    />
  );
}
