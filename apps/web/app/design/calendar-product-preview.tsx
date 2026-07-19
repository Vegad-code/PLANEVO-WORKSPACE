"use client";

import { DndContext } from "@dnd-kit/core";
import type { CalendarRow } from "@planevo/core/types/calendar";
import { CalendarSidebar } from "@/features/calendar-product/calendar-sidebar";
import { TodayColumn } from "@/features/calendar-product/today-column";
import type { TodayColumnTask } from "@/features/calendar-product/today-task-row";

/** Fixed clock so preview states do not drift day to day. */
const DESIGN_NOW = new Date(2026, 6, 15, 13, 0);

const DESIGN_TODAY_TASKS: TodayColumnTask[] = [
  { id: "task-marketing", title: "Marketing page", status: "not_started", due_at: "2026-07-15T17:00:00.000Z" },
  { id: "task-wireframe", title: "Wireframe — Paper", status: "in_progress", due_at: "2026-07-14T09:00:00.000Z" },
  { id: "task-invoice", title: "Invoice template design", status: "not_started", due_at: "2026-07-17T12:00:00.000Z" },
  { id: "task-research", title: "UX research flow", status: "not_started", due_at: null },
  { id: "task-widgets", title: "Review UI widgets", status: "not_started", due_at: null },
  { id: "task-done", title: "Landing page", status: "done", due_at: "2026-07-15T10:00:00.000Z" },
];

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
      <figure>
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Today column — populated (done task filtered out)
        </figcaption>
        <div className="h-96 w-72 overflow-hidden rounded-card border border-border bg-paper pt-3">
          <DndContext>
            <TodayColumn tasks={DESIGN_TODAY_TASKS} now={DESIGN_NOW} />
          </DndContext>
        </div>
      </figure>
      <figure>
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Today column — empty
        </figcaption>
        <div className="h-96 w-72 overflow-hidden rounded-card border border-border bg-paper pt-3">
          <DndContext>
            <TodayColumn tasks={[]} now={DESIGN_NOW} />
          </DndContext>
        </div>
      </figure>
    </div>
  );
}
