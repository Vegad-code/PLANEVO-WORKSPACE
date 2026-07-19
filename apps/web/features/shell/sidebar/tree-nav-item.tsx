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

const GUTTER_LEFT = ["left-5", "left-9", "left-12"] as const;

/**
 * Page row under Workspace with Acme-style tree connectors.
 * `depth` is the page hierarchy depth (0 = direct child of Workspace).
 * Every row draws an L-branch; nested rows keep ancestor spines.
 */
export function TreeNavItem({
  pageId,
  label,
  depth = 0,
  continueSpine = false,
  ancestorSpines = [],
  onNavigate,
}: {
  pageId: string;
  label: string;
  depth?: number;
  /** When true, the vertical spine continues past this row at this depth. */
  continueSpine?: boolean;
  /** Full-height spines for ancestor depths (index = depth). */
  ancestorSpines?: boolean[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const href = `/pages/${pageId}`;
  const active = isNavItemActive(pathname, href);
  const nestedDepth = clampDepth(depth);
  const gutterClass = GUTTER_LEFT[nestedDepth];
  const contentPad =
    nestedDepth === 0 ? "pl-8" : nestedDepth === 1 ? "pl-12" : "pl-14";

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
        className={`relative flex h-9 min-w-0 items-center gap-3 rounded-lg pr-3 text-small font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${contentPad} ${
          active
            ? "bg-surface-raised text-ink"
            : "text-text-secondary hover:bg-surface-raised hover:text-ink"
        }`}
      >
        {/* Ancestor vertical spines */}
        {ancestorSpines.map((continues, ancestorDepth) => {
          if (ancestorDepth >= nestedDepth) return null;
          const left = GUTTER_LEFT[clampDepth(ancestorDepth)];
          return (
            <span
              key={ancestorDepth}
              className={`pointer-events-none absolute inset-y-0 ${left} w-4`}
              aria-hidden="true"
            >
              <span
                className={`absolute left-0 border-l border-border ${
                  continues ? "inset-y-0" : "top-0 h-1/2"
                }`}
              />
            </span>
          );
        })}

        {/* Own L-elbow into this row */}
        <span
          className={`pointer-events-none absolute inset-y-0 ${gutterClass} w-4`}
          aria-hidden="true"
        >
          <span className="absolute top-0 left-0 h-1/2 w-3.5 rounded-bl-lg border-b border-l border-border" />
          {continueSpine && (
            <span className="absolute top-1/2 bottom-0 left-0 border-l border-border" />
          )}
        </span>

        <Icon name="page" className="relative size-4 shrink-0 text-text-secondary" />
        <span className="relative min-w-0 truncate">{label}</span>
      </Link>
    </HoverDeleteAction>
  );
}
