"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"
import { PanelLeft } from "lucide-react"
import {
  addWeeks,
  weekParam,
  weekRange,
} from "@planevo/core/state/calendar-state"
import type {
  CalendarColor,
  CalendarEventRow,
  CalendarRow,
  TaskDueChip,
} from "@planevo/core/types/calendar"
import { toast } from "@/components/ui/toast"
import { useSidebarLayout } from "@/features/shell/sidebar-layout-context"
import {
  DEFAULT_PLANNING_WIDTH,
  getPlanningWidth,
} from "@/lib/calendar/planning-prefs"
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
import {
  getCalendarScope,
  setCalendarScope,
  type CalendarScope,
} from "@/lib/calendar/scope-prefs"
import { CalendarDndContext } from "./calendar-dnd-context"
import { CalendarGridEngine } from "./calendar-grid-engine"
import { CalendarPlanningSidebar } from "./calendar-planning-sidebar"
import { CalendarResizeHandle } from "./calendar-resize-handle"
import { CalendarToolbar, type CalendarView } from "./calendar-toolbar"
import { CreateEventPopover, type CreateEventInput } from "./create-event-popover"
import {
  EventCrossLinkDialogs,
  type EventCrossLinkPanel,
} from "./event-cross-links"
import { EventPeek } from "./event-peek"
import type { TodayColumnTask } from "./today-task-row"
import { YearView } from "./year-view"

