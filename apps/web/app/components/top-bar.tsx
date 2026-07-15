"use client";

import type { Ref } from "react";
import { Icon } from "./planevo-icon";
import { getTopBarAccountPresentation } from "./top-bar-state";

export function TopBar({
  breadcrumb = ["Home"],
  userDisplayName = null,
  userInitials = null,
  menuButtonRef,
  onOpenNavigation,
  navigationOpen = false,
}: {
  breadcrumb?: string[];
  userDisplayName?: string | null;
  userInitials?: string | null;
  menuButtonRef?: Ref<HTMLButtonElement>;
  onOpenNavigation?: () => void;
  navigationOpen?: boolean;
}) {
  const account = getTopBarAccountPresentation({
    userDisplayName,
    userInitials,
  });

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-paper px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <button
          ref={menuButtonRef}
          type="button"
          aria-label="Open navigation"
          aria-expanded={navigationOpen}
          onClick={onOpenNavigation}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-secondary outline-none transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none md:hidden"
        >
          <Icon name="menu" />
        </button>
        <nav aria-label="Breadcrumb" className="min-w-0">
          <ol className="flex min-w-0 items-center gap-2 text-small text-text-muted">
            {breadcrumb.map((item, index) => (
              <li key={item} className="flex min-w-0 items-center gap-2">
                {index > 0 && <span aria-hidden="true">/</span>}
                <span className={index === breadcrumb.length - 1 ? "truncate text-ink" : "truncate"}>
                  {item}
                </span>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      <div className="ml-4 flex shrink-0 items-center gap-3">
        <button
          type="button"
          aria-label="Search Planevo"
          aria-keyshortcuts="Meta+K Control+K"
          className="group flex h-8 items-center gap-0 rounded-full border border-border bg-surface-raised px-2 text-small text-ink outline-none transition-all hover:gap-2 hover:border-border-strong focus-visible:gap-2 focus-visible:border-border-strong focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
        >
          <Icon name="search" className="size-4 text-text-secondary" />
          <span className="w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all group-hover:w-28 group-hover:opacity-100 group-focus-visible:w-28 group-focus-visible:opacity-100 motion-reduce:transition-none">
            Search Planevo
          </span>
        </button>
        <button
          type="button"
          aria-label={
            account.kind === "identity"
              ? `Open account menu for ${account.name}`
              : "Open settings"
          }
          className="flex size-8 items-center justify-center rounded-full border border-border-strong bg-surface-raised text-label font-medium text-ink outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {account.kind === "identity" ? (
            account.initials
          ) : (
            <Icon name="settings" className="size-4 text-text-muted" />
          )}
        </button>
      </div>
    </header>
  );
}
