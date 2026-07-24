"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type CalendarPlanningSectionProps = {
  id: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  count?: number;
  children: React.ReactNode;
};

/** Accordion row for the Calendar Planning sidebar. */
export function CalendarPlanningSection({
  id,
  label,
  open,
  onToggle,
  count,
  children,
}: CalendarPlanningSectionProps) {
  const panelId = `${id}-panel`;
  const headerId = `${id}-header`;

  return (
    <section aria-labelledby={headerId} className="border-b border-border last:border-b-0">
      <button
        type="button"
        id={headerId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 rounded-md px-1 py-2 text-left outline-none hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3.5 shrink-0 text-text-muted transition-transform motion-reduce:transition-none",
            !open && "-rotate-90",
          )}
        />
        <span className="flex-1 text-product-body font-medium text-ink">
          {label}
        </span>
        {typeof count === "number" && count > 0 ? (
          <span className="text-product-meta tabular-nums text-text-muted">
            {count}
          </span>
        ) : null}
      </button>
      {open ? (
        <div id={panelId} role="region" aria-labelledby={headerId} className="pb-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}
