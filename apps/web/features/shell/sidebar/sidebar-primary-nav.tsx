"use client";

import { useEffect, useState } from "react";
import type { IconName } from "@/components/ui/planevo-icon";
import { Icon } from "@/components/ui/planevo-icon";
import { NavItem } from "@/features/shell/nav-item";

const primaryItems: Array<{
  label: string;
  icon: IconName;
  href: string;
  activeAccent?: boolean;
}> = [
  { label: "Home", icon: "workspace", href: "/" },
  {
    label: "Tasks",
    icon: "tasks",
    href: "/tasks",
    activeAccent: false,
  },
  { label: "Calendar", icon: "calendar", href: "/calendar" },
  { label: "Files", icon: "files", href: "/files" },
];

type SidebarPrimaryNavProps = {
  onNavigate?: () => void;
  onOpenSpotlight?: () => void;
};

function shortcutHint(): string {
  if (typeof navigator === "undefined") return "⌘K";
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
    ? "⌘K"
    : "Ctrl+K";
}

export function SidebarPrimaryNav({ onNavigate, onOpenSpotlight }: SidebarPrimaryNavProps) {
  const [hint, setHint] = useState("⌘K");

  useEffect(() => {
    setHint(shortcutHint());
  }, []);

  return (
    <nav aria-label="Primary" className="mt-1 flex shrink-0 flex-col gap-1">
      <button
        type="button"
        onClick={() => {
          onOpenSpotlight?.();
          onNavigate?.();
        }}
        aria-keyshortcuts="Meta+K Control+K"
        className="relative mx-2 flex h-9 items-center gap-3 rounded-lg px-3 text-left text-small font-medium text-text-secondary outline-none transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
      >
        <Icon name="search" className="size-4 shrink-0 text-current" />
        <span className="min-w-0 flex-1 truncate">Search</span>
        <kbd className="rounded-md border border-border bg-surface-sunken px-1.5 py-0.5 text-label text-text-muted">
          {hint}
        </kbd>
      </button>
      {primaryItems.map((item) => (
        <NavItem key={item.href} {...item} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}
