"use client"

import { useCallback, useMemo, useState } from "react"
import {
  Calendar,
  type DateHeaderProps,
  type EventProps,
  type HeaderProps,
  type SlotInfo,
  type View,
} from "react-big-calendar"
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop"
import { format } from "date-fns/format"
import type {
  CalendarEventRow,
  CalendarRow,
  TaskDueChip,
} from "@planevo/core/types/calendar"
import {
  getMonthItemInteraction,
  getPlanevoEventId,
  isMonthRbcEvent,
  toMonthRbcEvents,
  toRbcEvents,
  type CalendarRbcEvent,
  type PlanevoRbcEvent,
} from "@/lib/calendar/rbc-event-adapter"
import { calendarLocalizer } from "@/lib/calendar/rbc-localizer"
import { MONTH_GRID_BEHAVIOR } from "@/lib/calendar/month-grid-behavior"
import { toMonthItems } from "@/lib/calendar/month-items"
import { cn } from "@/lib/utils"
import { MonthDayAgendaPopover } from "./month-day-agenda-popover"
import { RbcDayHeader } from "./rbc-day-header"
import { RbcEventContent } from "./rbc-event-content"
import { RbcMonthDateCell } from "./rbc-month-date-cell"
import { RbcMonthEventContent } from "./rbc-month-event-content"
import { RbcMonthWeekdayHeader } from "./rbc-month-weekday-header"
import { RbcTimeGutterHeader } from "./rbc-time-gutter-header"
import { formatHourLabel } from "./time-axis"
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
  typeof Calendar<CalendarRbcEvent>
