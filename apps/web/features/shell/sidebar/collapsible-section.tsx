"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/ui/planevo-icon";

type CollapsibleSectionProps = {
  id: string;
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
  empty?: ReactNode;
};

export function CollapsibleSection({
  id,
  title,
  collapsed,
  onToggle,
  children,
  empty,
}: CollapsibleSectionProps) {
  const contentId = `sidebar-section-${id}`;

  return (
    <div data-testid={`sidebar-section-${id}`} className="mt-4 first:mt-0">
      <button
        type="button"
        aria-expanded={!collapsed}
        aria-controls={contentId}
        onClick={onToggle}
        className="flex h-7 w-full items-center gap-1 px-3 text-left outline-none hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Icon
          name="chevron-down"
          className={`size-3.5 shrink-0 text-text-muted transition-transform motion-reduce:transition-none ${
            collapsed ? "-rotate-90" : ""
          }`}
        />
        <span className="text-label uppercase text-text-muted">{title}</span>
      </button>
      {!collapsed && (
        <div id={contentId} className="pt-1">
          {children}
          {empty}
        </div>
      )}
    </div>
  );
}
