"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { PanelLeft } from "lucide-react"
import { HotkeysProvider } from "react-hotkeys-hook"
import type { CalendarColor, CalendarEventRow } from "@planevo/core/types/calendar"
import { toast } from "@/components/ui/toast"
import { useSidebarLayout } from "@/features/shell/sidebar-layout-context"
import { centeredAnchorRectFromElement } from "@/lib/calendar/event-popover-position"
import { draftCreateCardAnchorRect } from "@/lib/calendar/event-popover-anchor"
import type { DraftCreateEventState } from "@/lib/calendar/rbc-event-adapter"
import { CALENDAR_HOTKEY_SCOPE } from "@/lib/calendar/calendar-shortcut-map"
import { startOfWeekSunday } from "@/lib/calendar/calendar-navigation"
import {
  DEFAULT_PLANNING_WIDTH,
  getPlanningCollapsed,
  getPlanningWidth,
  setPlanningCollapsed,
} from "@/lib/calendar/planning-prefs"
import {
  getCalendarScope,
  setCalendarScope,
  type CalendarScope,
} from "@/lib/calendar/scope-prefs"
import { getShellLayoutTransition } from "@/lib/motion/shell-spring"
import { usePrefersReducedMotion } from "@/lib/motion/use-prefers-reduced-motion"
import { cn } from "@/lib/utils"
import {
  createCalendarAction,
  createCalendarEventAction,
  deleteCalendarEventAction,
  quickAddTaskAction,
  scheduleTaskFromDragAction,
  setTaskStatusAction,
  toggleCalendarVisibilityAction,
  updateCalendarEventAction,
  updateEventTimesAction,
} from "@/app/(workspace)/calendar/actions"
import { EventDetailPopover } from "./event-detail-popover"
import { CalendarDndContext } from "./calendar-dnd-context"
import { useMonthMutations } from "./use-month-mutations"
import { CalendarGridEngine } from "./calendar-grid-engine"
import { CalendarPlanningSidebar } from "./calendar-planning-sidebar"
import { CalendarResizeHandle } from "./calendar-resize-handle"
import { CalendarShortcutsCheatSheet } from "./calendar-shortcuts-cheat-sheet"
import { CalendarToolbar } from "./calendar-toolbar"
import {
  EventDetailPanel,
  type EventPanelSavePayload,
} from "./event-detail-panel"
import {
  EventCrossLinkDialogs,
  type EventCrossLinkPanel,
} from "./event-cross-links"
import {
  useCalendarData,
  useInvalidateCalendarData,
} from "./use-calendar-data"
import { useCalendarHotkeys } from "./use-calendar-hotkeys"
import { useCalendarNavigation } from "./use-calendar-navigation"
import { YearView } from "./year-view"
import { CalendarViewTransition } from "./calendar-view-transition"

type CalendarProductViewProps = {
  initialScope: CalendarScope
  workspaceId: string | null
}

type EventPanelState =
  | {
      mode: "create"
      /**
       * Identifies one create session. The panel echoes its times back up
       * through `onDraftChange`, so anything derived from `startsAt` — the
       * popover key, the panel's form seed — would remount and wipe the form
       * on every edit. Those both key off this instead, which only changes
       * when a genuinely new create starts.
       */
      sessionId: string
      startsAt: string
      endsAt: string
      anchorRect: DOMRect
    }
  | { mode: "edit"; eventId: string; anchorRect: DOMRect }
  | null

const PLANNING_TOGGLE_TRANSITION = {
  duration: 0.15,
  ease: [0.16, 1, 0.3, 1] as const,
}

export function CalendarProductView(props: CalendarProductViewProps) {
  return (
    <HotkeysProvider initiallyActiveScopes={[CALENDAR_HOTKEY_SCOPE]}>
      <CalendarProductViewInner {...props} />
    </HotkeysProvider>
  )
}

