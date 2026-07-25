"use client"

import { useCallback, useMemo } from "react"
import {
  Calendar,
  type HeaderProps,
  type SlotInfo,
  type View,
} from "react-big-calendar"
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop"
import { format } from "date-fns/format"
import type {
  CalendarEventRow,
  CalendarRow,
} from "@planevo/core/types/calendar"
import {
  getPlanevoEventId,
  toRbcEvents,
  type PlanevoRbcEvent,
} from "@/lib/calendar/rbc-event-adapter"
import { calendarLocalizer } from "@/lib/calendar/rbc-localizer"
import { cn } from "@/lib/utils"
import { RbcDayHeader } from "./rbc-day-header"
import { RbcEventContent } from "./rbc-event-content"
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
  typeof Calendar<PlanevoRbcEvent>
> & {
  onEventDrop?: (info: RbcInteractionInfo) => void
  onEventResize?: (info: RbcInteractionInfo) => void
  resizable?: boolean
  draggableAccessor?: (event: PlanevoRbcEvent) => boolean
  resizableAccessor?: (event: PlanevoRbcEvent) => boolean
}

const DragAndDropCalendar = withDragAndDrop(
  Calendar,
) as React.ComponentType<DragAndDropCalendarProps>

type CalendarGridEngineProps = {
  view: "day" | "week"
  anchor: Date
  calendars: CalendarRow[]
  events: CalendarEventRow[]
  now: Date
  onSlotSelect: (slotStart: Date) => void
  onEventSelect: (event: CalendarEventRow, anchor: HTMLElement) => void
  onEventTimesChange: (input: {
    eventId: string
    startsAt: string
    endsAt: string
  }) => void
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
 * Week/day time grid via react-big-calendar + drag-and-drop addon.
 * Replaces the native WeekGrid for reliable column dividers and move/resize.
 */
export function CalendarGridEngine({
  view,
  anchor,
  calendars,
  events,
  now,
  onSlotSelect,
  onEventSelect,
  onEventTimesChange,
  className,
}: CalendarGridEngineProps) {
  const rbcView: View = view === "day" ? "day" : "week"
  const rbcEvents = useMemo(
    () => toRbcEvents(events, calendars),
    [events, calendars],
  )
  const eventsById = useMemo(() => {
    const map = new Map<string, CalendarEventRow>()
    for (const event of events) map.set(event.id, event)
    return map
  }, [events])

  const hasAllDayEvents = useMemo(
    () => rbcEvents.some((event) => event.allDay),
    [rbcEvents],
  )

  const scrollToTime = useMemo(() => scrollTimeNearNow(), [])

  const components = useMemo(
    () => ({
      toolbar: () => null,
      header: (props: HeaderProps) => <RbcDayHeader {...props} now={now} />,
      event: RbcEventContent,
    }),
    [now],
  )

  const handleSelectSlot = useCallback(
    (slotInfo: SlotInfo) => {
      onSlotSelect(slotInfo.start)
    },
    [onSlotSelect],
  )

  const handleSelectEvent = useCallback(
    (rbcEvent: PlanevoRbcEvent, e: React.SyntheticEvent<HTMLElement>) => {
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

  const eventPropGetter = useCallback((event: PlanevoRbcEvent) => {
    return {
      className: cn("planevo-rbc-event", `planevo-rbc-event--${event.color}`),
    }
  }, [])

  const slotPropGetter = useCallback(
    (date: Date) => calendarSlotDataAttributes(date),
    [],
  )

  return (
    <div
      className={cn(
        "planevo-rbc planevo-calendar-grid min-h-0 h-full w-full overflow-hidden rounded-t-[var(--radius-calendar-shell)] border border-border bg-calendar-grid",
        !hasAllDayEvents && "planevo-rbc--no-allday",
        className,
      )}
      data-calendar-grid="rbc"
      aria-label="Calendar grid"
    >
      <DragAndDropCalendar
        localizer={calendarLocalizer}
        culture="en-US"
        date={anchor}
        view={rbcView}
        views={["week", "day"]}
        events={rbcEvents}
        getNow={() => now}
        toolbar={false}
        selectable
        resizable
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
        draggableAccessor={(event) => !event.allDay}
        resizableAccessor={(event) => !event.allDay}
        onSelectSlot={handleSelectSlot}
        onSelectEvent={handleSelectEvent}
        onEventDrop={handleEventTimes}
        onEventResize={handleEventTimes}
        style={{ height: "100%" }}
      />
    </div>
  )
}
