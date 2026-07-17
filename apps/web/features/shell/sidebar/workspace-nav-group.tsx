"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/planevo-icon";
import { isNavItemActive } from "@planevo/core/state/navigation-state";

type WorkspaceNavGroupProps = {
  expanded: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
};

export function WorkspaceNavGroup({
  expanded,
  onToggle,
  onNavigate,
}: WorkspaceNavGroupProps) {
  const pathname = usePathname();
  const href = "/workspace";
  const active = isNavItemActive(pathname, href);

  return (
    <div
      className={`relative mx-2 flex h-9 items-center gap-1 rounded-lg transition-colors motion-reduce:transition-none ${
        active
          ? "bg-surface-raised text-ink"
          : "text-text-secondary hover:bg-surface-raised hover:text-ink"
      }`}
    >
      {active && (
        <span className="absolute left-0 h-4 w-0.5 bg-marigold" aria-hidden="true" />
      )}
      <Link
        href={href}
        onNavigate={onNavigate}
        aria-current={active ? "page" : undefined}
        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-small font-medium outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Icon name="canvas" className="size-4 shrink-0 text-current" />
        <span className="min-w-0 truncate">Workspace</span>
      </Link>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="workspace-page-tree"
        aria-label={expanded ? "Collapse page tree" : "Expand page tree"}
        onClick={onToggle}
        className="mr-1 flex size-8 shrink-0 items-center justify-center rounded-lg outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <Icon
          name="chevron-down"
          className={`size-3.5 text-text-muted transition-transform motion-reduce:transition-none ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>
    </div>
  );
}
