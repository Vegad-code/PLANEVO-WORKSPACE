"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPageAndOpen } from "@/app/(workspace)/actions";
import { Icon, type IconName } from "@/components/ui/planevo-icon";

const menuItems: Array<{ label: string; icon: IconName; href: string }> = [
  { label: "New task", icon: "tasks", href: "/tasks" },
  { label: "New database", icon: "canvas", href: "/templates" },
  { label: "New file", icon: "files", href: "/files/new" },
];

export function SidebarNewButton({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative mx-2 mt-2 shrink-0">
      <div className="flex overflow-hidden rounded-lg bg-ink text-paper">
        <form action={createPageAndOpen} className="min-w-0 flex-1">
          <button
            type="submit"
            onClick={() => onNavigate?.()}
            className="flex h-9 w-full items-center gap-2 px-3 text-small font-medium outline-none transition-opacity hover:opacity-90 focus-visible:opacity-80 motion-reduce:transition-none"
          >
            <Icon name="plus" className="size-4 shrink-0" />
            <span className="truncate">New page</span>
          </button>
        </form>
        <button
          type="button"
          aria-label="More ways to create"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((value) => !value)}
          className="flex w-8 shrink-0 items-center justify-center border-l border-paper/20 outline-none transition-opacity hover:opacity-90 focus-visible:opacity-80 motion-reduce:transition-none"
        >
          <Icon name="chevron-down" className="size-4" />
        </button>
      </div>

      {open && (
        <div
          role="menu"
          aria-label="Create"
          className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-paper py-1"
        >
          {menuItems.map((item) => (
            <Link
              key={item.href}
              role="menuitem"
              href={item.href}
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              className="flex h-9 items-center gap-3 px-3 text-small font-medium text-text-secondary outline-none hover:bg-surface-raised hover:text-ink focus-visible:bg-surface-raised focus-visible:text-ink"
            >
              <Icon name={item.icon} className="size-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