> & {
  onEventDrop?: (info: RbcInteractionInfo) => void
  onEventResize?: (info: RbcInteractionInfo) => void
  resizable?: boolean
  draggableAccessor?: (event: CalendarRbcEvent) => boolean
  resizableAccessor?: (event: CalendarRbcEvent) => boolean
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
  onSlotSelect: (slotStart: Date) => void
  onEventSelect: (event: CalendarEventRow, anchor: HTMLElement) => void
  onEventTimesChange: (input: {
    eventId: string
    startsAt: string
    endsAt: string
  }) => void
  onToggleTask: (taskId: string, done: boolean) => void
  onOpenDay: (date: Date) => void
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
 * Week/day/month grid via react-big-calendar + drag-and-drop addon.
 * Month view uses day agenda popover; week/day retain move/resize.
 */
export function CalendarGridEngine({
  view,
  anchor,
  calendars,
  events,
  taskDues,
  now,
  onSlotSelect,
  onEventSelect,
  onEventTimesChange,
  onToggleTask,
  onOpenDay,
  className,
}: CalendarGridEngineProps) {
  const [agenda, setAgenda] = useState<{
    date: Date
    origin: HTMLElement
  } | null>(null)

  const rbcView: View =
    view === "day" ? "day" : view === "month" ? "month" : "week"
  const isMonthView = view === "month"

  const timeGridEvents = useMemo(
    () => toRbcEvents(events, calendars),
    [events, calendars],
  )
  const monthItems = useMemo(
    () => toMonthItems(events, taskDues, calendars),
    [events, taskDues, calendars],
  )
  const monthEvents = useMemo(
    () => toMonthRbcEvents(monthItems),
    [monthItems],
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

  const openAgenda = useCallback((date: Date, target: HTMLElement) => {
    setAgenda({ date, origin: target })
  }, [])

  const closeAgenda = useCallback(
    (restoreFocus = true) => {
      const origin = agenda?.origin
      setAgenda(null)
      if (restoreFocus && origin?.isConnected) origin.focus()
    },
    [agenda],
  )

  const handleShowMore = useCallback(
    (_events: CalendarRbcEvent[], date: Date) => {
      const dayKey = format(date, "yyyy-MM-dd")
      const cell = document.querySelector(`[data-calendar-day="${dayKey}"]`)
      const focusedElement = document.activeElement
      const target =
        focusedElement instanceof HTMLElement
          ? focusedElement
          : cell instanceof HTMLElement
            ? cell
            : document.body
      openAgenda(date, target)
    },
    [openAgenda],
  )

  const monthComponents = useMemo(
    () => ({
      toolbar: () => null,
      header: (props: HeaderProps) => <RbcMonthWeekdayHeader {...props} />,
      event: (props: EventProps<CalendarRbcEvent>) => {
        if (!isMonthRbcEvent(props.event)) return null
        return (
          <RbcMonthEventContent
            {...props}
            event={props.event}
            onToggleTask={onToggleTask}
          />
        )
      },
      timeGutterHeader: RbcTimeGutterHeader,
      month: {
        dateHeader: (props: DateHeaderProps) => (
          <RbcMonthDateCell {...props} now={now} />
        ),
      },
      dateCellWrapper: ({
        value,
        children,
      }: {
        value: Date
        children: React.ReactNode
      }) => (
        <div
          data-calendar-day={format(value, "yyyy-MM-dd")}
          tabIndex={-1}
          onDoubleClick={() => {
            closeAgenda()
            onOpenDay(value)
          }}
        >
          {children}
        </div>
      ),
    }),
    [closeAgenda, now, onOpenDay, onToggleTask],
  )

  const timeGridComponents = useMemo(
    () => ({
      toolbar: () => null,
      header: (props: HeaderProps) => <RbcDayHeader {...props} now={now} />,
      event: (props: EventProps<CalendarRbcEvent>) => {
        if (isMonthRbcEvent(props.event)) return null
        return <RbcEventContent {...props} event={props.event} />
      },
      timeGutterHeader: RbcTimeGutterHeader,
    }),
    [now],
  )

  const components = isMonthView ? monthComponents : timeGridComponents

  const handleSelectSlot = useCallback(
    (slotInfo: SlotInfo) => {
      if (view === "month") {
        const dayKey = format(slotInfo.start, "yyyy-MM-dd")
        const dayCell = document.querySelector(
          `[data-calendar-day="${dayKey}"]`,
        )
        const target =
          dayCell instanceof HTMLElement
            ? dayCell
            : slotInfo.box instanceof HTMLElement
            ? slotInfo.box
            : document.activeElement instanceof HTMLElement
              ? document.activeElement
              : document.body
        openAgenda(slotInfo.start, target)
        return
      }
      onSlotSelect(slotInfo.start)
    },
    [view, onSlotSelect, openAgenda],
  )

  const handleSelectEvent = useCallback(
    (rbcEvent: CalendarRbcEvent, e: React.SyntheticEvent<HTMLElement>) => {
      if (isMonthRbcEvent(rbcEvent)) {
        const interaction = getMonthItemInteraction(rbcEvent.monthItem)
        if (interaction.kind === "task") return
        const anchorEl =
          e.currentTarget instanceof HTMLElement
            ? e.currentTarget
            : document.body
        onEventSelect(interaction.event, anchorEl)
        return
      }
      const row = eventsById.get(getPlanevoEventId(rbcEvent))
      if (!row) return
      const anchorEl =
        e.currentTarget instanceof HTMLElement
          ? e.currentTarget
          : document.body
      onEventSelect(row, anchorEl)
    },
    [eventsById, onEventSelect],
  )

  const handleEventTimes = useCallback(
    ({ event, start, end }: RbcInteractionInfo) => {
      if (!start || !end) return
      onEventTimesChange({
        eventId: getPlanevoEventId(event),
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      })
    },
    [onEventTimesChange],
  )

  const eventPropGetter = useCallback((event: CalendarRbcEvent) => {
    if (isMonthRbcEvent(event)) {
      const item = event.monthItem
      if (item.kind === "task") {
        return {
          className: cn(
            "planevo-rbc-event",
            "planevo-rbc-event--month-task",
            item.completed && "planevo-rbc-event--month-task-completed",
          ),
        }
      }

      return {
        className: cn(
          "planevo-rbc-event",
          `planevo-rbc-event--${item.calendarColor}`,
          `planevo-rbc-event--month-${item.displayStyle}`,
        ),
      }
    }

    return {
      className: cn("planevo-rbc-event", `planevo-rbc-event--${event.color}`),
    }
  }, [])

  const slotPropGetter = useCallback(
    (date: Date) => calendarSlotDataAttributes(date),
    [],
  )

  return (
    <>
      <div
        className={cn(
          "planevo-rbc planevo-calendar-grid min-h-0 h-full w-full overflow-hidden rounded-t-[var(--radius-calendar-shell)] border border-border bg-calendar-grid",
          isMonthView && "planevo-rbc--month",
          !hasAllDayEvents && !isMonthView && "planevo-rbc--no-allday",
          className,
        )}
        data-calendar-grid="rbc"
        aria-label="Calendar grid"
      >
        <DragAndDropCalendar
          key={rbcView}
          localizer={calendarLocalizer}
          culture="en-US"
          date={anchor}
          view={rbcView}
          views={["month", "week", "day"]}
          events={isMonthView ? monthEvents : timeGridEvents}
          getNow={() => now}
          toolbar={false}
          selectable={isMonthView ? "ignoreEvents" : true}
          popup={isMonthView ? MONTH_GRID_BEHAVIOR.popup : false}
          doShowMoreDrillDown={
            isMonthView ? MONTH_GRID_BEHAVIOR.doShowMoreDrillDown : undefined
          }
          drilldownView={isMonthView ? null : undefined}
          resizable={isMonthView ? MONTH_GRID_BEHAVIOR.resizable : true}
          step={30}
          timeslots={2}
          min={DAY_MIN}
          max={DAY_MAX}
          scrollToTime={scrollToTime}
          enableAutoScroll={false}
          showMultiDayTimes
          dayLayoutAlgorithm="overlap"
          allDayMaxRows={hasAllDayEvents ? 10 : 0}
          components={components}
          formats={{
            timeGutterFormat: (date) => formatHourLabel(date.getHours()),
          }}
          eventPropGetter={eventPropGetter}
          slotPropGetter={slotPropGetter}
          draggableAccessor={(event) =>
            isMonthView
              ? MONTH_GRID_BEHAVIOR.draggable
              : !isMonthRbcEvent(event)
          }
          resizableAccessor={(event) =>
            isMonthView
              ? MONTH_GRID_BEHAVIOR.resizable
              : !isMonthRbcEvent(event)
          }
          onNavigate={() => {}}
          onView={() => {}}
          onSelectSlot={handleSelectSlot}
          onSelectEvent={handleSelectEvent}
          onShowMore={isMonthView ? handleShowMore : undefined}
          onEventDrop={handleEventTimes}
          onEventResize={handleEventTimes}
          style={{ height: "100%" }}
        />
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
          onSelectEvent={(event, anchorEl) => {
            closeAgenda(false)
            onEventSelect(event, anchorEl)
          }}
          onToggleTask={onToggleTask}
        />
      ) : null}
    </>
  )
}