type CalendarProductViewProps = {
  weekStart: Date
  calendars: CalendarRow[]
  events: CalendarEventRow[]
  /** Reserved for a future all-day / due-chip row; unused while that bar is removed. */
  taskDues: TaskDueChip[]
  todayTasks: TodayColumnTask[]
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

function calendarPath(scope: CalendarScope, week?: string): string {
  const params = new URLSearchParams()
  if (scope === "workspace") params.set("scope", "workspace")
  if (week) params.set("week", week)
  const query = params.toString()
  return query ? `/calendar?${query}` : "/calendar"
}

export function CalendarProductView({
  weekStart,
  calendars,
  events,
  taskDues: _taskDues,
  todayTasks,
  initialScope,
  workspaceId,
}: CalendarProductViewProps) {
  const router = useRouter()
  const { showRevealChrome } = useSidebarLayout()
  const prefersReducedMotion = usePrefersReducedMotion()
  const planningLayoutTransition = getShellLayoutTransition(prefersReducedMotion)
  const [isPending, startTransition] = useTransition()
  const [view, setView] = useState<CalendarView>("week")
  const [now, setNow] = useState(() => new Date())
  const [dayAnchor, setDayAnchor] = useState<Date>(() => {
    const today = new Date()
    const { start, end } = weekRange(weekStart)
    return today >= start && today < end ? today : weekStart
  })
  const [yearAnchor, setYearAnchor] = useState(() => weekStart.getFullYear())
  const [selectedEvent, setSelectedEvent] = useState<SelectedEvent | null>(null)
  const [crossLinkPanel, setCrossLinkPanel] =
    useState<EventCrossLinkPanel | null>(null)
  const [createSlot, setCreateSlot] = useState<Date | null>(null)
  const [planningDrawerOpen, setPlanningDrawerOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [planningWidth, setPlanningWidthState] = useState(DEFAULT_PLANNING_WIDTH)
  const [isPlanningResizing, setIsPlanningResizing] = useState(false)
  const [planningWidthRestored, setPlanningWidthRestored] = useState(false)

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
    if (storedScope === initialScope) return
    if (storedScope === "workspace" && !workspaceId) {
      setCalendarScope("all")
      return
    }
    router.replace(calendarPath(storedScope, weekParam(weekStart)))
  }, [initialScope, router, weekStart, workspaceId])

  function handlePlanningWidthChange(nextWidth: number) {
    setPlanningWidthState(nextWidth)
  }

  function changeScope(scope: CalendarScope) {
    if (scope === "workspace" && !workspaceId) {
      toast("Open a workspace before using this filter", { tone: "error" })
      return
    }
    setCalendarScope(scope)
    router.push(calendarPath(scope, weekParam(weekStart)))
  }

  function navigateToWeekOf(anchor: Date) {
    router.push(calendarPath(initialScope, weekParam(anchor)))
  }

  function handleNavigatePrevious() {
    if (view === "year") {
      setYearAnchor((year) => year - 1)
      return
    }
    if (view === "day") {
      const previousDay = new Date(dayAnchor)
      previousDay.setDate(previousDay.getDate() - 1)
      setDayAnchor(previousDay)
      if (previousDay < weekStart) navigateToWeekOf(previousDay)
      return
    }
    navigateToWeekOf(addWeeks(weekStart, -1))
  }

  function handleNavigateNext() {
    if (view === "year") {
      setYearAnchor((year) => year + 1)
      return
    }
    if (view === "day") {
      const nextDay = new Date(dayAnchor)
      nextDay.setDate(nextDay.getDate() + 1)
      setDayAnchor(nextDay)
      if (nextDay >= weekRange(weekStart).end) navigateToWeekOf(nextDay)
      return
    }
    navigateToWeekOf(addWeeks(weekStart, 1))
  }

  function handleNavigateToday() {
    const today = new Date()
    setDayAnchor(today)
    setYearAnchor(today.getFullYear())
    setView("week")
    router.push(calendarPath(initialScope))
  }

  function handleSelectDay(day: Date) {
    setDayAnchor(day)
    setView("day")
    navigateToWeekOf(day)
  }

  function handleToggleVisibility(calendarId: string, isVisible: boolean) {
    startTransition(async () => {
      const result = await toggleCalendarVisibilityAction({
        calendarId,
        isVisible,
      })
      if (!result.ok) toast(result.error, { tone: "error" })
      router.refresh()
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
      router.refresh()
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
      router.refresh()
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
      router.refresh()
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
      router.refresh()
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
      router.refresh()
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
        router.refresh()
        return
      }
      router.refresh()
    })
  }

  const selectedEventCalendar = selectedEvent
    ? calendars.find(
        (calendar) => calendar.id === selectedEvent.event.calendar_id,
      ) ?? null
    : null

  const gridAnchor = view === "day" ? dayAnchor : weekStart
  const toolbarAnchor =
    view === "year"
      ? new Date(yearAnchor, 0, 1)
      : view === "day"
        ? dayAnchor
        : weekStart

  const planningSidebar = (
    <CalendarPlanningSidebar
      calendars={calendars}
      events={events}
      todayTasks={todayTasks}
      now={now}
      weekStart={weekStart}
      onSelectDay={handleSelectDay}
      onToggleVisibility={handleToggleVisibility}
      onCreateCalendar={handleCreateCalendar}
      onToggleTask={handleToggleTask}
      onQuickAddTask={handleQuickAddTask}
      onCollapse={() => setSidebarCollapsed(true)}
    />
  )

  return (
    <section
      aria-labelledby="calendar-product-title"
      aria-busy={isPending}
      className={cn(
        "flex h-full w-full flex-col bg-surface-raised",
        showRevealChrome && "md:pl-[length:var(--sidebar-reveal-safe-inset)]",
      )}
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

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface-raised pl-2">
            <div className="shrink-0 px-6 pt-5 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <AnimatePresence initial={false}>
                    {sidebarCollapsed ? (
                      <motion.button
                        key="show-planning"
                        type="button"
                        aria-label="Show planning sidebar"
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
                  <div>
                    <p className="text-product-meta text-text-muted">Calendar</p>
                    <h1
                      id="calendar-product-title"
                      className="mt-0.5 text-h1 tracking-tight text-ink"
                    >
                      Calendar
                    </h1>
                  </div>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-product-body font-medium text-ink outline-none hover:bg-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink lg:hidden"
                  onClick={() => setPlanningDrawerOpen(true)}
                >
                  Planning
                </button>
              </div>
              <div className="mt-4">
                <CalendarToolbar
                  anchor={toolbarAnchor}
                  view={view}
                  scope={initialScope}
                  onViewChange={setView}
                  onScopeChange={changeScope}
                  onNavigatePrevious={handleNavigatePrevious}
                  onNavigateNext={handleNavigateNext}
                  onNavigateToday={handleNavigateToday}
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-4 pt-2 pb-4">
              {view === "year" ? (
                <div className="min-h-0 flex-1">
                  <YearView
                    year={yearAnchor}
                    today={now}
                    onSelectDay={handleSelectDay}
                  />
                </div>
              ) : (
                <CalendarGridEngine
                  className="min-h-0 flex-1"
                  view={view}
                  anchor={gridAnchor}
                  calendars={calendars}
                  events={events}
                  onSlotSelect={setCreateSlot}
                  onEventSelect={(event, anchor) =>
                    setSelectedEvent({ event, anchor })
                  }
                  onEventTimesChange={handleEventTimesChange}
                />
              )}
            </div>
          </div>

          {planningDrawerOpen ? (
            <div className="fixed inset-0 z-40 lg:hidden">
              <button
                type="button"
                aria-label="Close planning sidebar"
                className="absolute inset-0 bg-ink/40"
                onClick={() => setPlanningDrawerOpen(false)}
              />
              <div className="calendar-rail-glass absolute inset-y-0 right-0 flex w-[min(100%,20rem)] flex-col shadow-spotlight">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="text-product-body font-medium text-ink">
                    Planning
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
                    weekStart={weekStart}
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
        />
      ) : null}
    </section>
  )
}
