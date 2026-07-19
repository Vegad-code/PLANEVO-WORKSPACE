"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addWeeks,
  dateKey,
  weekParam,
  weekRange,
} from "@planevo/core/state/calendar-state";
import type {
  CalendarColor,
  CalendarEventRow,
  CalendarRow,
  TaskDueChip,
} from "@planevo/core/types/calendar";
import { toast } from "@/components/ui/toast";
import {
  createCalendarAction,
  createCalendarEventAction,
  scheduleTaskFromDragAction,
  toggleCalendarVisibilityAction,
} from "@/app/(workspace)/calendar/actions";
import {
  getCalendarScope,
  setCalendarScope,
  type CalendarScope,
} from "@/lib/calendar/scope-prefs";
import { CalendarDndContext } from "./calendar-dnd-context";
import { CalendarSidebar } from "./calendar-sidebar";
import { CalendarToolbar, type CalendarView } from "./calendar-toolbar";
import { CreateEventPopover, type CreateEventInput } from "./create-event-popover";
import {
  EventCrossLinkDialogs,
  type EventCrossLinkPanel,
} from "./event-cross-links";
import { EventPeek } from "./event-peek";
import { TodayColumn } from "./today-column";
import type { TodayColumnTask } from "./today-task-row";
import { WeekGrid } from "./week-grid";

type CalendarProductViewProps = {
  weekStart: Date;
  calendars: CalendarRow[];
  events: CalendarEventRow[];
  taskDues: TaskDueChip[];
  todayTasks: TodayColumnTask[];
  initialScope: CalendarScope;
  workspaceId: string | null;
};

type SelectedEvent = {
  event: CalendarEventRow;
  anchor: HTMLElement;
};

function calendarPath(scope: CalendarScope, week?: string): string {
  const params = new URLSearchParams();
  if (scope === "workspace") params.set("scope", "workspace");
  if (week) params.set("week", week);
  const query = params.toString();
  return query ? `/calendar?${query}` : "/calendar";
}

