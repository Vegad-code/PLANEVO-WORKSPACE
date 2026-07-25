"use client"

import { useEffect, useState, useTransition } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { PanelLeft } from "lucide-react"
import type { CalendarColor, CalendarEventRow } from "@planevo/core/types/calendar"
import { toast } from "@/components/ui/toast"
import { useSidebarLayout } from "@/features/shell/sidebar-layout-context"
import { startOfWeekSunday } from "@/lib/calendar/calendar-navigation"
import {
  DEFAULT_PLANNING_WIDTH,
  getPlanningWidth,
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
  quickAddTaskAction,
  scheduleTaskFromDragAction,
  setTaskStatusAction,
  toggleCalendarVisibilityAction,
  updateEventTimesAction,
} from "@/app/(workspace)/calendar/actions"
import { CalendarDndContext } from "./calendar-dnd-context"
import { CalendarGridEngine } from "./calendar-grid-engine"
import { CalendarPlanningSidebar } from "./calendar-planning-sidebar"
import { CalendarResizeHandle } from "./calendar-resize-handle"
import { CalendarToolbar } from "./calendar-toolbar"
import { CreateEventPopover, type CreateEventInput } from "./create-event-popover"
import {
  EventCrossLinkDialogs,
  type EventCrossLinkPanel,
} from "./event-cross-links"
import { EventPeek } from "./event-peek"
import {
  useCalendarData,
  useInvalidateCalendarData,
} from "./use-calendar-data"
import { useCalendarNavigation } from "./use-calendar-navigation"
import { YearView } from "./year-view"
import { CalendarViewTransition } from "./calendar-view-transition"

type CalendarProductViewProps = {
  initialScope: CalendarScope
  workspaceId: string | null
}

type SelectedEvent = {
  event: CalendarEventRow
  anchor: HTMLElement
}

const PLANNING_TOGGLE_TRANSITION = {
  duration: 0.15,
  ease: [0.16, 1, 0.3, 1] as const,
}

export function CalendarProductView({
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
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(null)
  const [crossLinkPanel, setCrossLinkPanel] =
    useState<EventCrossLinkPanel | null>(null)
  const [createSlot, setCreateSlot] = useState<Date | null>(null)
  const [planningDrawerOpen, setPlanningDrawerOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [planningWidth, setPlanningWidthState] = useState(DEFAULT_PLANNING_WIDTH)
  const [isPlanningResizing, setIsPlanningResizing] = useState(false)
  const [planningWidthRestored, setPlanningWidthRestored] = useState(false)

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

  useEffect(() => {
    setPlanningWidthState(getPlanningWidth())
    setPlanningWidthRestored(true)
  }, [])

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

  function handleCreateEvent(input: CreateEventInput) {
    startTransition(async () => {
      const result = await createCalendarEventAction(input)
      if (!result.ok) {
        toast(result.error, { tone: "error" })
        return
      }
      setCreateSlot(null)
      toast("Event created")
      invalidateCalendar(scope)
    })
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

  const selectedEventCalendar = selectedEvent
    ? calendars.find(
        (calendar) => calendar.id === selectedEvent.event.calendar_id,
      ) ?? null
    : null

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
      className="flex h-full w-full flex-col bg-surface-raised"
    >
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <CalendarDndContext onScheduleTask={handleScheduleTask}>
          <motion.aside
            initial={false}
            animate={{ width: sidebarCollapsed ? 0 : planningWidth }}
            transition={
              isPlanningResizing || !planningWidthRestored
                ? { duration: 0 }
                : planningLayoutTransition
            }
            aria-hidden={sidebarCollapsed}
            inert={sidebarCollapsed}
            className={cn(
              "hidden shrink-0 overflow-hidden bg-surface-raised lg:flex lg:flex-col",
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

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-raised">
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
                    {sidebarCollapsed ? (
                      <motion.button
                        key="show-planning"
                        type="button"
                        aria-label="Show agenda"
                        onClick={() => setSidebarCollapsed(false)}
                        initial={
                          prefersReducedMotion
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
                          prefersReducedMotion
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
                  onSlotSelect={setCreateSlot}
                  onEventSelect={(event, anchor) =>
                    setSelectedEvent({ event, anchor })
                  }
                  onEventTimesChange={handleEventTimesChange}
                  onToggleTask={handleToggleTask}
                  onOpenDay={handleSelectDay}
                />
              )}
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
          onMutationSuccess={() => invalidateCalendar(scope)}
        />
      ) : null}
    </section>
  )
}
