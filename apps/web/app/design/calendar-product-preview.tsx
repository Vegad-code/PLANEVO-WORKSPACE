"use client";

import type { CalendarRow } from "@planevo/core/types/calendar";
import { CalendarSidebar } from "@/features/calendar-product/calendar-sidebar";

export const DESIGN_CALENDARS: CalendarRow[] = [
  { id: "cal-personal", user_id: "design-owner", name: "Personal", color: "marigold", is_visible: true, position: 0, created_at: "2026-07-01T00:00:00.000Z" },
  { id: "cal-work", user_id: "design-owner", name: "Work", color: "ocean", is_visible: true, position: 1, created_at: "2026-07-01T00:00:00.000Z" },
  { id: "cal-holidays", user_id: "design-owner", name: "Holidays", color: "meadow", is_visible: false, position: 2, created_at: "2026-07-01T00:00:00.000Z" },
];

function noop() {
  // Design previews render interactions inert.
}

export function CalendarProductPreview() {
  return (
    <div className="flex flex-wrap gap-8">
      <figure>
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Sidebar — three calendars, one hidden
        </figcaption>
        <div className="w-56 rounded-card border border-border bg-paper p-3">
          <CalendarSidebar
            calendars={DESIGN_CALENDARS}
            onToggleVisibility={noop}
            onCreateCalendar={noop}
          />
        </div>
      </figure>
      <figure>
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Sidebar — empty
        </figcaption>
        <div className="w-56 rounded-card border border-border bg-paper p-3">
          <CalendarSidebar
            calendars={[]}
            onToggleVisibility={noop}
            onCreateCalendar={noop}
          />
        </div>
      </figure>
    </div>
  );
}
