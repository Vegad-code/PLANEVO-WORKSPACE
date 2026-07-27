"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PanelLeft } from "lucide-react";
import { HotkeysProvider } from "react-hotkeys-hook";
import type {
  CalendarColor,
  CalendarEventRow,
} from "@planevo/core/types/calendar";
import { toast } from "@/components/ui/toast";
import { useSidebarLayout } from "@/features/shell/sidebar-layout-context";
import { centeredAnchorRectFromElement } from "@/lib/calendar/event-popover-position";
import { draftCreateCardAnchorRect } from "@/lib/calendar/event-popover-anchor";
import { defaultCalendarId } from "@/lib/calendar/default-calendar";
import type { DraftCreateEventState } from "@/lib/calendar/rbc-event-adapter";
import { CALENDAR_HOTKEY_SCOPE } from "@/lib/calendar/calendar-shortcut-map";
import { startOfWeekSunday } from "@/lib/calendar/calendar-navigation";
import {
  DEFAULT_PLANNING_WIDTH,
  getPlanningCollapsed,
  getPlanningWidth,
  setPlanningCollapsed,
} from "@/lib/calendar/planning-prefs";
import {
  getCalendarScope,
  setCalendarScope,
  type CalendarScope,
} from "@/lib/calendar/scope-prefs";
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";
import {
  createCalendarAction,
  deleteRecurringEventAction,
  restoreCalendarEventAction,
  restoreRecurringCalendarMutationAction,
  type RecurrenceMutationScope,
  setDefaultCalendarAction,
  subscribeIcsCalendarAction,
  syncCalendarConnectionAction,
  toggleCalendarVisibilityAction,
  updateCalendarDetailsAction,
  updateRecurringEventAction,
} from "@/app/(workspace)/calendar/actions";
import {
  resolveEventMutationTarget,
  type EventMutationTarget,
} from "@/lib/calendar/event-mutation-target";
import { instantToLocalDateTime } from "@/lib/calendar/recurrence";
import {
  createUndoStack,
  popUndo,
  pushUndo,
  type CalendarUndoPayload,
  type RestoreEventTimesUndoPayload,
} from "@/lib/calendar/undo-stack";
import { EventDetailPopover } from "./event-detail-popover";
import { CalendarDndContext } from "./calendar-dnd-context";
import { useMonthMutations } from "./use-month-mutations";
import { useCalendarMutations } from "./use-calendar-mutations";
import { CalendarGridEngine } from "./calendar-grid-engine";
import { CalendarPlanningSidebar } from "./calendar-planning-sidebar";
import type { IcsCalendarSubscriptionInput } from "./calendar-sources-section";
import { CalendarResizeHandle } from "./calendar-resize-handle";
import { CalendarShortcutsCheatSheet } from "./calendar-shortcuts-cheat-sheet";
import { CalendarToolbar } from "./calendar-toolbar";
import {
  EventDetailPanel,
  type EventPanelSavePayload,
} from "./event-detail-panel";import {
  EventCrossLinkDialogs,
  type EventCrossLinkPanel,
} from "./event-cross-links";
import {
  useCalendarData,
  useInvalidateActiveCalendarRange,
  useInvalidateCalendarData,
  useInvalidateCalendarMeta,
  useInvalidateIntersectingRanges,
} from "./use-calendar-data";
import { useCalendarHotkeys } from "./use-calendar-hotkeys";
import { useCalendarNavigation } from "./use-calendar-navigation";
import { YearView } from "./year-view";
import { CalendarViewTransition } from "./calendar-view-transition";
import { CalendarNowProvider } from "./calendar-now-context";
import { EventRecurrenceScopeDialog } from "./event-recurrence-scope-dialog";

type CalendarProductViewProps = {
  initialScope: CalendarScope;
  workspaceId: string | null;
};

type EventPanelState =
  | {
      mode: "create";
      /**
       * Identifies one create session. The panel echoes its times back up
       * through `onDraftChange`, so anything derived from `startsAt` — the
       * popover key, the panel's form seed — would remount and wipe the form
       * on every edit. Those both key off this instead, which only changes
       * when a genuinely new create starts.
       */
      sessionId: string;
      startsAt: string;
      endsAt: string;
      anchorRect: DOMRect;
    }
  | {
      mode: "edit";
      eventId: string;
      event: CalendarEventRow;
      mutationTarget: EventMutationTarget | null;
      anchorRect: DOMRect;
    }
  | null;

type PendingRecurrenceMutation =
  | {
      kind: "save";
      event: CalendarEventRow;
      payload: EventPanelSavePayload;
    }
  | { kind: "delete"; event: CalendarEventRow }
  | {
      kind: "move";
      operation: "move" | "resize";
      event: CalendarEventRow;
      startsAt: string;
      endsAt: string;
    };

function eventDescription(event: CalendarEventRow): string {
  const text = event.description_json.text;
  return typeof text === "string" ? text : "";
}

function recurrencePayload(
  pending: Exclude<PendingRecurrenceMutation, { kind: "delete" }>,
): EventPanelSavePayload {
  if (pending.kind === "save") return pending.payload;

  const timezone =
    pending.event.timezone ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    "UTC";
  const startsAtLocal =
    instantToLocalDateTime(pending.startsAt, timezone) ??
    pending.startsAt.slice(0, 19);
  const endsAtLocal =
    instantToLocalDateTime(pending.endsAt, timezone) ??
    pending.endsAt.slice(0, 19);
  const durationMinutes = Math.max(
    1,
    Math.round(
      (new Date(pending.endsAt).getTime() -
        new Date(pending.startsAt).getTime()) /
        60_000,
    ),
  );

  return {
    calendarId: pending.event.calendar_id,
    title: pending.event.title,
    startsAt: pending.startsAt,
    endsAt: pending.endsAt,
    startsAtLocal,
    endsAtLocal,
    timezone,
    durationMinutes,
    rrule: pending.event.rrule,
    location: pending.event.location,
    description: eventDescription(pending.event),
    reminderOffsetMinutes: null,
    allDay: pending.event.all_day,
  };
}

