"use client";

import { DndContext } from "@dnd-kit/core";
import type {
  CalendarEventRow,
  CalendarRow,
  TaskDueChip,
} from "@planevo/core/types/calendar";
import { useRef, useState } from "react";
import { PanelLeft } from "lucide-react";
import { CalendarGridEngine } from "@/features/calendar-product/calendar-grid-engine";
import { CalendarColorPicker } from "@/features/calendar-product/calendar-color-picker";
import { CalendarNowProvider } from "@/features/calendar-product/calendar-now-context";
import { CalendarPlanningSidebar } from "@/features/calendar-product/calendar-planning-sidebar";
import { CalendarGridSkeleton } from "@/features/calendar-product/calendar-product-skeleton";
import { CalendarSelector } from "@/features/calendar-product/calendar-selector";
import { CalendarShortcutsCheatSheet } from "@/features/calendar-product/calendar-shortcuts-cheat-sheet";
import { CalendarTasksSection } from "@/features/calendar-product/calendar-tasks-section";
import { CalendarViewMenu } from "@/features/calendar-product/calendar-view-menu";
import { EventDetailPanel } from "@/features/calendar-product/event-detail-panel";
import { EventQuickCaptureField } from "@/features/calendar-product/event-quick-capture-field";
import { EventDetailPopover } from "@/features/calendar-product/event-detail-popover";
import type { TodayColumnTask } from "@/features/calendar-product/today-task-row";
import { CALENDAR_P0_SHORTCUTS } from "@/lib/calendar/calendar-shortcut-map";

/** Fixed clock so preview states do not drift day to day. */
const DESIGN_NOW = new Date(2026, 6, 15, 13, 0);
const DESIGN_WEEK_START = new Date(2026, 6, 13);
const DESIGN_DAY_ANCHOR = new Date(2026, 6, 24);
const DESIGN_DAY_NOW = new Date(2026, 6, 24, 13, 0);
const DESIGN_MONTH_ANCHOR = new Date(2026, 6, 24);
const DESIGN_MONTH_NOW = new Date(2026, 6, 24, 10, 0);
const DESIGN_SIX_WEEK_MONTH_ANCHOR = new Date(2026, 4, 24);
const DESIGN_SIX_WEEK_MONTH_NOW = new Date(2026, 4, 24, 10, 0);

const DESIGN_TODAY_TASKS: TodayColumnTask[] = [
  {
    id: "task-marketing",
    title: "Marketing page",
    status: "not_started",
    due_at: "2026-07-15T17:00:00.000Z",
  },
  {
    id: "task-wireframe",
    title: "Wireframe - Paper",
    status: "in_progress",
    due_at: "2026-07-14T09:00:00.000Z",
  },
  {
    id: "task-invoice",
    title: "Invoice template design",
    status: "not_started",
    due_at: "2026-07-17T12:00:00.000Z",
  },
  {
    id: "task-research",
    title: "UX research flow",
    status: "not_started",
    due_at: null,
  },
  {
    id: "task-widgets",
    title: "Review UI widgets",
    status: "not_started",
    due_at: null,
  },
  {
    id: "task-done",
    title: "Landing page",
    status: "done",
    due_at: "2026-07-15T10:00:00.000Z",
  },
];

export const DESIGN_CALENDARS: CalendarRow[] = [
  {
    id: "cal-main",
    user_id: "design-owner",
    name: "Main",
    color: "graphite",
    color_mode: "inherit_override",
    is_main: true,
    is_included_in_main: true,
    is_default: true,
    deleted_at: null,
    purge_after: null,
    position: -1,
    created_at: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "cal-personal",
    user_id: "design-owner",
    name: "Personal",
    color: "sky",
    color_mode: "inherit_override",
    is_main: false,
    is_included_in_main: true,
    is_default: false,
    deleted_at: null,
    purge_after: null,
    position: 0,
    created_at: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "cal-work",
    user_id: "design-owner",
    name: "Work",
    color: "grape",
    color_mode: "required_per_event",
    is_main: false,
    is_included_in_main: true,
    is_default: false,
    deleted_at: null,
    purge_after: null,
    position: 1,
    created_at: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "cal-holidays",
    user_id: "design-owner",
    name: "Holidays",
    color: "basil",
    color_mode: "inherit_override",
    is_main: false,
    is_included_in_main: false,
    is_default: false,
    deleted_at: null,
    purge_after: null,
    position: 2,
    created_at: "2026-07-01T00:00:00.000Z",
  },
];

