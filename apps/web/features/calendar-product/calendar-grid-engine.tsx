"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Calendar,
  type EventProps,
  type HeaderProps,
  type SlotInfo,
  type View,
} from "react-big-calendar"
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop"
import { format } from "date-fns/format"
import type {
  CalendarDisplayEvent,
  CalendarEventRow,
  CalendarRow,
  TaskDueChip,
} from "@planevo/core/types/calendar"
import {
  getPlanevoEventId,
  isDraftCreateEvent,
  toDraftRbcEvent,
  toRbcEvents,
  type DraftCreateEventState,
  type PlanevoRbcEvent,
} from "@/lib/calendar/rbc-event-adapter"
import { isCalendarEventPast } from "@/lib/calendar/event-is-past"
import { isPointOutsideRect } from "@/lib/calendar/task-event-unschedule-drop"
import { calendarLocalizer } from "@/lib/calendar/rbc-localizer"
import { startOfWeekSunday } from "@/lib/calendar/calendar-navigation"
import { isCalendarToday } from "@/lib/calendar/day-header-model"
import { defaultMonthCreateRange } from "@/lib/calendar/month-day-create"
import { toMonthItems, type MonthItem } from "@/lib/calendar/month-items"
import {
  configForLegacyView,
  resolveRenderer,
} from "@/lib/calendar/view-registry"
import { cn } from "@/lib/utils"
import {
  elementToAnchorRect,
  slotInfoToAnchorRect,
} from "@/lib/calendar/event-popover-anchor"
import { MonthDayAgendaPopover } from "./month-day-agenda-popover"
import { MonthGrid } from "./month-grid"
import { CalendarNowIndicator } from "./calendar-now-indicator"
import { RbcDayHeader } from "./rbc-day-header"
import { RbcNowIndicatorWrapper } from "./rbc-now-indicator-wrapper"
import { RbcEventContent } from "./rbc-event-content"
import { RbcPlanevoEventWrapper } from "./rbc-planevo-event-wrapper"
import { RbcTimeGutterHeader } from "./rbc-time-gutter-header"
import {
  DAY_START_HOUR,
  formatHourLabel,
  VISIBLE_HOURS,
} from "./time-axis"
import "react-big-calendar/lib/css/react-big-calendar.css"
import "react-big-calendar/lib/addons/dragAndDrop/styles.css"

type RbcInteractionInfo = {
  event: PlanevoRbcEvent
  start: Date
  end: Date
  allDay?: boolean
  resourceId?: string | number
}

type DragAndDropCalendarProps = React.ComponentProps<
  typeof Calendar<PlanevoRbcEvent>
> & {
  onEventDrop?: (info: RbcInteractionInfo) => void
  onEventResize?: (info: RbcInteractionInfo) => void
  resizable?: boolean
  draggableAccessor?: (event: PlanevoRbcEvent) => boolean
  resizableAccessor?: (event: PlanevoRbcEvent) => boolean
  onDragStart?: (info: {
    event: PlanevoRbcEvent
    action: "move" | "resize"
    direction: "UP" | "DOWN" | "LEFT" | "RIGHT"
  }) => void
}

const DragAndDropCalendar = withDragAndDrop(
  Calendar,
) as React.ComponentType<DragAndDropCalendarProps>

type CalendarGridEngineProps = {
  view: "day" | "week" | "month"
  anchor: Date
  calendars: CalendarRow[]
  events: CalendarEventRow[]
  taskDues: TaskDueChip[]
  now: Date
  onSlotSelect: (
    range: { startsAt: Date; endsAt: Date },
    anchorRect: DOMRect,
  ) => void
  onDraftSelecting?: (range: { startsAt: Date; endsAt: Date }) => void
  draftCreateEvent?: DraftCreateEventState | null
  onEventSelect: (event: CalendarEventRow, anchorRect: DOMRect) => void
  onEventTimesChange: (input: {
    operation: "move" | "resize"
    event: CalendarEventRow
    startsAt: string
    endsAt: string
  }) => void
  onUnscheduleTaskEvent?: (event: CalendarEventRow) => void
  onToggleTask: (taskId: string, done: boolean) => void
  onOpenDay: (date: Date) => void
  onNavigateMonth: (offset: number) => void
  className?: string
}