const PLANNING_TOGGLE_TRANSITION = {
  duration: 0.15,
  ease: [0.16, 1, 0.3, 1] as const,
};

export function CalendarProductView(props: CalendarProductViewProps) {
  return (
    <HotkeysProvider initiallyActiveScopes={[CALENDAR_HOTKEY_SCOPE]}>
      <CalendarNowProvider>
        <CalendarProductViewInner {...props} />
      </CalendarNowProvider>
    </HotkeysProvider>
  );
}

function CalendarProductViewInner({
  initialScope,
  workspaceId,
}: CalendarProductViewProps) {
  const { showRevealChrome } = useSidebarLayout();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [recurrencePending, startRecurrenceTransition] = useTransition();
  const [metaPending, startMetaTransition] = useTransition();
  const invalidateCalendar = useInvalidateCalendarData();
  const invalidateMeta = useInvalidateCalendarMeta();
  const invalidateActiveRange = useInvalidateActiveCalendarRange();
  const invalidateIntersecting = useInvalidateIntersectingRanges();
  const {
    anchorDate,
    view,
    scope,
    navMotion,
    setScope,
    handleNavigatePrevious,
    handleNavigateNext,
    handleNavigateToday,
    handleViewChange,
    handleSelectDay,
  } = useCalendarNavigation(initialScope);
  const calendarQuery = useCalendarData(scope, view, anchorDate);
  const calendarMutations = useCalendarMutations({
    scope,
    view,
    anchor: anchorDate,
  });
  const [eventPanel, setEventPanel] = useState<EventPanelState>(null);
  const [eventPanelDirty, setEventPanelDirty] = useState(false);
  const [panelSavePending, setPanelSavePending] = useState(false);
  const [pendingRecurrence, setPendingRecurrence] =
    useState<PendingRecurrenceMutation | null>(null);
  const [pendingMovesClearToken, setPendingMovesClearToken] = useState(0);
  const [overlayPendingMoves, setOverlayPendingMoves] = useState(
    () => new Map<string, { startsAt: string; endsAt: string }>(),
  );
  const [draftCreateEvent, setDraftCreateEvent] =
    useState<DraftCreateEventState | null>(null);
  const [crossLinkPanel, setCrossLinkPanel] =
    useState<EventCrossLinkPanel | null>(null);
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false);
  const [planningDrawerOpen, setPlanningDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [planningWidth, setPlanningWidthState] = useState(
    DEFAULT_PLANNING_WIDTH,
  );
  const [isPlanningResizing, setIsPlanningResizing] = useState(false);
  const [planningPrefsRestored, setPlanningPrefsRestored] = useState(false);
  // Width/chrome springs only after an explicit user collapse/expand — never on
  // mount, prefs restore, or skeleton→ready handoff (those must stay instant).
  const [planningMotionEnabled, setPlanningMotionEnabled] = useState(false);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const undoStackRef = useRef(createUndoStack());

  const calendars = calendarQuery.data?.calendars ?? [];
  const events = calendarQuery.data?.events ?? [];
  const taskDues = calendarQuery.data?.taskDues ?? [];
  const todayTasks = calendarQuery.data?.todayTasks ?? [];
  const createCalendarId = defaultCalendarId(calendars);
  const isFetchingNewRange = calendarQuery.isRangeFetching;

  // Restore before paint so the first painted frame matches the loading
  // skeleton. The aside stays mounted (width 0 when collapsed) — unmounting
  // until restore caused a visible rail flash on soft-nav handoff.
  useLayoutEffect(() => {
    setSidebarCollapsed(getPlanningCollapsed());
    setPlanningWidthState(getPlanningWidth());
    setPlanningPrefsRestored(true);
  }, []);

  function setSidebarCollapsedFromUser(collapsed: boolean) {
    setPlanningMotionEnabled(true);
    setSidebarCollapsed(collapsed);
  }

  useEffect(() => {
    if (!planningPrefsRestored) return;
    setPlanningCollapsed(sidebarCollapsed);
  }, [planningPrefsRestored, sidebarCollapsed]);

  useEffect(() => {
    const storedScope = getCalendarScope();
    if (storedScope === scope) return;
    if (storedScope === "workspace" && !workspaceId) {
      setCalendarScope("all");
      return;
    }
    setCalendarScope(storedScope);
    setScope(storedScope);
  }, [scope, setScope, workspaceId]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const googleStatus = url.searchParams.get("google");
    if (!googleStatus) return;
    if (googleStatus === "connected") {
      toast("Google Calendar connected");
    } else if (googleStatus === "denied") {
      toast("Google Calendar connection was cancelled", { tone: "error" });
    } else {
      toast("Could not connect Google Calendar", { tone: "error" });
    }
    url.searchParams.delete("google");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  function handlePlanningWidthChange(nextWidth: number) {
    setPlanningWidthState(nextWidth);
  }

  function changeScope(nextScope: CalendarScope) {
    if (nextScope === "workspace" && !workspaceId) {
      toast("Open a workspace before using this filter", { tone: "error" });
      return;
    }
    setCalendarScope(nextScope);
    setScope(nextScope);
    invalidateCalendar(nextScope);
  }

  function handleToggleVisibility(calendarId: string, isVisible: boolean) {
    startMetaTransition(async () => {
      const result = await toggleCalendarVisibilityAction({
        calendarId,
        isVisible,
      });
      if (!result.ok) toast(result.error, { tone: "error" });
      invalidateMeta(scope);
      invalidateActiveRange({ scope, view, anchor: anchorDate });
    });
  }

  function handleCreateCalendar(name: string, color: CalendarColor) {
    startMetaTransition(async () => {
      const result = await createCalendarAction({ name, color });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      toast("Calendar created");
      invalidateMeta(scope);
    });
  }

  function handleUpdateCalendar(
    calendarId: string,
    input: { name: string; color: CalendarColor },
  ) {
    startMetaTransition(async () => {
      const result = await updateCalendarDetailsAction({
        calendarId,
        ...input,
      });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      toast("Calendar updated");
      invalidateMeta(scope);
    });
  }

  function handleSetDefaultCalendar(calendarId: string) {
    startMetaTransition(async () => {
      const result = await setDefaultCalendarAction({ calendarId });
      if (!result.ok) {
        toast(result.error, { tone: "error" });
        return;
      }
      toast("Default calendar updated");
      invalidateMeta(scope);
    });
  }

  async function handleSubscribeIcs(
    input: IcsCalendarSubscriptionInput,
  ): Promise<boolean> {
    const result = await subscribeIcsCalendarAction(input);
    if (!result.ok) {
      toast(result.error, { tone: "error" });
      return false;
    }
    if (result.data.synced) {
      toast("Subscribed calendar added");
    } else {
      toast(result.data.warning ?? "Calendar added; first sync needs a retry.", {
        tone: "error",
      });
    }
    invalidateCalendar(scope);
    return true;
  }

  async function handleSyncConnection(connectionId: string): Promise<void> {
    const result = await syncCalendarConnectionAction({ connectionId });
    if (!result.ok) {
      toast(result.error, { tone: "error" });
      return;
    }
    toast("Calendar synced");
    invalidateCalendar(scope);
  }

  function handleStandardViewChange(
    nextView: "day" | "week" | "month" | "year",
  ) {
    handleViewChange(nextView);
  }

  function handleStandardSelectDay(day: Date) {
    handleSelectDay(day);
  }

  async function executeUndo(id: string) {
    const popped = popUndo({ stack: undoStackRef.current, id });
    undoStackRef.current = popped.stack;
    if (!popped.entry) {
      toast("That undo has expired", { tone: "error" });
      return;
    }

    const payload = popped.entry.payload;

    // Optimistic inverse for time restores — no full invalidate.
    // Must restore the authored wall clock and duration, not just the UTC pair:
    // starts_at/ends_at are derived from starts_at_local + timezone, and the
    // forward move also shifted any linked task's due date.
    if (payload.kind === "restore-times") {
      calendarMutations.restoreEventTimes({
        eventId: payload.eventId,
        startsAt: payload.startsAt,
        endsAt: payload.endsAt,
        startsAtLocal: payload.startsAtLocal,
        endsAtLocal: payload.endsAtLocal,
        durationMinutes: payload.durationMinutes,
      });
      toast("Change undone");
      return;
    }

    const result =
      payload.kind === "restore-event"
        ? await restoreCalendarEventAction({ eventId: payload.eventId })
        : await restoreRecurringCalendarMutationAction({
            masterEventId: payload.masterEventId,
            guardEventId: payload.guardEventId,
            newMasterEventId: payload.newMasterEventId,
            eventRows: payload.eventRows,
          });

    if (!result.ok) {
      toast(result.error, { tone: "error" });
      return;
    }

    toast("Change undone");
    if (payload.kind === "restore-event") {
      invalidateActiveRange({ scope, view, anchor: anchorDate });
    } else {
      const starts = payload.eventRows.map((row) => row.starts_at).sort();
      const ends = payload.eventRows.map((row) => row.ends_at).sort();
      invalidateIntersecting({
        scope,
        start: (starts[0] ?? new Date().toISOString()).slice(0, 10),
        end: (ends.at(-1) ?? new Date().toISOString()).slice(0, 10),
      });
    }
  }

  function offerUndo(message: string, payload: CalendarUndoPayload) {
    const id = crypto.randomUUID();
    undoStackRef.current = pushUndo({
      stack: undoStackRef.current,
      id,
      payload,
    });
    toast(message, {
      action: {
        label: "Undo",
        onClick: () => void executeUndo(id),
      },
    });
  }

  function priorTimesUndo(
    event: CalendarEventRow,
    operation: "move" | "resize",
  ): RestoreEventTimesUndoPayload {
    return {
      kind: "restore-times",
      operation,
      eventId: event.id,
      startsAt: event.starts_at,
      endsAt: event.ends_at,
      startsAtLocal: event.starts_at_local,
      endsAtLocal: event.ends_at_local,
      durationMinutes: event.duration_minutes,
      linkedTask: event.task_id
        ? {
            taskId: event.task_id,
            dueAt: event.starts_at,
          }
        : null,
    };
  }

  function beginPendingRecurrence(pending: PendingRecurrenceMutation) {
    setEventPanel(null);
    setEventPanelDirty(false);
    setCrossLinkPanel(null);
    setDraftCreateEvent(null);
    setPendingRecurrence(pending);
  }

  const closeEventPanel = useCallback(
    (options?: { force?: boolean }) => {
      // Create flow matches Google Calendar: Escape / outside click / Cancel
      // always discards the draft with no confirm prompt.
      const isCreate = eventPanel?.mode === "create";
      if (
        !options?.force &&
        !isCreate &&
        eventPanelDirty &&
        !window.confirm("Discard unsaved changes?")
      ) {
        return;
      }
      setEventPanel(null);
      setEventPanelDirty(false);
      setCrossLinkPanel(null);
      setDraftCreateEvent(null);
    },
    [eventPanel?.mode, eventPanelDirty],
  );

  function resolveFallbackAnchorRect(): DOMRect {
    if (gridContainerRef.current) {
      return centeredAnchorRectFromElement(gridContainerRef.current);
    }
    return new DOMRect(
      window.innerWidth / 2 - 80,
      window.innerHeight / 2 - 24,
      160,
      48,
    );
  }

  const handleDraftSelecting = useCallback(
    (range: { startsAt: Date; endsAt: Date }) => {
      setDraftCreateEvent((current) => ({
        startsAt: range.startsAt.toISOString(),
        endsAt: range.endsAt.toISOString(),
        title: current?.title ?? "",
        calendarId: current?.calendarId ?? createCalendarId,
      }));
    },
    [createCalendarId],
  );

  function openCreateEventPanel(
    range: { startsAt: Date; endsAt: Date },
    anchorRect?: DOMRect,
  ) {
    if (eventPanelDirty && !window.confirm("Discard unsaved changes?")) return;
    setCrossLinkPanel(null);
    const startsAt = range.startsAt.toISOString();
    const endsAt = range.endsAt.toISOString();
    setDraftCreateEvent((current) => ({
      startsAt,
      endsAt,
      title: current?.title ?? "",
      calendarId: current?.calendarId ?? createCalendarId,
    }));
    setEventPanel({
      mode: "create",
      sessionId: crypto.randomUUID(),
      startsAt,
      endsAt,
      anchorRect: anchorRect ?? resolveFallbackAnchorRect(),
    });
    setEventPanelDirty(false);
  }

  const handleDraftChange = useCallback(
    (
      payload: Pick<
        EventPanelSavePayload,
        "title" | "startsAt" | "endsAt" | "calendarId"
      >,
    ) => {
      setDraftCreateEvent({
        title: payload.title,
        startsAt: payload.startsAt,
        endsAt: payload.endsAt,
        calendarId: payload.calendarId,
      });
      setEventPanel((current) =>
        current?.mode === "create"
          ? {
              ...current,
              startsAt: payload.startsAt,
              endsAt: payload.endsAt,
            }
          : current,
      );
    },
    [],
  );

  useLayoutEffect(() => {
    if (eventPanel?.mode !== "create") return;
    const draftAnchor = draftCreateCardAnchorRect(gridContainerRef.current);
    if (!draftAnchor) return;
    setEventPanel((current) => {
      if (current?.mode !== "create") return current;
      const { anchorRect } = current;
      const same =
        anchorRect.left === draftAnchor.left &&
        anchorRect.top === draftAnchor.top &&
        anchorRect.width === draftAnchor.width &&
        anchorRect.height === draftAnchor.height;
      if (same) return current;
      return { ...current, anchorRect: draftAnchor };
    });
  }, [
    eventPanel?.mode,
    draftCreateEvent?.startsAt,
    draftCreateEvent?.endsAt,
    draftCreateEvent?.title,
    draftCreateEvent?.calendarId,
  ]);

  useEffect(() => {
    if (view === "day" || view === "week") return;
    setDraftCreateEvent(null);
  }, [view]);

  useEffect(() => {
    if (!draftCreateEvent || eventPanel) return;
    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== "Escape") return;
      setDraftCreateEvent(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [draftCreateEvent, eventPanel]);

  function openEditEventPanel(event: CalendarEventRow, anchorRect: DOMRect) {
    if (eventPanelDirty && !window.confirm("Discard unsaved changes?")) return;
    const mutationTarget = resolveEventMutationTarget(event);
    if (!mutationTarget) {
      console.warn("[calendar] invalid recurrence identity for event", {
        eventId: event.id,
        parentEventId: event.parent_event_id,
        recurrenceId: event.recurrence_id,
      });
    }
    setCrossLinkPanel(null);
    setDraftCreateEvent(null);
    setEventPanel({
      mode: "edit",
      eventId: event.id,
      event,
      mutationTarget,
      anchorRect,
    });
    setEventPanelDirty(false);
  }

  function handleHotkeyCreateEvent(range: { startsAt: Date; endsAt: Date }) {
    openCreateEventPanel(range, resolveFallbackAnchorRect());
  }

  function handleEventPanelSave(payload: EventPanelSavePayload) {
    if (!eventPanel) return;

    if (eventPanel.mode === "edit") {
      if (!eventPanel.mutationTarget) return;
      if (eventPanel.mutationTarget.kind !== "standalone") {
        beginPendingRecurrence({
          kind: "save",
          event: eventPanel.event,
          payload,
        });
        return;
      }
    }

    setPanelSavePending(true);
    const closeOnSuccess = () => {
      setPanelSavePending(false);
      setEventPanel(null);
      setEventPanelDirty(false);
      setDraftCreateEvent(null);
    };
    const onError = () => {
      setPanelSavePending(false);
    };

    if (eventPanel.mode === "create") {
      calendarMutations.createEvent(payload, {
        onCommitted: () => {
          toast("Event created");
          closeOnSuccess();
        },
        onError,
      });
    } else if (eventPanel.mutationTarget?.kind === "standalone") {
      calendarMutations.updateEvent(
        eventPanel.mutationTarget.eventId,
        payload,
        {
          onCommitted: () => {
            toast("Event saved");
            closeOnSuccess();
          },
          onError,
        },
      );
    }
  }

  async function handleEventPanelDelete(event: CalendarEventRow) {
    if (eventPanel?.mode === "edit" && !eventPanel.mutationTarget) {
      return {
        ok: false as const,
        error: "This event has an invalid recurrence identity and can't be deleted.",
      };
    }
    const target = resolveEventMutationTarget(event);
    if (target && target.kind !== "standalone") {
      beginPendingRecurrence({ kind: "delete", event });
      return;
    }

    calendarMutations.deleteEvent(event.id, {
      startsAt: event.starts_at,
      endsAt: event.ends_at,
    });
    offerUndo(
      event.task_id ? "Task returned to the backlog" : "Event deleted",
      event.task_id
        ? {
            kind: "restore-event",
            operation: "unschedule",
            eventId: event.id,
            deletedAt: event.deleted_at,
            linkedTask: {
              taskId: event.task_id,
              dueAt: event.starts_at,
            },
          }
        : {
            kind: "restore-event",
            operation: "delete",
            eventId: event.id,
            deletedAt: event.deleted_at,
          },
    );
    return { ok: true as const };
  }

  async function handleCompleteLinkedTask(event: CalendarEventRow) {
    calendarMutations.completeLinkedTask(event);
    return { ok: true as const };
  }

  async function handleUnscheduleLinkedTask(event: CalendarEventRow) {
    const taskId = event.task_id;
    if (!taskId) {
      return {
        ok: false as const,
        error: "This event is not linked to a task.",
      };
    }
    calendarMutations.unscheduleLinkedTask(event);
    offerUndo("Task returned to the backlog", {
      kind: "restore-event",
      operation: "unschedule",
      eventId: event.id,
      deletedAt: event.deleted_at,
      linkedTask: {
        taskId,
        dueAt: event.starts_at,
      },
    });
    return { ok: true as const };
  }

  function handleToggleTask(taskId: string, done: boolean) {
    calendarMutations.toggleTaskStatus(taskId, done);
  }

  function handleQuickAddTask(
    title: string,
    bucket: "week" | "month" | "none",
  ) {
    calendarMutations.quickAddTask({ title, bucket });
  }

  function handleScheduleTask(taskId: string, startsAt: string) {
    const task = todayTasks.find((entry) => entry.id === taskId);
    calendarMutations.scheduleTask({
      taskId,
      title: task?.title ?? "Task",
      startsAt,
      operationKey: crypto.randomUUID(),
      onCommitted: () => toast("Task scheduled"),
    });
  }

  const { applyMonthMove } = useMonthMutations({
    scope,
    view,
    anchor: anchorDate,
    onRecurringEventMove: (move) => {
      setOverlayPendingMoves(
        new Map([[move.event.id, { startsAt: move.startsAt, endsAt: move.endsAt }]]),
      );
      setPendingRecurrence({
        kind: "move",
        operation: move.operation,
        event: move.event,
        startsAt: move.startsAt,
        endsAt: move.endsAt,
      });
    },
    onEventMoveCommitted: (move) =>
      offerUndo(
        move.operation === "resize" ? "Event resized" : "Event moved",
        priorTimesUndo(move.event, move.operation),
      ),
  });

  function clearRecurrenceHold() {
    setPendingMovesClearToken((token) => token + 1);
    setOverlayPendingMoves(new Map());
  }

  function handleEventTimesChange(input: {
    operation: "move" | "resize";
    event: CalendarEventRow;
    startsAt: string;
    endsAt: string;
  }) {
    const target = resolveEventMutationTarget(input.event);
    if (!target) {
      toast("This event has an invalid recurrence identity.", {
        tone: "error",
      });
      return;
    }
    if (target.kind !== "standalone") {
      setOverlayPendingMoves(
        new Map([
          [input.event.id, { startsAt: input.startsAt, endsAt: input.endsAt }],
        ]),
      );
      beginPendingRecurrence({ kind: "move", ...input });
      return;
    }

    calendarMutations.moveEventTimes({
      eventId: target.eventId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
    offerUndo(
      input.operation === "resize" ? "Event resized" : "Event moved",
      priorTimesUndo(input.event, input.operation),
    );
  }

  function executePendingRecurrence(scopeChoice: RecurrenceMutationScope) {
    if (!pendingRecurrence) return;
    const target = resolveEventMutationTarget(pendingRecurrence.event);
    if (!target || target.kind === "standalone") {
      clearRecurrenceHold();
      setPendingRecurrence(null);
      return;
    }
    const masterId =
      target.kind === "series-master" ? target.masterId : target.masterId;
    const recurrenceId =
      target.kind === "series-master"
        ? pendingRecurrence.event.starts_at
        : target.recurrenceId;

    // This-occurrence panel save: optimistic patch + no intersecting invalidate.
    if (pendingRecurrence.kind === "save" && scopeChoice === "this") {
      const held = pendingRecurrence;
      const payload = held.payload;
      const operationKey = crypto.randomUUID();
      setPendingRecurrence(null);
      calendarMutations.commitRecurringThisSave({
        eventId: held.event.id,
        payload,
        action: () =>
          updateRecurringEventAction({
            masterId,
            recurrenceId,
            operationKey,
            scope: "this",
            ...payload,
          }),
        onSuccess: () => {
          clearRecurrenceHold();
          toast("Recurring event saved");
        },
        onError: () => {
          clearRecurrenceHold();
        },
      });
      return;
    }

    // This-occurrence move/resize: optimistic patch + no intersecting invalidate.
    if (pendingRecurrence.kind === "move" && scopeChoice === "this") {
      const held = pendingRecurrence;
      const payload = recurrencePayload(held);
      const operationKey = crypto.randomUUID();
      setPendingRecurrence(null);
      calendarMutations.commitRecurringThisMove({
        eventId: held.event.id,
        startsAt: held.startsAt,
        endsAt: held.endsAt,
        action: () =>
          updateRecurringEventAction({
            masterId,
            recurrenceId,
            operationKey,
            scope: "this",
            ...payload,
          }),
        onSuccess: (data) => {
          clearRecurrenceHold();
          const isResize = held.operation === "resize";
          offerUndo(
            isResize ? "Recurring event resized" : "Recurring event moved",
            {
              kind: "restore-series",
              operation: isResize ? "recurrence-resize" : "recurrence-move",
              ...data.undo,
            },
          );
        },
        onError: () => {
          clearRecurrenceHold();
        },
      });
      return;
    }

    startRecurrenceTransition(async () => {
      const operationKey = crypto.randomUUID();
      const result =
        pendingRecurrence.kind === "delete"
          ? await deleteRecurringEventAction({
              masterId,
              recurrenceId,
              operationKey,
              scope: scopeChoice,
            })
          : await updateRecurringEventAction({
              masterId,
              recurrenceId,
              operationKey,
              scope: scopeChoice,
              ...recurrencePayload(pendingRecurrence),
            });

      if (!result.ok) {
        toast(result.error, { tone: "error" });
        clearRecurrenceHold();
        return;
      }

      if (pendingRecurrence.kind === "delete") {
        offerUndo("Recurring event deleted", {
          kind: "restore-series",
          operation: "recurrence-delete",
          ...result.data.undo,
        });
      } else if (pendingRecurrence.kind === "move") {
        const isResize = pendingRecurrence.operation === "resize";
        offerUndo(
          isResize ? "Recurring event resized" : "Recurring event moved",
          {
            kind: "restore-series",
            operation: isResize ? "recurrence-resize" : "recurrence-move",
            ...result.data.undo,
          },
        );
      } else {
        toast("Recurring event saved");
      }

      const windowStart = pendingRecurrence.event.starts_at.slice(0, 10);
      const windowEnd = pendingRecurrence.event.ends_at.slice(0, 10);
      const movedWindow =
        pendingRecurrence.kind === "move"
          ? {
              start: pendingRecurrence.startsAt.slice(0, 10),
              end: pendingRecurrence.endsAt.slice(0, 10),
            }
          : null;

      setPendingRecurrence(null);
      clearRecurrenceHold();
      // following/all (and non-this saves/deletes) still need surgical refetch.
      invalidateIntersecting({
        scope,
        start: movedWindow?.start ?? windowStart,
        end: movedWindow?.end ?? windowEnd,
      });
    });
  }

  const editingEvent =
    eventPanel?.mode === "edit"
      ? (events.find((event) => event.id === eventPanel.eventId) ??
        eventPanel.event)
      : null;
  const editingTarget =
    eventPanel?.mode === "edit" ? eventPanel.mutationTarget : null;
  const crossLinkEventId =
    editingTarget?.kind === "standalone"
      ? editingTarget.eventId
      : editingTarget?.kind === "series-master" ||
          editingTarget?.kind === "series-instance"
        ? editingTarget.masterId
        : null;

  const handleDismissOverlay = useCallback(() => {
    if (crossLinkPanel) {
      setCrossLinkPanel(null);
      return true;
    }
    if (eventPanel) {
      closeEventPanel();
      return true;
    }
    if (planningDrawerOpen) {
      setPlanningDrawerOpen(false);
      return true;
    }
    return false;
  }, [closeEventPanel, crossLinkPanel, eventPanel, planningDrawerOpen]);

  // Escape while the create/edit popover is open (title field focused, etc.).
  // Calendar hotkeys stay disabled for other shortcuts so typing isn't stolen.
  useEffect(() => {
    if (!eventPanel) return;
    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== "Escape") return;
      if (keyEvent.defaultPrevented) return;
      if (crossLinkPanel) return;
      keyEvent.preventDefault();
      keyEvent.stopPropagation();
      closeEventPanel();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [closeEventPanel, crossLinkPanel, eventPanel]);

  useCalendarHotkeys({
    cheatSheetOpen,
    enabled: !eventPanel,
    onCheatSheetOpenChange: setCheatSheetOpen,
    onViewChange: handleStandardViewChange,
    onNavigateToday: handleNavigateToday,
    onCreateEvent: handleHotkeyCreateEvent,
    onDismiss: handleDismissOverlay,
  });

  const visibleWeekStart = startOfWeekSunday(anchorDate);

  const planningSidebar = (
    <CalendarPlanningSidebar
      calendars={calendars}
      events={events}
      todayTasks={todayTasks}
      weekStart={visibleWeekStart}
      onSelectDay={handleStandardSelectDay}
      onToggleVisibility={handleToggleVisibility}
      onCreateCalendar={handleCreateCalendar}
      onUpdateCalendar={handleUpdateCalendar}
      onSetDefaultCalendar={handleSetDefaultCalendar}
      onSubscribeIcs={handleSubscribeIcs}
      onSyncConnection={handleSyncConnection}
      onToggleTask={handleToggleTask}
      onQuickAddTask={handleQuickAddTask}
      onCollapse={() => setSidebarCollapsedFromUser(true)}
      clearRevealChrome={showRevealChrome}
    />
  );

  return (
    <section
      aria-labelledby="calendar-product-title"
      aria-busy={isFetchingNewRange || metaPending}
      className="flex h-full w-full flex-col bg-calendar-chrome"
    >
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <CalendarDndContext
          onScheduleTask={handleScheduleTask}
          onMonthMove={applyMonthMove}
          onUnscheduleTaskEvent={(eventId) => {
            const event = events.find((candidate) => candidate.id === eventId);
            if (event) void handleUnscheduleLinkedTask(event);
          }}
        >
          {/*
            Plain aside (not motion): Framer width animate applies on a later
            frame than React useLayoutEffect, so skeleton→ready and hard-refresh
            remounts painted DEFAULT then sprang/snapped open. Static width +
            CSS transition only after user toggle keeps load instant.
            Until prefs restore, planning-rail-boot uses the beforeInteractive
            localStorage script so SSR/loading HTML is not stuck at DEFAULT.
          */}
          <aside
            aria-hidden={sidebarCollapsed}
            inert={sidebarCollapsed}
            className={cn(
              "hidden shrink-0 overflow-hidden bg-calendar-chrome lg:flex lg:flex-col",
              !planningPrefsRestored && "planning-rail-boot",
              sidebarCollapsed && "pointer-events-none",
            )}
            style={
              planningPrefsRestored
                ? {
                    width: sidebarCollapsed ? 0 : planningWidth,
                    transition:
                      planningMotionEnabled &&
                      !isPlanningResizing &&
                      !prefersReducedMotion
                        ? "width var(--sidebar-motion-duration-enter) var(--sidebar-motion-ease-out)"
                        : "none",
                  }
                : undefined
            }
          >
            <div
              className="relative flex h-full shrink-0 flex-col overflow-hidden"
              style={{ width: planningWidth }}
            >
              <div className="min-h-0 flex-1 overflow-y-auto">
                {planningSidebar}
              </div>
              <CalendarResizeHandle
                width={planningWidth}
                onWidthChange={handlePlanningWidthChange}
                onCollapse={() => setSidebarCollapsedFromUser(true)}
                onResizeStart={() => setIsPlanningResizing(true)}
                onResizeEnd={() => setIsPlanningResizing(false)}
              />
            </div>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-calendar-chrome">
            <div
              className={cn(
                "shrink-0 pr-6 pt-5 pb-3",
                showRevealChrome && sidebarCollapsed
                  ? "pl-[length:var(--sidebar-reveal-safe-inset)]"
                  : "pl-6",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <AnimatePresence initial={false}>
                    {planningPrefsRestored && sidebarCollapsed ? (
                      <motion.button
                        key="show-planning"
                        type="button"
                        aria-label="Show agenda"
                        onClick={() => setSidebarCollapsedFromUser(false)}
                        initial={
                          prefersReducedMotion || !planningMotionEnabled
                            ? false
                            : { opacity: 0, scale: 0.92 }
                        }
                        animate={{ opacity: 1, scale: 1 }}
                        exit={
                          prefersReducedMotion
                            ? undefined
                            : { opacity: 0, scale: 0.92 }
                        }
                        transition={
                          prefersReducedMotion || !planningMotionEnabled
                            ? { duration: 0 }
                            : PLANNING_TOGGLE_TRANSITION
                        }
                        className="hidden size-8 shrink-0 items-center justify-center rounded-lg text-text-muted outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink lg:flex"
                      >
                        <PanelLeft aria-hidden="true" className="size-4" />
                      </motion.button>
                    ) : null}
                  </AnimatePresence>
                  <h1
                    id="calendar-product-title"
                    className="text-h2 font-medium tracking-tight text-ink"
                  >
                    Calendar
                  </h1>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-product-body font-medium text-ink outline-none hover:bg-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink lg:hidden"
                  onClick={() => setPlanningDrawerOpen(true)}
                >
                  Agenda
                </button>
              </div>
              <div className="mt-4">
                <CalendarToolbar
                  anchor={anchorDate}
                  view={view}
                  scope={scope}
                  navMotion={navMotion}
                  prefersReducedMotion={prefersReducedMotion}
                  onViewChange={handleStandardViewChange}
                  onScopeChange={changeScope}
                  onNavigatePrevious={handleNavigatePrevious}
                  onNavigateNext={handleNavigateNext}
                  onNavigateToday={() => handleNavigateToday(new Date())}
                />
              </div>
            </div>

            <CalendarViewTransition
              view={view}
              anchor={anchorDate}
              navMotion={navMotion}
              prefersReducedMotion={prefersReducedMotion}
              isFetchingNewRange={isFetchingNewRange}
              className="pt-2"
            >
              <div
                ref={gridContainerRef}
                className="flex min-h-0 flex-1 flex-col"
              >
                {view === "year" ? (
                  <YearView
                    year={anchorDate.getFullYear()}
                    onSelectDay={handleStandardSelectDay}
                  />
                ) : (
                  <CalendarGridEngine
                    className="min-h-0 flex-1"
                    view={view}
                    anchor={anchorDate}
                    calendars={calendars}
                    events={events}
                    taskDues={taskDues}
                    draftCreateEvent={draftCreateEvent}
                    overlayPendingMoves={overlayPendingMoves}
                    pendingMovesClearToken={pendingMovesClearToken}
                    onDraftSelecting={handleDraftSelecting}
                    onSlotSelect={openCreateEventPanel}
                    onEventSelect={openEditEventPanel}
                    onEventTimesChange={handleEventTimesChange}
                    onUnscheduleTaskEvent={(event) => {
                      void handleUnscheduleLinkedTask(event);
                    }}
                    onToggleTask={handleToggleTask}
                    onOpenDay={handleStandardSelectDay}
                    onNavigateMonth={(offset) =>
                      offset > 0
                        ? handleNavigateNext()
                        : handleNavigatePrevious()
                    }
                  />
                )}
              </div>
            </CalendarViewTransition>
          </div>

          {planningDrawerOpen ? (
            <div className="fixed inset-0 z-40 lg:hidden">
              <button
                type="button"
                aria-label="Close agenda"
                className="absolute inset-0 bg-ink/40"
                onClick={() => setPlanningDrawerOpen(false)}
              />
              <div className="calendar-rail-glass absolute inset-y-0 right-0 flex w-[min(100%,20rem)] flex-col shadow-spotlight">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="text-product-body font-medium text-ink">
                    Agenda
                  </p>
                  <button
                    type="button"
                    onClick={() => setPlanningDrawerOpen(false)}
                    className="rounded-md px-2 py-1 text-product-meta text-text-secondary outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    Close
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <CalendarPlanningSidebar
                    calendars={calendars}
                    events={events}
                    todayTasks={todayTasks}
                    weekStart={visibleWeekStart}
                    onSelectDay={(day) => {
                      handleStandardSelectDay(day);
                      setPlanningDrawerOpen(false);
                    }}
                    onToggleVisibility={handleToggleVisibility}
                    onCreateCalendar={handleCreateCalendar}
                    onUpdateCalendar={handleUpdateCalendar}
                    onSetDefaultCalendar={handleSetDefaultCalendar}
                    onSubscribeIcs={handleSubscribeIcs}
                    onSyncConnection={handleSyncConnection}
                    onToggleTask={handleToggleTask}
                    onQuickAddTask={handleQuickAddTask}
                    onCollapse={() => setPlanningDrawerOpen(false)}
                    hideCollapseControl
                  />
                </div>
              </div>
            </div>
          ) : null}
        </CalendarDndContext>
      </div>

      <CalendarShortcutsCheatSheet
        open={cheatSheetOpen}
        onClose={() => setCheatSheetOpen(false)}
      />

      <EventRecurrenceScopeDialog
        open={pendingRecurrence !== null}
        action={
          pendingRecurrence?.kind === "delete"
            ? "delete"
            : pendingRecurrence?.kind === "move"
              ? "move"
              : "edit"
        }
        isPending={recurrencePending}
        onClose={() => {
          if (!recurrencePending) {
            clearRecurrenceHold();
            setPendingRecurrence(null);
          }
        }}
        onChoose={executePendingRecurrence}
      />

      {/*
        AnimatePresence stays mounted and the card is the conditional child —
        mounting the two together gives it nothing to transition from, and the
        popover sticks at its `initial` values (invisible) forever.

        Two keys, deliberately different. The animated shell keys on the card's
        identity only ("create", or the event being edited), so re-opening create
        never hands AnimatePresence a new child mid-flight. The form inside keys
        on the create session, which is how a genuinely new create resets the
        fields: React remounting it, rather than an effect rewriting state.
      */}
      <AnimatePresence mode="wait">
        {eventPanel ? (
          <EventDetailPopover
            key={eventPanel.mode === "create" ? "create" : eventPanel.eventId}
            anchorRect={eventPanel.anchorRect}
            mouseContainerRef={gridContainerRef}
            suppressDismiss={crossLinkPanel !== null}
            onClose={() => closeEventPanel()}
          >
            <EventDetailPanel
              key={
                eventPanel.mode === "create"
                  ? eventPanel.sessionId
                  : eventPanel.eventId
              }
              mode={eventPanel.mode}
              calendars={calendars}
              event={editingEvent}
              initialRange={
                eventPanel.mode === "create"
                  ? {
                      startsAt: eventPanel.startsAt,
                      endsAt: eventPanel.endsAt,
                    }
                  : undefined
              }
              onClose={closeEventPanel}
              onSave={handleEventPanelSave}
              onDelete={
                eventPanel.mode === "edit" ? handleEventPanelDelete : undefined
              }
              onCompleteLinkedTask={
                eventPanel.mode === "edit"
                  ? handleCompleteLinkedTask
                  : undefined
              }
              onUnscheduleLinkedTask={
                eventPanel.mode === "edit"
                  ? handleUnscheduleLinkedTask
                  : undefined
              }
              onOpenCrossLink={
                eventPanel.mode === "edit" && eventPanel.mutationTarget
                  ? setCrossLinkPanel
                  : undefined
              }
              onDirtyChange={setEventPanelDirty}
              onDraftChange={
                eventPanel.mode === "create" ? handleDraftChange : undefined
              }
              isPending={panelSavePending}
              mutationBlockedMessage={
                eventPanel.mode === "edit" && !eventPanel.mutationTarget
                  ? "This event has an invalid recurrence identity and can't be edited."
                  : null
              }
            />
          </EventDetailPopover>
        ) : null}
      </AnimatePresence>

      {eventPanel?.mode === "edit" && crossLinkPanel && crossLinkEventId ? (
        <EventCrossLinkDialogs
          eventId={crossLinkEventId}
          panel={crossLinkPanel}
          onClose={() => setCrossLinkPanel(null)}
          onMutationSuccess={() =>
            invalidateActiveRange({ scope, view, anchor: anchorDate })
          }
        />
      ) : null}
    </section>
  );
}
