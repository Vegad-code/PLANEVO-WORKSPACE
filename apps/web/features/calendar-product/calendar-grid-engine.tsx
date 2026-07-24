"use client"

import { useEffect, useMemo, useRef } from "react"
import FullCalendar from "@fullcalendar/react"
import type {
  DateSelectArg,
  DayHeaderContentArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
} from "@fullcalendar/core"
import type { EventResizeDoneArg } from "@fullcalendar/interaction"
import dayGridPlugin from "@fullcalendar/daygrid"
import interactionPlugin from "@fullcalendar/interaction"
import timeGridPlugin from "@fullcalendar/timegrid"
import type {
  CalendarEventRow,
  CalendarRow,
} from "@planevo/core/types/calendar"
import {
  getEventColor,
  getPlanevoEventId,
  toFullCalendarEvents,
} from "@/lib/calendar/calendar-event-adapter"
import {
  formatDayHeaderAccessibleLabel,
  formatDayHeaderDayNumber,
  formatDayHeaderWeekday,
} from "@/lib/calendar/day-header-model"
import { cn } from "@/lib/utils"
import {
  CALENDAR_COLOR_BLOCK_CLASS,
  CALENDAR_COLOR_BORDER_CLASS,
} from "./calendar-color-dot"

type CalendarGridEngineProps = {
  view: "day" | "week"
  anchor: Date
  calendars: CalendarRow[]
  events: CalendarEventRow[]
  onSlotSelect: (slotStart: Date) => void
  onEventSelect: (event: CalendarEventRow, anchor: HTMLElement) => void
  onEventTimesChange: (input: {
    eventId: string
    startsAt: string
    endsAt: string
  }) => void
  className?: string
}

function scrollTimeNearNow(): string {
  const now = new Date()
  const hour = Math.max(0, now.getHours() - 1)
  return `${String(hour).padStart(2, "0")}:00:00`
}

function PlanevoDayHeader({ arg }: { arg: DayHeaderContentArg }) {
  const date = arg.date
  const label = formatDayHeaderAccessibleLabel(date)
  return (
    <span
      className="fc-planevo-day-header flex flex-col items-center gap-0.5"
      aria-label={label}
      aria-current={arg.isToday ? "date" : undefined}
    >
      <span className="fc-planevo-day-weekday" aria-hidden="true">
        {formatDayHeaderWeekday(date)}
      </span>
      <span className="fc-planevo-day-number" aria-hidden="true">
        {formatDayHeaderDayNumber(date)}
      </span>
    </span>
  )
}

function PlanevoEventContent({ arg }: { arg: EventContentArg }) {
  const color = getEventColor(arg.event)
  return (
    <div
      className={cn(
        "fc-planevo-event-inner flex h-full min-h-0 flex-col overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5",
        CALENDAR_COLOR_BLOCK_CLASS[color],
        CALENDAR_COLOR_BORDER_CLASS[color],
      )}
    >
      {!arg.event.allDay && arg.timeText ? (
        <span className="truncate text-product-meta text-ink/80">
          {arg.timeText}
        </span>
      ) : null}
      <span className="truncate text-product-body font-medium text-ink">
        {arg.event.title}
      </span>
    </div>
  )
}

export function CalendarGridEngine({
  view,
  anchor,
  calendars,
  events,
  onSlotSelect,
  onEventSelect,
  onEventTimesChange,
  className,
}: CalendarGridEngineProps) {
  const calendarRef = useRef<FullCalendar>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fcEvents = useMemo(
    () => toFullCalendarEvents(events, calendars),
    [events, calendars],
  )
  const eventsById = useMemo(() => {
    const map = new Map<string, CalendarEventRow>()
    for (const event of events) map.set(event.id, event)
    return map
  }, [events])

  const fcView = view === "day" ? "timeGridDay" : "timeGridWeek"

  useEffect(() => {
    const api = calendarRef.current?.getApi()
    if (!api) return
    if (api.view.type !== fcView) api.changeView(fcView)
    api.gotoDate(anchor)
  }, [anchor, fcView])

  // Planning rail collapse/resize changes the flex width under FC. FullCalendar
  // only remeasures on window resize / updateSize — without this, the grid
  // stays stuck until the user triggers another layout action.
  useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === "undefined") return

    let frame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        calendarRef.current?.getApi().updateSize()
      })
    })
    observer.observe(container)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  function handleSelect(info: DateSelectArg) {
    onSlotSelect(info.start)
    info.view.calendar.unselect()
  }

  function handleEventClick(info: EventClickArg) {
    const eventId = getPlanevoEventId(info.event)
    const row = eventsById.get(eventId)
    if (!row) return
    onEventSelect(row, info.el)
  }

  function resolveEventBounds(event: EventDropArg["event"]): {
    startsAt: string
    endsAt: string
  } | null {
    const start = event.start
    if (!start) return null
    if (event.end) {
      return { startsAt: start.toISOString(), endsAt: event.end.toISOString() }
    }
    // All-day events sometimes omit end; treat as exclusive next day.
    if (event.allDay) {
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      return { startsAt: start.toISOString(), endsAt: end.toISOString() }
    }
    return null
  }

  function handleEventDrop(info: EventDropArg) {
    const bounds = resolveEventBounds(info.event)
    if (!bounds) {
      info.revert()
      return
    }
    onEventTimesChange({
      eventId: getPlanevoEventId(info.event),
      ...bounds,
    })
  }

  function handleEventResize(info: EventResizeDoneArg) {
    const bounds = resolveEventBounds(info.event)
    if (!bounds) {
      info.revert()
      return
    }
    onEventTimesChange({
      eventId: getPlanevoEventId(info.event),
      ...bounds,
    })
  }

  return (
    <div
      ref={containerRef}
      className={cn("planevo-fc min-h-0 h-full w-full", className)}
      data-calendar-grid="fullcalendar"
      aria-label="Calendar grid"
    >
      <FullCalendar
        ref={calendarRef}
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView={fcView}
        initialDate={anchor}
        headerToolbar={false}
        height="100%"
        // Sunday-start to mirror Google Calendar; loader expands Mon week by -1d.
        firstDay={0}
        // GCal-like all-day: keep the slot (events need it), strip visible label.
        // Union Council: fixed thin band (no :has collapse); defer all-day create.
        allDaySlot
        allDayContent={() => <span className="sr-only">All day</span>}
        stickyHeaderDates
        nowIndicator
        selectable
        selectMirror
        selectAllow={(arg) => !arg.allDay}
        editable
        eventStartEditable
        eventDurationEditable
        eventResizableFromStart
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        slotDuration="00:30:00"
        scrollTime={scrollTimeNearNow()}
        scrollTimeReset={false}
        weekends
        views={{
          timeGridWeek: { dayMaxEventRows: 3 },
          timeGridDay: { dayMaxEventRows: 3 },
        }}
        events={fcEvents}
        select={handleSelect}
        eventClick={handleEventClick}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        eventContent={(arg) => <PlanevoEventContent arg={arg} />}
        slotLabelFormat={{
          hour: "numeric",
          minute: "2-digit",
          omitZeroMinute: true,
          meridiem: "short",
        }}
        eventTimeFormat={{
          hour: "numeric",
          minute: "2-digit",
          meridiem: "short",
        }}
        dayHeaderContent={(arg) => <PlanevoDayHeader arg={arg} />}
      />
    </div>
  )
}