function CalendarProductViewInner({
  initialScope,
  workspaceId,
}: CalendarProductViewProps) {
  const { showRevealChrome } = useSidebarLayout()
  const prefersReducedMotion = usePrefersReducedMotion()
  const planningLayoutTransition = getShellLayoutTransition(prefersReducedMotion)
  const [isPending, startTransition] = useTransition()
  const invalidateCalendar = useInvalidateCalendarData()
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
  } = useCalendarNavigation(initialScope)
  const calendarQuery = useCalendarData(scope, view, anchorDate)
  const [now, setNow] = useState(() => new Date())
  const [eventPanel, setEventPanel] = useState<EventPanelState>(null)
  const [eventPanelDirty, setEventPanelDirty] = useState(false)
  const [draftCreateEvent, setDraftCreateEvent] =
    useState<DraftCreateEventState | null>(null)
  const [crossLinkPanel, setCrossLinkPanel] =
    useState<EventCrossLinkPanel | null>(null)
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false)
  const [planningDrawerOpen, setPlanningDrawerOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [planningWidth, setPlanningWidthState] = useState(DEFAULT_PLANNING_WIDTH)
  const [isPlanningResizing, setIsPlanningResizing] = useState(false)
  const [planningPrefsRestored, setPlanningPrefsRestored] = useState(false)
  // Enter/exit chrome motion only after restore has painted — otherwise the
  // "Show agenda" control fades in on every refresh when the rail was closed.
  const [planningChromeMotionReady, setPlanningChromeMotionReady] =
    useState(false)
  const gridContainerRef = useRef<HTMLDivElement>(null)

  const calendars = calendarQuery.data?.calendars ?? []
  const events = calendarQuery.data?.events ?? []
  const taskDues = calendarQuery.data?.taskDues ?? []
  const todayTasks = calendarQuery.data?.todayTasks ?? []
  const isFetchingNewRange =
    calendarQuery.isFetching && !calendarQuery.isPlaceholderData

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60 * 1000)
    return () => window.clearInterval(timer)
  }, [])

  // Restore before paint, then mount the rail at the saved width. Mounting only
  // after restore avoids Framer springing open→closed on every refresh.
  useLayoutEffect(() => {
    setSidebarCollapsed(getPlanningCollapsed())
    setPlanningWidthState(getPlanningWidth())
    setPlanningPrefsRestored(true)
  }, [])

  useEffect(() => {
    if (!planningPrefsRestored) return
    setPlanningChromeMotionReady(true)
  }, [planningPrefsRestored])

  useEffect(() => {
    if (!planningPrefsRestored) return
    setPlanningCollapsed(sidebarCollapsed)
  }, [planningPrefsRestored, sidebarCollapsed])

  useEffect(() => {
    const storedScope = getCalendarScope()
    if (storedScope === scope) return
    if (storedScope === "workspace" && !workspaceId) {
      setCalendarScope("all")
      return
    }
    setCalendarScope(storedScope)
    setScope(storedScope)
  }, [scope, setScope, workspaceId])

  function handlePlanningWidthChange(nextWidth: number) {
    setPlanningWidthState(nextWidth)
  }

  function changeScope(nextScope: CalendarScope) {
    if (nextScope === "workspace" && !workspaceId) {
      toast("Open a workspace before using this filter", { tone: "error" })
      return
    }
    setCalendarScope(nextScope)
    setScope(nextScope)
    invalidateCalendar(nextScope)
  }

  function handleToggleVisibility(calendarId: string, isVisible: boolean) {
    startTransition(async () => {
      const result = await toggleCalendarVisibilityAction({
        calendarId,
        isVisible,
      })
      if (!result.ok) toast(result.error, { tone: "error" })
      invalidateCalendar(scope)
    })
  }

  function handleCreateCalendar(name: string, color: CalendarColor) {
    startTransition(async () => {
      const result = await createCalendarAction({ name, color })
      if (!result.ok) {
        toast(result.error, { tone: "error" })
        return
      }
      toast("Calendar created")
      invalidateCalendar(scope)
    })
  }

  const closeEventPanel = useCallback(
    (options?: { force?: boolean }) => {
      // Create flow matches Google Calendar: Escape / outside click / Cancel
      // always discards the draft with no confirm prompt.
      const isCreate = eventPanel?.mode === "create"
      if (
        !options?.force &&
        !isCreate &&
        eventPanelDirty &&
        !window.confirm("Discard unsaved changes?")
      ) {
        return
      }
      setEventPanel(null)
      setEventPanelDirty(false)
      setCrossLinkPanel(null)
      setDraftCreateEvent(null)
    },
    [eventPanel?.mode, eventPanelDirty],
  )

  function resolveFallbackAnchorRect(): DOMRect {
    if (gridContainerRef.current) {
      return centeredAnchorRectFromElement(gridContainerRef.current)
    }
    return new DOMRect(
      window.innerWidth / 2 - 80,
      window.innerHeight / 2 - 24,
      160,
      48,
    )
  }

  const handleDraftSelecting = useCallback(
    (range: { startsAt: Date; endsAt: Date }) => {
      setDraftCreateEvent((current) => ({
        startsAt: range.startsAt.toISOString(),
        endsAt: range.endsAt.toISOString(),
        title: current?.title ?? "",
        calendarId: current?.calendarId ?? calendars[0]?.id ?? "",
      }))
    },
    [calendars],
  )

  function openCreateEventPanel(
    range: { startsAt: Date; endsAt: Date },
    anchorRect?: DOMRect,
  ) {
    if (eventPanelDirty && !window.confirm("Discard unsaved changes?")) return
    setCrossLinkPanel(null)
    const startsAt = range.startsAt.toISOString()
    const endsAt = range.endsAt.toISOString()
    setDraftCreateEvent((current) => ({
      startsAt,
      endsAt,
      title: current?.title ?? "",
      calendarId: current?.calendarId ?? calendars[0]?.id ?? "",
    }))
    setEventPanel({
      mode: "create",
      sessionId: crypto.randomUUID(),
      startsAt,
      endsAt,
      anchorRect: anchorRect ?? resolveFallbackAnchorRect(),
    })
    setEventPanelDirty(false)
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
      })
      setEventPanel((current) =>
        current?.mode === "create"
          ? {
              ...current,
              startsAt: payload.startsAt,
              endsAt: payload.endsAt,
            }
          : current,
      )
    },
    [],
  )

  useLayoutEffect(() => {
    if (eventPanel?.mode !== "create") return
    const draftAnchor = draftCreateCardAnchorRect(gridContainerRef.current)
    if (!draftAnchor) return
    setEventPanel((current) => {
      if (current?.mode !== "create") return current
      const { anchorRect } = current
      const same =
        anchorRect.left === draftAnchor.left &&
        anchorRect.top === draftAnchor.top &&
        anchorRect.width === draftAnchor.width &&
        anchorRect.height === draftAnchor.height
      if (same) return current
      return { ...current, anchorRect: draftAnchor }
    })
  }, [
    eventPanel?.mode,
    draftCreateEvent?.startsAt,
    draftCreateEvent?.endsAt,
    draftCreateEvent?.title,
    draftCreateEvent?.calendarId,
  ])

  useEffect(() => {
    if (view === "day" || view === "week") return
    setDraftCreateEvent(null)
  }, [view])

  useEffect(() => {
    if (!draftCreateEvent || eventPanel) return
    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== "Escape") return
      setDraftCreateEvent(null)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [draftCreateEvent, eventPanel])

  function openEditEventPanel(event: CalendarEventRow, anchorRect: DOMRect) {
    if (eventPanelDirty && !window.confirm("Discard unsaved changes?")) return
    setCrossLinkPanel(null)
    setDraftCreateEvent(null)
    setEventPanel({ mode: "edit", eventId: event.id, anchorRect })
    setEventPanelDirty(false)
  }

  function handleHotkeyCreateEvent(range: { startsAt: Date; endsAt: Date }) {
    openCreateEventPanel(range, resolveFallbackAnchorRect())
  }

  function handleEventPanelSave(payload: EventPanelSavePayload) {
    if (!eventPanel) return

    startTransition(async () => {
      if (eventPanel.mode === "create") {
        const result = await createCalendarEventAction(payload)
        if (!result.ok) {
          toast(result.error, { tone: "error" })
          return
        }
        toast("Event created")
      } else {
        const result = await updateCalendarEventAction({
          eventId: eventPanel.eventId,
          ...payload,
        })
        if (!result.ok) {
          toast(result.error, { tone: "error" })
          return
        }
        toast("Event saved")
      }
      setEventPanel(null)
      setEventPanelDirty(false)
      setDraftCreateEvent(null)
      invalidateCalendar(scope)
    })
  }

  async function handleEventPanelDelete(eventId: string) {
    const result = await deleteCalendarEventAction({ eventId })
    if (!result.ok) {
      return { ok: false as const, error: result.error }
    }
    toast("Event deleted")
    invalidateCalendar(scope)
    return { ok: true as const }
  }

  function handleToggleTask(taskId: string, done: boolean) {
    startTransition(async () => {
      const result = await setTaskStatusAction({
        taskId,
        status: done ? "done" : "not_started",
      })
      if (!result.ok) {
        toast(result.error, { tone: "error" })
        return
      }
      invalidateCalendar(scope)
    })
  }

  function handleQuickAddTask(
    title: string,
    bucket: "week" | "month" | "none",
  ) {
    startTransition(async () => {
      const result = await quickAddTaskAction({ title, bucket })
      if (!result.ok) {
        toast(result.error, { tone: "error" })
        return
      }
      invalidateCalendar(scope)
    })
  }

  function handleScheduleTask(taskId: string, startsAt: string) {
    startTransition(async () => {
      const result = await scheduleTaskFromDragAction({
        taskId,
        operationKey: crypto.randomUUID(),
        startsAt,
      })
      if (!result.ok) {
        toast(result.error, { tone: "error" })
        return
      }
      toast("Task scheduled")
      invalidateCalendar(scope)
    })
  }

  const { applyMonthMove } = useMonthMutations({
    scope,
    anchor: anchorDate,
    onSettled: () => invalidateCalendar(scope),
  })

  function handleEventTimesChange(input: {
    eventId: string
    startsAt: string
    endsAt: string
  }) {
    startTransition(async () => {
      const result = await updateEventTimesAction(input)
      if (!result.ok) {
        toast(result.error, { tone: "error" })
        invalidateCalendar(scope)
        return
      }
      invalidateCalendar(scope)
    })
  }

  const editingEvent =
    eventPanel?.mode === "edit"
      ? events.find((event) => event.id === eventPanel.eventId) ?? null
      : null

  const handleDismissOverlay = useCallback(() => {
    if (crossLinkPanel) {
      setCrossLinkPanel(null)
      return true
    }
    if (eventPanel) {
      closeEventPanel()
      return true
    }
    if (planningDrawerOpen) {
      setPlanningDrawerOpen(false)
      return true
    }
    return false
  }, [closeEventPanel, crossLinkPanel, eventPanel, planningDrawerOpen])

  // Escape while the create/edit popover is open (title field focused, etc.).
  // Calendar hotkeys stay disabled for other shortcuts so typing isn't stolen.
  useEffect(() => {
    if (!eventPanel) return
    const handleKeyDown = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== "Escape") return
      if (keyEvent.defaultPrevented) return
      keyEvent.preventDefault()
      keyEvent.stopPropagation()
      closeEventPanel()
    }
    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [closeEventPanel, eventPanel])

  useCalendarHotkeys({
    now,
    cheatSheetOpen,
    enabled: !eventPanel,
    onCheatSheetOpenChange: setCheatSheetOpen,
    onViewChange: handleViewChange,
    onNavigateToday: handleNavigateToday,
    onCreateEvent: handleHotkeyCreateEvent,
    onDismiss: handleDismissOverlay,
  })

  const visibleWeekStart = startOfWeekSunday(anchorDate)

  const planningSidebar = (
    <CalendarPlanningSidebar
      calendars={calendars}
      events={events}
      todayTasks={todayTasks}
      now={now}
      weekStart={visibleWeekStart}
      onSelectDay={handleSelectDay}
      onToggleVisibility={handleToggleVisibility}
      onCreateCalendar={handleCreateCalendar}
      onToggleTask={handleToggleTask}
      onQuickAddTask={handleQuickAddTask}
      onCollapse={() => setSidebarCollapsed(true)}
      clearRevealChrome={showRevealChrome}
    />
  )

  return (
    <section
      aria-labelledby="calendar-product-title"
      aria-busy={isPending || isFetchingNewRange}
      className="flex h-full w-full flex-col bg-calendar-chrome"
    >
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <CalendarDndContext
      onScheduleTask={handleScheduleTask}
      onMonthMove={applyMonthMove}
    >
          {planningPrefsRestored ? (
            <motion.aside
              initial={{ width: sidebarCollapsed ? 0 : planningWidth }}
              animate={{ width: sidebarCollapsed ? 0 : planningWidth }}
              transition={
                isPlanningResizing
                  ? { duration: 0 }
                  : planningLayoutTransition
              }
              aria-hidden={sidebarCollapsed}
              inert={sidebarCollapsed}
              className={cn(
                "hidden shrink-0 overflow-hidden bg-calendar-chrome lg:flex lg:flex-col",
                sidebarCollapsed && "pointer-events-none",
              )}
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
                  onCollapse={() => setSidebarCollapsed(true)}
                  onResizeStart={() => setIsPlanningResizing(true)}
                  onResizeEnd={() => setIsPlanningResizing(false)}
                />
              </div>
            </motion.aside>
          ) : null}

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
                        onClick={() => setSidebarCollapsed(false)}
                        initial={
                          prefersReducedMotion || !planningChromeMotionReady
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
                          prefersReducedMotion || !planningChromeMotionReady
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
                  onViewChange={handleViewChange}
                  onScopeChange={changeScope}
                  onNavigatePrevious={handleNavigatePrevious}
                  onNavigateNext={handleNavigateNext}
                  onNavigateToday={() => handleNavigateToday(now)}
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
              <div ref={gridContainerRef} className="flex min-h-0 flex-1 flex-col">
              {view === "year" ? (
                <YearView
                  year={anchorDate.getFullYear()}
                  today={now}
                  onSelectDay={handleSelectDay}
                />
              ) : (
                <CalendarGridEngine
                  className="min-h-0 flex-1"
                  view={view}
                  anchor={anchorDate}
                  calendars={calendars}
                  events={events}
                  taskDues={taskDues}
                  now={now}
                  draftCreateEvent={draftCreateEvent}
                  onDraftSelecting={handleDraftSelecting}
                  onSlotSelect={openCreateEventPanel}
                  onEventSelect={openEditEventPanel}
                  onEventTimesChange={handleEventTimesChange}
                  onToggleTask={handleToggleTask}
                  onOpenDay={handleSelectDay}
                  onNavigateMonth={(offset) =>
                    offset > 0 ? handleNavigateNext() : handleNavigatePrevious()
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
                    now={now}
                    weekStart={visibleWeekStart}
                    onSelectDay={(day) => {
                      handleSelectDay(day)
                      setPlanningDrawerOpen(false)
                    }}
                    onToggleVisibility={handleToggleVisibility}
                    onCreateCalendar={handleCreateCalendar}
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
              onOpenCrossLink={
                eventPanel.mode === "edit" ? setCrossLinkPanel : undefined
              }
              onDirtyChange={setEventPanelDirty}
              onDraftChange={
                eventPanel.mode === "create" ? handleDraftChange : undefined
              }
              isPending={isPending}
            />
          </EventDetailPopover>
        ) : null}
      </AnimatePresence>

      {eventPanel?.mode === "edit" && crossLinkPanel ? (
        <EventCrossLinkDialogs
          eventId={eventPanel.eventId}
          panel={crossLinkPanel}
          onClose={() => setCrossLinkPanel(null)}
          onMutationSuccess={() => invalidateCalendar(scope)}
        />
      ) : null}
    </section>
  )
}
