"use client";

import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/planevo-icon";

type SidebarQuickActionsProps = {
  onNavigate?: () => void;
};

export function SidebarQuickActions({ onNavigate }: SidebarQuickActionsProps) {
  const router = useRouter();

  return (
    <div
      role="group"
      aria-label="Quick actions"
      className="mx-2 mt-1 flex items-center gap-1"
    >
      <button
        type="button"
        aria-label="Search Planevo"
        title="Search (⌘K)"
        onClick={() => {
          onNavigate?.();
          router.push("/search");
        }}
        className="flex size-8 items-center justify-center rounded-lg text-text-secondary outline-none transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
      >
        <Icon name="search" className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Inbox"
        title="Inbox — coming soon"
        disabled
        className="flex size-8 items-center justify-center rounded-lg text-text-muted outline-none opacity-50"
      >
        <Icon name="inbox" className="size-4" />
      </button>
    </div>
  );
}