export function CalendarProductView({
  weekStart,
  calendars,
  events,
  taskDues,
  todayTasks,
  initialScope,
  workspaceId,
}: CalendarProductViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [view, setView] = useState<CalendarView>("week");
  const [now, setNow] = useState(() => new Date());
  const [dayAnchor, setDayAnchor] = useState<Date>(() => {
    const today = new Date();
    const { start, end } = weekRange(weekStart);
    return today >= start && today < end ? today : weekStart;
  });
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(null);
  const [crossLinkPanel, setCrossLinkPanel] =
    useState<EventCrossLinkPanel | null>(null);
  const [createSlot, setCreateSlot] = useState<Date | null>(null);

  // The current-time line drifts without a minute tick.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const storedScope = getCalendarScope();
    if (storedScope === initialScope) return;
    if (storedScope === "workspace" && !workspaceId) {
      setCalendarScope("all");
      return;
    }
    router.replace(calendarPath(storedScope, weekParam(weekStart)));
  }, [initialScope, router, weekStart, workspaceId]);

  function changeScope(scope: CalendarScope) {
    if (scope === "workspace" && !workspaceId) {
      toast("Open a workspace before using this filter", { tone: "error" });
      return;
    }
    setCalendarScope(scope);
    router.push(calendarPath(scope, weekParam(weekStart)));
  }

  function navigateToWeekOf(anchor: Date) {
    router.push(calendarPath(initialScope, weekParam(anchor)));
  }

  function handleNavigatePrevious() {
    if (view === "day") {
      const previousDay = new Date(dayAnchor);
      previousDay.setDate(previousDay.getDate() - 1);
      setDayAnchor(previousDay);
      if (previousDay < weekStart) navigateToWeekOf(previousDay);
      return;
    }
    navigateToWeekOf(addWeeks(weekStart, -1));
  }

  function handleNavigateNext() {
    if (view === "day") {
      const nextDay = new Date(dayAnchor);
      nextDay.setDate(nextDay.getDate() + 1);
      setDayAnchor(nextDay);
      if (nextDay >= weekRange(weekStart).end) navigateToWeekOf(nextDay);
      return;
    }
    navigateToWeekOf(addWeeks(weekStart, 1));
  }

  function handleNavigateToday() {
    const today = new Date();
    setDayAnchor(today);
    router.push(calendarPath(initialScope));
  }

  function handleToggleVisibility(calendarId: string, isVisible: boolean) {
    startTransition(async () => {
      const result = await toggleCalendarVisibilityAction({ calendarId, isVisible });
      if (!result.ok) toast(result.error, { tone: "error" });
      router.refresh();
    });
  }

  function handleCreateCalendar(name: string, color: CalendarColor) {
    startTransition(async () => {
      const result = await createCalendarAction({ name, color });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      toast("Calendar created");
      router.refresh();
    });
  }

  function handleCreateEvent(input: CreateEventInput) {
    startTransition(async () => {
      const result = await createCalendarEventAction(input);
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      setCreateSlot(null);
      toast("Event created");
      router.refresh();
    });
  }

  function handleScheduleTask(taskId: string, startsAt: string) {
    startTransition(async () => {
      const result = await scheduleTaskFromDragAction({
        taskId,
        operationKey: crypto.randomUUID(),
        startsAt,
      });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      toast("Task scheduled");
      router.refresh();
    });
  }

  const selectedEventCalendar = selectedEvent
    ? calendars.find(
        (calendar) => calendar.id === selectedEvent.event.calendar_id,
      ) ?? null
    : null;

  const gridStart = view === "day" ? dayAnchor : weekStart;

  return (
    <section
      aria-labelledby="calendar-product-title"
      aria-busy={isPending}
      className="flex min-h-full w-full flex-col px-5 pt-6 pb-6 sm:px-6 lg:px-8"
    >
      <header className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-product-meta text-text-muted">
            {initialScope === "workspace" ? "This workspace" : "All calendars"}
          </p>
          <h1
            id="calendar-product-title"
            className="mt-1 text-h1 font-medium tracking-tight"
          >
            Calendar
          </h1>
        </div>
      </header>

      <div className="sticky top-0 z-20 -mx-5 mb-4 shrink-0 border-b border-border/80 bg-paper/95 px-5 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <CalendarToolbar
          anchor={view === "day" ? dayAnchor : weekStart}
          view={view}
          scope={initialScope}
          onViewChange={setView}
          onScopeChange={changeScope}
          onNavigatePrevious={handleNavigatePrevious}
          onNavigateNext={handleNavigateNext}
          onNavigateToday={handleNavigateToday}
        />
      </div>

      <CalendarDndContext onScheduleTask={handleScheduleTask}>
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-card border border-border bg-paper">
          <aside className="hidden w-56 shrink-0 overflow-y-auto border-r border-border p-3 lg:block">
            <CalendarSidebar
              calendars={calendars}
              onToggleVisibility={handleToggleVisibility}
              onCreateCalendar={handleCreateCalendar}
            />
          </aside>

          <div className="hidden w-72 shrink-0 overflow-hidden border-r border-border pt-3 md:block">
            <TodayColumn tasks={todayTasks} now={now} />
          </div>

          <div className="min-w-0 flex-1">
            <WeekGrid
              key={dateKey(gridStart)}
              weekStart={gridStart}
              dayCount={view === "day" ? 1 : 7}
              calendars={calendars}
              events={events}
              taskDues={taskDues}
              now={now}
              onSlotClick={setCreateSlot}
              onEventSelect={(event, anchor) =>
                setSelectedEvent({ event, anchor })
              }
            />
          </div>
        </div>
      </CalendarDndContext>

      {createSlot ? (
        <CreateEventPopover
          slotStart={createSlot}
          calendars={calendars}
          onSubmit={handleCreateEvent}
          onClose={() => setCreateSlot(null)}
          isPending={isPending}
        />
      ) : null}

      {selectedEvent ? (
        <EventPeek
          key={selectedEvent.event.id}
          event={selectedEvent.event}
          calendar={selectedEventCalendar}
          anchor={selectedEvent.anchor}
          onClose={() => setSelectedEvent(null)}
          onLinkTask={() => setCrossLinkPanel("task")}
          onAttachFile={() => setCrossLinkPanel("files")}
          onAddToWorkspace={() => setCrossLinkPanel("workspace")}
        />
      ) : null}

      {selectedEvent && crossLinkPanel ? (
        <EventCrossLinkDialogs
          eventId={selectedEvent.event.id}
          panel={crossLinkPanel}
          onClose={() => setCrossLinkPanel(null)}
        />
      ) : null}
    </section>
  );
}
