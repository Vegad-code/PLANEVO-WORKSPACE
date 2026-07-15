"use client";

import { NavItem } from "@/features/shell/nav-item";

type SidebarFooterProps = {
  onNavigate?: () => void;
};

export function SidebarFooter({ onNavigate }: SidebarFooterProps) {
  return (
    <div className="mt-auto shrink-0 border-t border-border pt-2 pb-2">
      <p className="px-5 pb-1 text-label uppercase text-text-muted">AI</p>
      <nav aria-label="AI navigation" className="flex flex-col gap-0.5">
        <NavItem
          href="/ai"
          label="Planevo AI"
          icon="ai"
          variant="ai"
          onNavigate={onNavigate}
        />
      </nav>
      {/* Plan / credit meter slot — Plus/Pro only when billing wires in. */}
      <div className="min-h-2" aria-hidden="true" />
    </div>
  );
}
