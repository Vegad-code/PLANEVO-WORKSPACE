"use client";

import type { IconName } from "@/components/ui/planevo-icon";
import { NavItem } from "@/features/shell/nav-item";

const primaryItems: Array<{
  label: string;
  icon: IconName;
  href: string;
}> = [
  { label: "Home", icon: "workspace", href: "/" },
  { label: "Tasks", icon: "tasks", href: "/tasks" },
  { label: "Calendar", icon: "calendar", href: "/calendar" },
  { label: "Files", icon: "files", href: "/files" },
];

type SidebarPrimaryNavProps = {
  onNavigate?: () => void;
};

export function SidebarPrimaryNav({ onNavigate }: SidebarPrimaryNavProps) {
  return (
    <nav aria-label="Primary" className="mt-1 flex shrink-0 flex-col gap-1">
      {primaryItems.map((item) => (
        <NavItem key={item.href} {...item} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}
