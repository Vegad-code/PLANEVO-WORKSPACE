"use client";

import { NavItem } from "@/features/shell/nav-item";

const destinationItems = [
  { label: "Tasks", icon: "tasks" as const, href: "/tasks" },
  { label: "Calendar", icon: "calendar" as const, href: "/calendar" },
  { label: "Files", icon: "files" as const, href: "/files" },
];

type SidebarPrimaryNavProps = {
  onNavigate?: () => void;
};

export function SidebarHomeNav({ onNavigate }: SidebarPrimaryNavProps) {
  return (
    <nav aria-label="Home" className="flex shrink-0 flex-col gap-0.5">
      <NavItem
        href="/"
        label="Home"
        icon="workspace"
        onNavigate={onNavigate}
      />
    </nav>
  );
}

export function SidebarDestinationNav({ onNavigate }: SidebarPrimaryNavProps) {
  return (
    <nav aria-label="Workspace destinations" className="mt-1 flex shrink-0 flex-col gap-0.5">
      {destinationItems.map((item) => (
        <NavItem key={item.label} {...item} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}
