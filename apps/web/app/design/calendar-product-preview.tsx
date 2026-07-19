"use client";

import { DndContext } from "@dnd-kit/core";
import type {
  CalendarEventRow,
  CalendarRow,
  TaskDueChip,
} from "@planevo/core/types/calendar";
import { CalendarSidebar } from "@/features/calendar-product/calendar-sidebar";
import { CalendarToolbar } from "@/features/calendar-product/calendar-toolbar";
import { TodayColumn } from "@/features/calendar-product/today-column";
import type { TodayColumnTask } from "@/features/calendar-product/today-task-row";
import { WeekGrid } from "@/features/calendar-product/week-grid";

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

/** Local-time ISO builder for the fixed preview week (Jul 13–19, 2026). */
function previewTime(dayOfMonth: number, hour: number, minute = 0): string {
  return new Date(2026, 6, dayOfMonth, hour, minute).toISOString();
}

function previewEvent(
  overrides: Partial<CalendarEventRow> & Pick<CalendarEventRow, "id" | "title" | "starts_at" | "ends_at" | "calendar_id">,
): CalendarEventRow {
  return {
    user_id: "design-owner",
    all_day: false,
    location: null,
    description_json: {},
    task_id: null,
    google_event_id: null,
    source: "planevo",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

const DESIGN_WEEK_START = new Date(2026, 6, 13);

const DESIGN_EVENTS: CalendarEventRow[] = [
  previewEvent({ id: "ev-standup", title: "Standup call", calendar_id: "cal-work", starts_at: previewTime(13, 12), ends_at: previewTime(13, 13) }),
  previewEvent({ id: "ev-design", title: "Design system", calendar_id: "cal-work", starts_at: previewTime(14, 10), ends_at: previewTime(14, 11) }),
  previewEvent({ id: "ev-review", title: "Tuesday review", calendar_id: "cal-personal", starts_at: previewTime(14, 14), ends_at: previewTime(14, 15, 30) }),
  previewEvent({ id: "ev-cricket", title: "Cricket", calendar_id: "cal-personal", starts_at: previewTime(17, 14, 30), ends_at: previewTime(17, 16, 45), location: "Mumbai, Maharastra" }),
  previewEvent({ id: "ev-hidden", title: "Holiday planning", calendar_id: "cal-holidays", starts_at: previewTime(15, 9), ends_at: previewTime(15, 10) }),
];

const DESIGN_TASK_DUES: TaskDueChip[] = [
  { taskId: "task-marketing", title: "Marketing page", dueAt: previewTime(15, 17), status: "not_started" },
  { taskId: "task-invoice", title: "Invoice template design", dueAt: previewTime(17, 12), status: "not_started" },
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
      <figure className="w-full">
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Toolbar + week grid — 4 visible events, hidden calendar filtered, due
          chips, now line
        </figcaption>
        <div className="flex h-144 flex-col gap-3 overflow-hidden rounded-card border border-border bg-paper p-3">
          <CalendarToolbar
            anchor={DESIGN_NOW}
            view="week"
            scope="all"
            onViewChange={noop}
            onScopeChange={noop}
            onNavigatePrevious={noop}
            onNavigateNext={noop}
            onNavigateToday={noop}
          />
          <div className="min-h-0 flex-1">
            <DndContext>
              <WeekGrid
                weekStart={DESIGN_WEEK_START}
                calendars={DESIGN_CALENDARS}
                events={DESIGN_EVENTS}
                taskDues={DESIGN_TASK_DUES}
                now={DESIGN_NOW}
              />
            </DndContext>
          </div>
        </div>
      </figure>
      <figure className="w-full max-w-md">
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Day view — single column
        </figcaption>
        <div className="h-96 overflow-hidden rounded-card border border-border bg-paper p-3">
          <DndContext>
            <WeekGrid
              weekStart={new Date(2026, 6, 14)}
              dayCount={1}
              calendars={DESIGN_CALENDARS}
              events={DESIGN_EVENTS}
              taskDues={DESIGN_TASK_DUES}
              now={DESIGN_NOW}
            />
          </DndContext>
        </div>
      </figure>
    </div>
  );
}
