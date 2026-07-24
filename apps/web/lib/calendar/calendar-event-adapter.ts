import type { EventInput } from "@fullcalendar/core"
import type {
  CalendarColor,
  CalendarEventRow,
  CalendarRow,
} from "@planevo/core/types/calendar"

export type PlanevoFcEventExtended = {
  calendarId: string
  color: CalendarColor
  planevoEventId: string
}

/** Map Planevo events to FullCalendar inputs, honoring calendar visibility. */
export function toFullCalendarEvents(
  events: CalendarEventRow[],
  calendars: CalendarRow[],
): EventInput[] {
  const colorByCalendarId = new Map(
    calendars.map((calendar) => [calendar.id, calendar.color] as const),
  )
  const visibleIds = new Set(
    calendars.filter((calendar) => calendar.is_visible).map((calendar) => calendar.id),
  )

  return events
    .filter((event) => visibleIds.has(event.calendar_id))
    .map((event) => {
      const color = colorByCalendarId.get(event.calendar_id) ?? "slate"
      const extendedProps: PlanevoFcEventExtended = {
        calendarId: event.calendar_id,
        color,
        planevoEventId: event.id,
      }
      return {
        id: event.id,
        title: event.title,
        start: event.starts_at,
        end: event.ends_at,
        allDay: event.all_day,
        editable: true,
        classNames: [`fc-planevo-event`, `fc-planevo-event--${color}`],
        extendedProps,
      } satisfies EventInput
    })
}

export function getPlanevoEventId(event: {
  id: string
  extendedProps?: Record<string, unknown>
}): string {
  const fromProps = event.extendedProps?.planevoEventId
  return typeof fromProps === "string" ? fromProps : event.id
}

export function getEventColor(event: {
  extendedProps?: Record<string, unknown>
}): CalendarColor {
  const color = event.extendedProps?.color
  if (
    color === "slate" ||
    color === "marigold" ||
    color === "meadow" ||
    color === "brick" ||
    color === "ocean"
  ) {
    return color
  }
  return "slate"
}
