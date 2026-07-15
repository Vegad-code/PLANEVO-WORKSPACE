"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { deletePage } from "@/app/(workspace)/pages/[pageId]/actions";
import { HoverDeleteAction } from "@/components/ui/hover-delete-action";
import { Icon } from "@/components/ui/planevo-icon";
import { isNavItemActive } from "@planevo/core/state/navigation-state";

const depthClasses = ["", "pl-5", "pl-8"] as const;

function clampDepth(depth: number): 0 | 1 | 2 {
  if (depth <= 0) return 0;
  if (depth === 1) return 1;
  return 2;
}

export function PageNavItem({
  pageId,
  label,
  depth = 0,
  onNavigate,
}: {
  pageId: string;
  label: string;
  depth?: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const href = `/pages/${pageId}`;
  const active = isNavItemActive(pathname, href);
  const nestedDepth = clampDepth(depth);

  return (
    <HoverDeleteAction
      className="mx-2"
      label={`Delete ${label}`}
      title={`Delete “${label}”?`}
      description="This permanently removes the page and any linked file entry. Child pages are deleted too. This can't be undone."
      confirmLabel="Delete page"
      onConfirm={() => deletePage(pageId)}
    >
      <Link
        href={href}
        onNavigate={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`relative flex h-9 min-w-0 items-center gap-3 rounded-lg px-3 text-small font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${depthClasses[nestedDepth]} ${
          active
            ? "bg-surface-raised text-ink"
            : "text-text-secondary hover:bg-surface-raised hover:text-ink"
        }`}
      >
        {active && (
          <span className="absolute left-0 h-4 w-0.5 bg-marigold" aria-hidden="true" />
        )}
        <Icon name="page" className="size-4 shrink-0 text-current" />
        <span className="min-w-0 truncate">{label}</span>
      </Link>
    </HoverDeleteAction>
  );
}
