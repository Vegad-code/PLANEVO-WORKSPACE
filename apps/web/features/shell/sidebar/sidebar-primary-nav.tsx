"use client";

import { useRouter } from "next/navigation";
import type { IconName } from "@/components/ui/planevo-icon";
import { NavItem } from "@/features/shell/nav-item";

const primaryItems: Array<{
  label: string;
  icon: IconName;
  href: string;
  variant?: "default" | "ai";
}> = [
  { label: "Home", icon: "workspace", href: "/" },
  { label: "Workspace", icon: "canvas", href: "/workspace" },
  { label: "Tasks", icon: "tasks", href: "/tasks" },
  { label: "Calendar", icon: "calendar", href: "/calendar" },
  { label: "Files", icon: "files", href: "/files" },
  { label: "Planevo AI", icon: "ai", href: "/ai", variant: "ai" },
  { label: "Integrations", icon: "agents", href: "/integrations" },
  { label: "Settings", icon: "settings", href: "/settings" },
];

type SidebarPrimaryNavProps = {
  onNavigate?: () => void;
};

export function SidebarPrimaryNav({ onNavigate }: SidebarPrimaryNavProps) {
  const router = useRouter();

  return (
    <nav aria-label="Primary" className="mt-1 flex shrink-0 flex-col gap-0.5">
      <NavItem
        label="Search"
        icon="search"
        onClick={() => {
          onNavigate?.();
          router.push("/search");
        }}
      />
      {primaryItems.map((item) => (
        <NavItem key={item.href} {...item} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}
