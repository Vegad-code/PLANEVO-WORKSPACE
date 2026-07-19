"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { deletePage, duplicatePageAsTemplate } from "@/app/(workspace)/pages/[pageId]/actions";
import { DeleteEntityControl } from "@/components/ui/delete-entity-control";
import { Icon } from "@/components/ui/planevo-icon";
import { useOutsidePointer } from "@/features/database/use-outside-pointer";
import { usePageTitleContext } from "@/features/editor/page-title";

function formatRelativeEditTime(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diffSeconds = Math.round((date.getTime() - now) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const divisions: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
    ["second", 1],
  ];

  for (const [unit, secondsInUnit] of divisions) {
    if (Math.abs(diffSeconds) >= secondsInUnit || unit === "second") {
      return formatter.format(Math.round(diffSeconds / secondsInUnit), unit);
    }
  }

  return formatter.format(0, "second");
}

function ScaffoldButton({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title="Coming soon"
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="sr-only">{label}</span>
      {children}
    </button>
  );
}

export function PageChrome({
  pageId,
  updatedAt,
}: {
  pageId: string;
  updatedAt: string;
}) {
  const { title, icon } = usePageTitleContext();
  const displayTitle = title.trim() || "Untitled";
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDuplicating, startDuplicate] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useOutsidePointer(menuRef, menuOpen, () => setMenuOpen(false));

  return (
    <div className="sticky top-0 z-20 flex h-11 shrink-0 items-center gap-3 border-b border-border bg-paper px-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          aria-hidden="true"
          className="flex size-6 shrink-0 items-center justify-center text-body leading-none"
        >
          {icon ? (
            icon
          ) : (
            <Icon name="page" className="size-4 text-text-muted" />
          )}
        </span>
        <span className="min-w-0 truncate text-small font-medium text-ink">
          {displayTitle}
        </span>
      </div>

      <div className="hidden items-center gap-3 sm:flex">
        <span className="rounded-full border border-border bg-surface-raised px-2 py-0.5 text-label text-text-muted">
          Private
        </span>
        <span className="text-label text-text-muted">
          Edited {formatRelativeEditTime(updatedAt)}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <ScaffoldButton label="Share">
          <Icon name="share" className="size-4" />
        </ScaffoldButton>
        <ScaffoldButton label="Star">
          <Icon name="star" className="size-4" />
        </ScaffoldButton>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-label="Page options"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
            className="flex size-8 items-center justify-center rounded-lg text-text-secondary outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <span aria-hidden="true" className="text-small leading-none tracking-widest">
              •••
            </span>
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-paper py-1 shadow-none"
            >
              <button
                type="button"
                role="menuitem"
                disabled={isDuplicating}
                onClick={() => {
                  startDuplicate(() => duplicatePageAsTemplate(pageId));
                  setMenuOpen(false);
                }}
                className="flex h-9 w-full items-center px-3 text-left text-small text-text-secondary hover:bg-surface-raised hover:text-ink disabled:opacity-50"
              >
                {isDuplicating ? "Duplicating…" : "Duplicate as template"}
              </button>
              <div className="my-1 border-t border-border px-3 py-2">
                <DeleteEntityControl
                  label="Delete page"
                  title={`Delete “${displayTitle}”?`}
                  description="This permanently removes the page and any linked file entry. Child pages are deleted too. This can't be undone."
                  confirmLabel="Delete page"
                  onConfirm={() => deletePage(pageId)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