function previewTime(dayOfMonth: number, hour: number, minute = 0): string {
  return new Date(2026, 6, dayOfMonth, hour, minute).toISOString();
}

function previewAnchorRect({
  left,
  top,
  width,
  height,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
}): DOMRect {
  const right = left + width;
  const bottom = top + height;

  // DOMRect is not available while the design route is prerendered in Node.
  return {
    x: left,
    y: top,
    left,
    top,
    right,
    bottom,
    width,
    height,
    toJSON: () => ({ x: left, y: top, left, top, right, bottom, width, height }),
  };
}

function previewEvent(
  overrides: Partial<CalendarEventRow> &
    Pick<
      CalendarEventRow,
      "id" | "title" | "starts_at" | "ends_at" | "calendar_id"
    >,
): CalendarEventRow {
  return {
    user_id: "design-owner",
    starts_at_local: null,
    ends_at_local: null,
    timezone: null,
    duration_minutes: null,
    rrule: null,
    recurrence_end: null,
    parent_event_id: null,
    recurrence_id: null,
    is_exception: false,
    is_cancelled: false,
    deleted_at: null,
    color: null,
    conference_url: null,
    all_day: false,
    location: null,
    description_json: {},
    task_id: null,
    google_event_id: null,
    external_connection_id: null,
    external_event_id: null,
    external_etag: null,
    external_updated_at: null,
    source: "planevo",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

const DESIGN_EVENTS: CalendarEventRow[] = [
  previewEvent({
    id: "ev-standup",
    title: "Standup call",
    calendar_id: "cal-work",
    starts_at: previewTime(13, 12),
    ends_at: previewTime(13, 13),
  }),
  previewEvent({
    id: "ev-design",
    title: "Design system",
    calendar_id: "cal-work",
    starts_at: previewTime(14, 10),
    ends_at: previewTime(14, 11),
  }),
  previewEvent({
    id: "ev-review",
    title: "Tuesday review",
    calendar_id: "cal-personal",
    starts_at: previewTime(14, 14),
    ends_at: previewTime(14, 15, 30),
    task_id: "task-wireframe",
  }),
  previewEvent({
    id: "ev-cricket",
    title: "Cricket",
    calendar_id: "cal-personal",
    starts_at: previewTime(17, 14, 30),
    ends_at: previewTime(17, 16, 45),
    location: "Mumbai, Maharastra",
  }),
  previewEvent({
    id: "ev-hidden",
    title: "Holiday planning",
    calendar_id: "cal-holidays",
    starts_at: previewTime(15, 9),
    ends_at: previewTime(15, 10),
  }),
];

const DESIGN_MONTH_EVENTS: CalendarEventRow[] = [
  previewEvent({
    id: "ev-month-span",
    title: "Team offsite",
    calendar_id: "cal-work",
    starts_at: new Date(2026, 5, 30, 9, 0).toISOString(),
    ends_at: new Date(2026, 6, 3, 17, 0).toISOString(),
  }),
  previewEvent({
    id: "ev-month-allday",
    title: "Independence Day",
    calendar_id: "cal-personal",
    all_day: true,
    starts_at: new Date(2026, 6, 4, 0, 0).toISOString(),
    ends_at: new Date(2026, 6, 5, 0, 0).toISOString(),
  }),
  previewEvent({
    id: "ev-month-sync",
    title: "Team sync",
    calendar_id: "cal-work",
    starts_at: previewTime(24, 9, 0),
    ends_at: previewTime(24, 10, 0),
  }),
  previewEvent({
    id: "ev-month-review",
    title: "Design review",
    calendar_id: "cal-work",
    starts_at: previewTime(24, 11, 30),
    ends_at: previewTime(24, 12, 30),
  }),
  previewEvent({
    id: "ev-month-lunch",
    title: "Lunch with Alex",
    calendar_id: "cal-personal",
    starts_at: previewTime(24, 12, 0),
    ends_at: previewTime(24, 13, 0),
  }),
  previewEvent({
    id: "ev-overflow-1",
    title: "Morning standup",
    calendar_id: "cal-work",
    starts_at: previewTime(3, 9, 0),
    ends_at: previewTime(3, 9, 30),
  }),
  previewEvent({
    id: "ev-overflow-2",
    title: "Sprint planning",
    calendar_id: "cal-work",
    starts_at: previewTime(3, 10, 0),
    ends_at: previewTime(3, 11, 0),
  }),
  previewEvent({
    id: "ev-overflow-3",
    title: "Client call",
    calendar_id: "cal-personal",
    starts_at: previewTime(3, 11, 30),
    ends_at: previewTime(3, 12, 30),
  }),
  previewEvent({
    id: "ev-overflow-4",
    title: "1:1 with manager",
    calendar_id: "cal-work",
    starts_at: previewTime(3, 14, 0),
    ends_at: previewTime(3, 14, 30),
  }),
  previewEvent({
    id: "ev-overflow-5",
    title: "Docs review",
    calendar_id: "cal-work",
    starts_at: previewTime(3, 15, 0),
    ends_at: previewTime(3, 16, 0),
  }),
  previewEvent({
    id: "ev-overflow-6",
    title: "Retro",
    calendar_id: "cal-work",
    starts_at: previewTime(3, 16, 30),
    ends_at: previewTime(3, 17, 30),
  }),
  previewEvent({
    id: "ev-aug-1",
    title: "August kickoff",
    calendar_id: "cal-personal",
    starts_at: new Date(2026, 7, 1, 10, 0).toISOString(),
    ends_at: new Date(2026, 7, 1, 11, 0).toISOString(),
  }),
];

const DESIGN_MONTH_TASK_DUES: TaskDueChip[] = [
  {
    taskId: "task-month-open",
    title: "Send the project brief",
    dueAt: previewTime(24, 10, 30),
    status: "in_progress",
  },
  {
    taskId: "task-month-complete",
    title: "Review research notes",
    dueAt: previewTime(24, 16),
    status: "done",
  },
];

const DESIGN_MONTH_MULTI_DAY_EVENTS = DESIGN_MONTH_EVENTS.filter((event) =>
  ["ev-month-span", "ev-month-allday", "ev-month-sync"].includes(event.id),
);

const DESIGN_MONTH_WEEK_CROSS_EVENTS: CalendarEventRow[] = [
  previewEvent({
    id: "ev-week-cross",
    title: "Conference",
    calendar_id: "cal-work",
    all_day: true,
    starts_at: new Date(2026, 6, 3, 0, 0).toISOString(),
    ends_at: new Date(2026, 6, 7, 0, 0).toISOString(),
  }),
  previewEvent({
    id: "ev-month-sync",
    title: "Team sync",
    calendar_id: "cal-work",
    starts_at: previewTime(24, 9, 0),
    ends_at: previewTime(24, 10, 0),
  }),
];

const DESIGN_MONTH_OUTSIDE_EVENTS = DESIGN_MONTH_EVENTS.filter(
  (event) => event.id === "ev-aug-1",
);

const DESIGN_SIX_WEEK_DENSE_EVENTS: CalendarEventRow[] = [
  previewEvent({
    id: "ev-may-bar",
    title: "Annual planning",
    calendar_id: "cal-work",
    all_day: true,
    starts_at: new Date(2026, 4, 24, 0, 0).toISOString(),
    ends_at: new Date(2026, 4, 26, 0, 0).toISOString(),
  }),
  ...[9, 10, 11, 13, 14, 15].map((hour, index) =>
    previewEvent({
      id: `ev-may-dense-${hour}`,
      title: [
        "Team sync",
        "Research review",
        "Partner call",
        "Draft handoff",
        "Focus block",
        "Wrap-up",
      ][index]!,
      calendar_id: index % 2 === 0 ? "cal-work" : "cal-personal",
      starts_at: new Date(2026, 4, 24, hour, 0).toISOString(),
      ends_at: new Date(2026, 4, 24, hour + 1, 0).toISOString(),
    }),
  ),
];

const DESIGN_SIX_WEEK_TASK_DUES: TaskDueChip[] = [
  {
    taskId: "task-may-open",
    title: "Send the planning notes",
    dueAt: new Date(2026, 4, 24, 8, 30).toISOString(),
    status: "in_progress",
  },
  {
    taskId: "task-may-complete",
    title: "Close last week’s review",
    dueAt: new Date(2026, 4, 24, 17).toISOString(),
    status: "done",
  },
];

function noop() {
  // Design previews render interactions inert.
}

async function noopCreateCalendar() {
  return null;
}

function PlanningSidebarFrame({
  todayTasks = DESIGN_TODAY_TASKS,
  calendars = DESIGN_CALENDARS,
}: {
  todayTasks?: TodayColumnTask[];
  calendars?: CalendarRow[];
}) {
  return (
    <div className="calendar-rail-glass h-full w-80 overflow-hidden rounded-xl">
      <DndContext>
        <CalendarPlanningSidebar
          calendars={calendars}
          events={DESIGN_EVENTS}
          todayTasks={todayTasks}
          now={DESIGN_NOW}
          weekStart={DESIGN_WEEK_START}
          onSelectDay={noop}
          onToggleTask={noop}
          onQuickAddTask={noop}
          onCollapse={noop}
        />
      </DndContext>
    </div>
  );
}

/**
 * Every read quick capture can produce. The field is controlled, so a fixed
 * `value` with an inert setter renders exactly the state that line resolves to.
 */
const QUICK_CAPTURE_STATES: { line: string; note: string }[] = [
  { line: "", note: "Empty — the prompt teaches the syntax" },
  {
    line: "Design review tomorrow 3-4pm",
    note: "Everything stated — day and time both read as parsed",
  },
  {
    line: "Lunch with Sam at noon",
    note: "Time stated, day assumed from the clicked slot",
  },
  { line: "Standup", note: "Nothing stated — the whole slot is assumed" },
  {
    line: "Coffee at Cafe May",
    note: "Guarded — a proper noun never becomes a date",
  },
  {
    line: "Retro every Tuesday 9am",
    note: "Recurrence read and reported, not silently dropped",
  },
];

function QuickCaptureStatesDemo() {
  const fallbackStartsAt = new Date(2026, 6, 15, 15, 0).toISOString();
  const fallbackEndsAt = new Date(2026, 6, 15, 17, 0).toISOString();

  return (
    <figure>
      <figcaption className="mb-2 text-label uppercase text-text-muted">
        Quick capture — every interpretation state
      </figcaption>
      <div className="grid gap-3 lg:grid-cols-2">
        {QUICK_CAPTURE_STATES.map((state) => (
          <div key={state.note}>
            <div className="event-card-surface overflow-hidden rounded-xl">
              <EventQuickCaptureField
                value={state.line}
                onValueChange={noop}
                onCapture={noop}
                fallbackStartsAt={fallbackStartsAt}
                fallbackEndsAt={fallbackEndsAt}
              />
            </div>
            <p className="mt-1.5 text-product-meta text-text-muted">
              {state.note}
            </p>
          </div>
        ))}
      </div>
    </figure>
  );
}

function EventDetailPanelDemo({
  mode,
  label,
}: {
  mode: "create" | "edit";
  label: string;
}) {
  const peekEvent = DESIGN_EVENTS[3]!;
  const anchorRect = previewAnchorRect({
    left: 120,
    top: 120,
    width: 96,
    height: 36,
  });

  return (
    <figure>
      <figcaption className="mb-2 text-label uppercase text-text-muted">
        {label}
      </figcaption>
      <div className="relative h-[36rem] transform-gpu overflow-hidden rounded-2xl border border-border bg-calendar-chrome">
        <EventDetailPopover anchorRect={anchorRect} onClose={noop}>
          <EventDetailPanel
            mode={mode}
            calendars={DESIGN_CALENDARS}
            event={
              mode === "edit"
                ? {
                    ...peekEvent,
                    description_json: {
                      text: "Everyone should join this call. The team is all set for the new update.",
                    },
                  }
                : null
            }
            initialRange={
              mode === "create"
                ? {
                    startsAt: new Date(2026, 6, 15, 9, 30).toISOString(),
                    endsAt: new Date(2026, 6, 15, 10, 30).toISOString(),
                  }
                : undefined
            }
            onClose={noop}
            onSave={noop}
            onDelete={
              mode === "edit" ? async () => ({ ok: true as const }) : undefined
            }
            onOpenCrossLink={mode === "edit" ? noop : undefined}
          />
        </EventDetailPopover>
      </div>
    </figure>
  );
}

function DraftCreatePreview() {
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const draftCreateEvent = {
    startsAt: new Date(2026, 6, 15, 9, 30).toISOString(),
    endsAt: new Date(2026, 6, 15, 10, 30).toISOString(),
    title: "New event",
    calendarId: DESIGN_CALENDARS[0]!.id,
    allDay: false,
    color: null,
  };
  const anchorRect = previewAnchorRect({
    left: 320,
    top: 180,
    width: 120,
    height: 64,
  });

  return (
    <figure className="w-full">
      <figcaption className="mb-2 text-label uppercase text-text-muted">
        Drag-create draft — solid card on grid + liquid glass popover with beak
      </figcaption>
      <div className="relative h-[36rem] transform-gpu overflow-hidden rounded-xl bg-sidebar p-3">
        <div
          ref={gridContainerRef}
          className="calendar-panel-glass h-full overflow-hidden rounded-xl p-2"
        >
          <CalendarGridEngine
            view="week"
            anchor={DESIGN_WEEK_START}
            calendars={DESIGN_CALENDARS}
            events={DESIGN_EVENTS}
            taskDues={[]}
            now={DESIGN_NOW}
            draftCreateEvent={draftCreateEvent}
            onSlotSelect={noop}
            onDraftSelecting={noop}
            onEventSelect={noop}
            onEventTimesChange={noop}
            onToggleTask={noop}
            onOpenDay={noop}
            onNavigateMonth={noop}
          />
        </div>
        <EventDetailPopover
          anchorRect={anchorRect}
          mouseContainerRef={gridContainerRef}
          onClose={noop}
        >
          <EventDetailPanel
            mode="create"
            calendars={DESIGN_CALENDARS}
            initialRange={{
              startsAt: draftCreateEvent.startsAt,
              endsAt: draftCreateEvent.endsAt,
            }}
            onClose={noop}
            onSave={noop}
            onDraftChange={noop}
          />
        </EventDetailPopover>
      </div>
    </figure>
  );
}

type MonthDesignStateProps = {
  label: string;
  events: CalendarEventRow[];
  taskDues?: TaskDueChip[];
  anchor?: Date;
  now?: Date;
};

/**
 * Every month state is shown at two heights.
 *
 * The tall frame is not decoration: this harness used to render month only at
 * `h-80`, where the old grid looked fine, and that is exactly why cavernous
 * rows shipped unnoticed at a real viewport height. Density regressions have to
 * be visible here or they are not visible until production.
 */
const MONTH_PREVIEW_FRAMES = [
  { key: "compact", label: "compact", className: "h-80" },
  { key: "full-height", label: "full height", className: "h-[900px]" },
] as const;

function MonthDesignState({
  label,
  events,
  taskDues = [],
  anchor = DESIGN_MONTH_ANCHOR,
  now = DESIGN_MONTH_NOW,
}: MonthDesignStateProps) {
  return (
    <>
      {MONTH_PREVIEW_FRAMES.flatMap((frame) =>
        (["light", "dark"] as const).map((theme) => (
          <figure
            key={`${frame.key}-${theme}`}
            data-theme={theme === "dark" ? "dark" : undefined}
            className="w-full"
          >
            <figcaption className="mb-2 text-label uppercase text-text-muted">
              Month state — {label} · {frame.label} · {theme}
            </figcaption>
            <div
              className={`calendar-panel-glass ${frame.className} overflow-hidden rounded-xl p-2`}
            >
              <CalendarGridEngine
                view="month"
                anchor={anchor}
                calendars={DESIGN_CALENDARS}
                events={events}
                taskDues={taskDues}
                now={now}
                onSlotSelect={noop}
                onEventSelect={noop}
                onEventTimesChange={noop}
                onToggleTask={noop}
                onOpenDay={noop}
                onNavigateMonth={noop}
              />
            </div>
          </figure>
        )),
      )}
    </>
  );
}

export function CalendarProductPreview() {
  return (
    <CalendarNowProvider>
    <div className="flex flex-wrap gap-8">
      <figure className="w-full">
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Calendar product — Agenda · multi-calendar toolbar · week grid
        </figcaption>
        <div className="flex h-[36rem] gap-3 overflow-hidden rounded-xl bg-sidebar p-3">
          <DndContext>
            <div className="calendar-rail-glass w-80 shrink-0 overflow-hidden rounded-xl">
              <CalendarPlanningSidebar
                calendars={DESIGN_CALENDARS}
                events={DESIGN_EVENTS}
                todayTasks={DESIGN_TODAY_TASKS}
                now={DESIGN_NOW}
                weekStart={DESIGN_WEEK_START}
                onSelectDay={noop}
                onToggleTask={noop}
                onQuickAddTask={noop}
                onCollapse={noop}
              />
            </div>
            <div className="calendar-panel-glass flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl p-2">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-1 pb-2">
                <CalendarSelector
                  context={{ kind: "main" }}
                  anchor={DESIGN_WEEK_START}
                  view="week"
                  scope="all"
                  calendars={DESIGN_CALENDARS}
                  onToggleIncluded={noop}
                  onCreateCalendar={noopCreateCalendar}
                  onSetDefaultCalendar={noop}
                />
                <CalendarViewMenu
                  view="week"
                  views={["day", "week", "month", "year"]}
                  onViewChange={noop}
                />
              </div>
              <div className="min-h-0 flex-1 pt-2">
                <CalendarGridEngine
                  view="week"
                  anchor={DESIGN_WEEK_START}
                  calendars={DESIGN_CALENDARS}
                  events={DESIGN_EVENTS}
                  taskDues={[]}
                  now={DESIGN_NOW}
                  onSlotSelect={noop}
                  onEventSelect={noop}
                  onEventTimesChange={noop}
                  onToggleTask={noop}
                  onOpenDay={noop}
                  onNavigateMonth={noop}
                />
              </div>
            </div>
          </DndContext>
        </div>
      </figure>

      <CalendarPalettePreview />

      <figure className="w-full">
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Calendar loading — day, week, and month geometry
        </figcaption>
        <div className="grid gap-4 lg:grid-cols-3">
          {(["day", "week", "month"] as const).map((loadingView) => (
            <div
              key={loadingView}
              className="flex h-80 min-w-0 flex-col overflow-hidden rounded-xl border border-border"
            >
              <CalendarGridSkeleton view={loadingView} />
            </div>
          ))}
        </div>
      </figure>

      {(["light", "dark"] as const).map((theme) => (
        <figure
          key={`day-view-${theme}`}
          className="w-full"
          data-theme={theme === "dark" ? "dark" : undefined}
        >
          <figcaption className="mb-2 text-label uppercase text-text-muted">
            Day view — GCal craft (header, gutter, all-day band, now line) ·{" "}
            {theme}
          </figcaption>
          <div className="h-[36rem] overflow-hidden rounded-xl bg-calendar-chrome p-2">
            <CalendarGridEngine
              view="day"
              anchor={DESIGN_DAY_ANCHOR}
              calendars={DESIGN_CALENDARS}
              events={DESIGN_EVENTS}
              taskDues={[]}
              now={DESIGN_DAY_NOW}
              onSlotSelect={noop}
              onEventSelect={noop}
              onEventTimesChange={noop}
              onToggleTask={noop}
              onOpenDay={noop}
              onNavigateMonth={noop}
            />
          </div>
        </figure>
      ))}

      <MonthDesignState label="empty" events={[]} />
      <MonthDesignState
        label="normal"
        events={DESIGN_MONTH_EVENTS.slice(0, 5)}
      />
      <MonthDesignState
        label="dense overflow"
        anchor={DESIGN_SIX_WEEK_MONTH_ANCHOR}
        now={DESIGN_SIX_WEEK_MONTH_NOW}
        events={DESIGN_SIX_WEEK_DENSE_EVENTS}
        taskDues={DESIGN_SIX_WEEK_TASK_DUES}
      />
      <MonthDesignState
        label="multi-day"
        events={DESIGN_MONTH_MULTI_DAY_EVENTS}
      />
      <MonthDesignState
        label="week-crossing bar"
        events={DESIGN_MONTH_WEEK_CROSS_EVENTS}
      />
      <MonthDesignState
        label="outside-month"
        events={DESIGN_MONTH_OUTSIDE_EVENTS}
      />
      <MonthDesignState
        label="task due"
        events={DESIGN_MONTH_EVENTS.slice(2, 5)}
        taskDues={DESIGN_MONTH_TASK_DUES}
      />

      <figure>
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Agenda — all sections open
        </figcaption>
        <div className="h-[32rem]">
          <PlanningSidebarFrame />
        </div>
      </figure>

      <figure>
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Agenda — empty tasks
        </figcaption>
        <div className="h-[28rem]">
          <PlanningSidebarFrame todayTasks={[]} calendars={[]} />
        </div>
      </figure>

      <figure>
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Agenda collapsed — reveal control
        </figcaption>
        <div className="calendar-panel-glass flex w-80 items-center gap-2 rounded-xl p-4">
          <button
            type="button"
            aria-label="Show agenda"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <PanelLeft aria-hidden="true" className="size-4" />
          </button>
          <div>
            <p className="text-product-meta text-text-muted">Calendar</p>
            <p className="text-h3 font-semibold text-ink">Calendar</p>
          </div>
        </div>
      </figure>

      <figure>
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Tasks section — empty buckets
        </figcaption>
        <div className="calendar-rail-glass w-80 overflow-hidden rounded-xl p-4">
          <DndContext>
            <CalendarTasksSection
              tasks={[]}
              events={[]}
              calendars={DESIGN_CALENDARS}
              now={DESIGN_NOW}
              onToggleTask={noop}
              onQuickAddTask={noop}
            />
          </DndContext>
        </div>
      </figure>

      <figure>
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Mobile agenda drawer
        </figcaption>
        <div className="relative h-[28rem] w-80 overflow-hidden rounded-xl bg-ink/40">
          <div className="calendar-rail-glass absolute inset-y-0 right-0 flex w-full flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-product-body font-medium text-ink">Agenda</p>
              <span className="text-product-meta text-text-secondary">
                Close
              </span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <DndContext>
                <CalendarPlanningSidebar
                  calendars={DESIGN_CALENDARS}
                  events={DESIGN_EVENTS}
                  todayTasks={DESIGN_TODAY_TASKS}
                  now={DESIGN_NOW}
                  weekStart={DESIGN_WEEK_START}
                  onSelectDay={noop}
                  onToggleTask={noop}
                  onQuickAddTask={noop}
                  onCollapse={noop}
                  hideCollapseControl
                />
              </DndContext>
            </div>
          </div>
        </div>
      </figure>

      <DraftCreatePreview />

      <QuickCaptureStatesDemo />

      <div className="grid gap-6 lg:grid-cols-2">
        <EventDetailPanelDemo
          mode="create"
          label="Event card — create, opens in quick capture"
        />
        <EventDetailPanelDemo
          mode="edit"
          label="Event card — edit with cross-links and delete"
        />
      </div>

      <figure className="w-full max-w-lg">
        <figcaption className="mb-2 text-label uppercase text-text-muted">
          Keyboard shortcuts — ? cheat sheet (P0)
        </figcaption>
        <div className="spotlight-glass-panel overflow-hidden rounded-2xl border border-border">
          <div className="border-b border-border px-5 py-3.5">
            <p className="text-h3 font-medium text-ink">Calendar shortcuts</p>
            <p className="mt-0.5 text-product-meta text-text-muted">
              Press ? on /calendar · Esc closes
            </p>
          </div>
          <ul className="divide-y divide-border px-5 py-1">
            {CALENDAR_P0_SHORTCUTS.map((entry) => (
              <li
                key={entry.key}
                className="flex items-center justify-between gap-3 py-2.5 text-product-body text-ink"
              >
                <span>{entry.label}</span>
                <kbd className="rounded-md border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-product-meta">
                  {entry.mac}
                </kbd>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-3">
          <ShortcutsCheatSheetDemo />
        </div>
      </figure>
    </div>
    </CalendarNowProvider>
  );
}

function CalendarPalettePreview() {
  const [color, setColor] = useState<CalendarRow["color"]>("sky");

  return (
    <figure className="w-full max-w-2xl">
      <figcaption className="mb-2 text-label uppercase text-text-muted">
        Calendar palette — named spectrum, custom color, keyboard + validation
      </figcaption>
      <div className="rounded-xl border border-border bg-paper p-4">
        <CalendarColorPicker value={color} onChange={setColor} />
      </div>
    </figure>
  );
}

function ShortcutsCheatSheetDemo() {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-product-body font-medium text-ink hover:bg-paper"
      >
        Open shortcuts dialog
      </button>
      <CalendarShortcutsCheatSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