const DAY_MIN = new Date(1970, 0, 1, 0, 0, 0)
const DAY_MAX = new Date(1970, 0, 1, 23, 59, 59)

function scrollTimeNearNow(): Date {
  const now = new Date()
  const hour = Math.max(0, now.getHours() - 1)
  const scroll = new Date(now)
  scroll.setHours(hour, 0, 0, 0)
  return scroll
}

function calendarSlotDataAttributes(date: Date) {
  return {
    "data-calendar-day": format(date, "yyyy-MM-dd"),
    "data-calendar-slot-time": format(date, "HH:mm"),
  } as React.HTMLAttributes<HTMLDivElement>
}

/**
 * Picks the grid for the current view.
 *
 * Week and day run on react-big-calendar, whose time grid, now-indicator, and
 * drag/resize are worth keeping. Month runs on its own CSS Grid: RBC measures a
 * single dummy row and applies that one item limit to every week, and its month
 * renderer re-sorts multi-day events ahead of everything else before any
 * caller-supplied order can apply — neither is overridable.
 */
export function CalendarGridEngine({
  view,
  anchor,
  calendars,
  events,
  taskDues,
  now,
  onSlotSelect,
  onDraftSelecting,
  draftCreateEvent = null,
  onEventSelect,
  onEventTimesChange,
  onUnscheduleTaskEvent,
  onToggleTask,
  onOpenDay,
  onNavigateMonth,
  className,
}: CalendarGridEngineProps) {
  const [agenda, setAgenda] = useState<{
    date: Date
    origin: HTMLElement
  } | null>(null)

  // View goes through the registry rather than branching on the string directly,
  // so a saved view's config picks the renderer by the same path the legacy
  // toolbar does.
  const renderer = useMemo(
    () => resolveRenderer(configForLegacyView(view)),
    [view],
  )
  const isMonthView = renderer.id === "month-grid"
  const rbcView: View = renderer.navigationUnit === "day" ? "day" : "week"

  const displayEvents = useMemo<CalendarDisplayEvent[]>(
    () =>
      events.map((event) =>
        "linked_task" in event
          ? (event as CalendarDisplayEvent)
          : { ...event, linked_task: null },
      ),
    [events],
  )
  const timeGridEvents = useMemo(
    () => toRbcEvents(displayEvents, calendars),
    [displayEvents, calendars],
  )
  const draftRbcEvent = useMemo(() => {
    if (!draftCreateEvent) return null
    const color =
      calendars.find((calendar) => calendar.id === draftCreateEvent.calendarId)
        ?.color ?? "ocean"
    return toDraftRbcEvent({ ...draftCreateEvent, color })
  }, [calendars, draftCreateEvent])
  const rbcEvents = useMemo(
    () =>
      draftRbcEvent ? [...timeGridEvents, draftRbcEvent] : timeGridEvents,
    [draftRbcEvent, timeGridEvents],
  )
  const monthItems = useMemo(
    () => toMonthItems(displayEvents, taskDues, calendars),
    [displayEvents, taskDues, calendars],
  )
  const eventsById = useMemo(() => {
    const map = new Map<string, CalendarEventRow>()
    for (const event of events) map.set(event.id, event)
    return map
  }, [events])

  const hasAllDayEvents = useMemo(
    () => timeGridEvents.some((event) => event.allDay),
    [timeGridEvents],
  )

  const scrollToTime = useMemo(() => scrollTimeNearNow(), [])
  const gridRef = useRef<HTMLDivElement>(null)
  const activeRbcTaskDragRef = useRef<PlanevoRbcEvent | null>(null)

  const todayInVisibleRange = useMemo(() => {
    if (view === "day") return isCalendarToday(anchor, now)

    const weekStart = startOfWeekSunday(anchor)
    for (let index = 0; index < 7; index += 1) {
      const day = new Date(weekStart)
      day.setDate(weekStart.getDate() + index)
      if (isCalendarToday(day, now)) return true
    }

    return false
  }, [anchor, now, view])

  const showNowIndicator = useMemo(() => {
    if (isMonthView || !todayInVisibleRange) return false

    const nowHour = now.getHours()
    return (
      nowHour >= DAY_START_HOUR &&
      nowHour < DAY_START_HOUR + VISIBLE_HOURS
    )
  }, [isMonthView, now, todayInVisibleRange, view])

  const timeGridComponents = useMemo(
    () => ({
      toolbar: () => null,
      header: (props: HeaderProps) => (
        <RbcDayHeader
          {...props}
          now={now}
          align={view === "day" ? "start" : "center"}
        />
      ),
      event: (props: EventProps<PlanevoRbcEvent>) => (
        <RbcEventContent {...props} />
      ),
      eventWrapper: RbcPlanevoEventWrapper,
      timeGutterHeader: RbcTimeGutterHeader,
      timeIndicatorWrapper: RbcNowIndicatorWrapper,
    }),
    [now, view],
  )

  const closeAgenda = useCallback(
    (restoreFocus = true) => {
      const origin = agenda?.origin
      setAgenda(null)
      if (restoreFocus && origin?.isConnected) origin.focus()
    },
    [agenda],
  )

  const handleOpenAgenda = useCallback((date: Date, origin: HTMLElement) => {
    setAgenda({ date, origin })
  }, [])

  const handleSelectMonthItem = useCallback(
    (item: MonthItem, anchorEl: HTMLElement) => {
      if (item.kind !== "event") return
      onEventSelect(item.event, elementToAnchorRect(anchorEl))
    },
    [onEventSelect],
  )

  const handleSelecting = useCallback(
    (range: { start: Date; end: Date }) => {
      onDraftSelecting?.({
        startsAt: range.start,
        endsAt: range.end,
      })
      return true
    },
    [onDraftSelecting],
  )

  const handleSelectSlot = useCallback(
    (slotInfo: SlotInfo) =>
      onSlotSelect(
        { startsAt: slotInfo.start, endsAt: slotInfo.end },
        slotInfoToAnchorRect(slotInfo, gridRef.current),
      ),
    [onSlotSelect],
  )

  const handleSelectEvent = useCallback(
    (rbcEvent: PlanevoRbcEvent, e: React.SyntheticEvent<HTMLElement>) => {
      if (isDraftCreateEvent(rbcEvent)) return
      const row = eventsById.get(getPlanevoEventId(rbcEvent))
      if (!row) return
      const anchorEl =
        e.currentTarget instanceof HTMLElement ? e.currentTarget : gridRef.current
      if (!anchorEl) return
      onEventSelect(row, elementToAnchorRect(anchorEl))
    },
    [eventsById, onEventSelect],
  )

  const handleEventTimes = useCallback(
    (
      { event, start, end }: RbcInteractionInfo,
      operation: "move" | "resize",
    ) => {
      if (!start || !end) return
      const row = eventsById.get(getPlanevoEventId(event))
      if (!row) return
      onEventTimesChange({
        operation,
        event: row,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      })
    },
    [eventsById, onEventTimesChange],
  )

  useEffect(() => {
    function finishDrag(event: MouseEvent) {
      const dragged = activeRbcTaskDragRef.current
      activeRbcTaskDragRef.current = null
      const grid = gridRef.current
      if (!dragged || !grid || !onUnscheduleTaskEvent) return
      if (!isPointOutsideRect(event, grid.getBoundingClientRect())) return
      const row = eventsById.get(getPlanevoEventId(dragged))
      if (row?.task_id) onUnscheduleTaskEvent(row)
    }

    document.addEventListener("mouseup", finishDrag, true)
    return () => document.removeEventListener("mouseup", finishDrag, true)
  }, [eventsById, onUnscheduleTaskEvent])

  const eventPropGetter = useCallback(
    (event: PlanevoRbcEvent) => {
      const isDraft = isDraftCreateEvent(event)
      // Cosmetic only — past events stay fully editable like Google Calendar.
      const isPast = !isDraft && isCalendarEventPast(event.end, now)
      return {
        className: cn(
          "planevo-rbc-event",
          `planevo-rbc-event--${event.color}`,
          isDraft && "planevo-rbc-event--draft pointer-events-none",
          isPast && "planevo-rbc-event--past",
          event.isTaskComplete && "opacity-65",
        ),
        "data-event-id": event.id,
      }
    },
    [now],
  )

  const draggableAccessor = useCallback(
    (event: PlanevoRbcEvent) => !isDraftCreateEvent(event),
    [],
  )

  const resizableAccessor = useCallback(
    (event: PlanevoRbcEvent) => !isDraftCreateEvent(event),
    [],
  )

  const slotPropGetter = useCallback(
    (date: Date) => calendarSlotDataAttributes(date),
    [],
  )

  return (
    <>
      <div
        className={cn(
          "planevo-calendar-grid min-h-0 h-full w-full overflow-hidden border border-border bg-calendar-grid",
          isMonthView
            ? "planevo-calendar-grid-shell"
            : "planevo-rbc planevo-calendar-grid-shell",
          !hasAllDayEvents && !isMonthView && "planevo-rbc--no-allday",
          className,
        )}
        data-calendar-grid={isMonthView ? "month" : "rbc"}
        aria-label="Calendar grid"
      >
        {isMonthView ? (
          <MonthGrid
            anchor={anchor}
            items={monthItems}
            now={now}
            onOpenAgenda={handleOpenAgenda}
            onOpenDay={onOpenDay}
            onSelectItem={handleSelectMonthItem}
            onToggleTask={onToggleTask}
            onNavigateMonth={onNavigateMonth}
          />
        ) : (
          <div ref={gridRef} className="h-full min-h-0">
            <DragAndDropCalendar
              key={rbcView}
              localizer={calendarLocalizer}
              culture="en-US"
              date={anchor}
              view={rbcView}
              views={["week", "day"]}
              events={rbcEvents}
              getNow={() => now}
              toolbar={false}
              selectable
              popup={false}
              resizable
              draggableAccessor={draggableAccessor}
              resizableAccessor={resizableAccessor}
              step={30}
              timeslots={2}
              min={DAY_MIN}
              max={DAY_MAX}
              scrollToTime={scrollToTime}
              enableAutoScroll={false}
              showMultiDayTimes
              dayLayoutAlgorithm="overlap"
              allDayMaxRows={hasAllDayEvents ? 10 : 0}
              components={timeGridComponents}
              formats={{
                timeGutterFormat: (date) => formatHourLabel(date.getHours()),
              }}
              eventPropGetter={eventPropGetter}
              slotPropGetter={slotPropGetter}
              onNavigate={() => {}}
              onView={() => {}}
              onSelecting={handleSelecting}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              onEventDrop={(info) => handleEventTimes(info, "move")}
              onEventResize={(info) => handleEventTimes(info, "resize")}
              onDragStart={({ event, action }) => {
                activeRbcTaskDragRef.current =
                  action === "move" && event.linkedTask ? event : null
              }}
              style={{ height: "100%" }}
            />
            <CalendarNowIndicator
              now={now}
              visible={showNowIndicator}
              preferSingleDaySlot={view === "day"}
              rbcRootRef={gridRef}
            />
          </div>
        )}
      </div>
      {agenda ? (
        <MonthDayAgendaPopover
          date={agenda.date}
          items={monthItems}
          anchorRect={agenda.origin.getBoundingClientRect()}
          onClose={closeAgenda}
          onOpenDay={(day) => {
            closeAgenda(false)
            onOpenDay(day)
          }}
          onCreateEvent={(day, anchorEl) => {
            const anchorRect = elementToAnchorRect(anchorEl)
            closeAgenda(false)
            onSlotSelect(defaultMonthCreateRange(day), anchorRect)
          }}
          onSelectEvent={(event, anchorEl) => {
            closeAgenda(false)
            onEventSelect(event, elementToAnchorRect(anchorEl))
          }}
          onToggleTask={onToggleTask}
        />
      ) : null}
    </>
  )
}
