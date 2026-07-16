"use client";

import { getTopBarAccountPresentation } from "@planevo/core/state/top-bar-state";
import { Icon } from "@/components/ui/planevo-icon";

type SidebarFooterProps = {
  userDisplayName: string | null;
  userInitials: string | null;
  onOpenSettings?: () => void;
};

export function SidebarFooter({
  userDisplayName,
  userInitials,
  onOpenSettings,
}: SidebarFooterProps) {
  const account = getTopBarAccountPresentation({ userDisplayName, userInitials });

  return (
    <div className="mt-auto shrink-0 border-t border-border px-2 pb-2 pt-2">
      {/* Plan / credit meter slot — Plus/Pro only when billing wires in. */}
      <button
        type="button"
        onClick={onOpenSettings}
        aria-label={
          account.kind === "identity"
            ? `Open settings for ${account.name}`
            : "Open settings"
        }
        className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left outline-none transition-colors hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-raised text-label font-medium text-ink">
          {account.kind === "identity" ? (
            account.initials
          ) : (
            <Icon name="settings" className="size-4 text-text-muted" />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-small font-medium text-ink">
          {account.name}
        </span>
        <Icon name="chevron-down" className="size-4 shrink-0 text-text-muted" />
      </button>
    </div>
  );
}
