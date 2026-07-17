"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { deletePage } from "@/app/(workspace)/pages/[pageId]/actions";
import { HoverDeleteAction } from "@/components/ui/hover-delete-action";
import { Icon } from "@/components/ui/planevo-icon";
import { isNavItemActive } from "@planevo/core/state/navigation-state";

function clampDepth(depth: number): 0 | 1 | 2 {
  if (depth <= 0) return 0;
  if (depth === 1) return 1;
  return 2;
}

export function TreeNavItem({
  pageId,
  label,
  depth = 0,
  continueSpine = false,
  onNavigate,
}: {
  pageId: string;
  label: string;
  depth?: number;
  /** When true, the vertical spine continues past this row (a following sibling exists). */
  continueSpine?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const href = `/pages/${pageId}`;
  const active = isNavItemActive(pathname, href);
  const nestedDepth = clampDepth(depth);
  const showBranch = nestedDepth > 0;
  const gutterLeft = nestedDepth === 1 ? "left-5" : "left-8";

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
        className={`relative flex h-9 min-w-0 items-center gap-3 rounded-lg px-3 text-small font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
          active
            ? "bg-surface-raised text-ink"
            : "text-text-secondary hover:bg-surface-raised hover:text-ink"
        }`}
      >
        {active && (
          <span className="absolute left-0 h-4 w-0.5 bg-marigold" aria-hidden="true" />
        )}
        {showBranch && (
          <span
            className={`pointer-events-none absolute inset-y-0 ${gutterLeft} flex w-4`}
            aria-hidden="true"
          >
            <span
              className={`absolute left-0 w-px bg-border ${
                continueSpine ? "inset-y-0" : "top-0 h-1/2"
              }`}
            />
            <span className="absolute top-1/2 left-0 h-px w-3 bg-border" />
          </span>
        )}
        <span
          className={`flex min-w-0 flex-1 items-center gap-3 ${
            nestedDepth === 0 ? "" : nestedDepth === 1 ? "pl-5" : "pl-8"
          }`}
        >
          <Icon name="page" className="size-4 shrink-0 text-current" />
          <span className="min-w-0 truncate">{label}</span>
        </span>
      </Link>
    </HoverDeleteAction>
  );
}
