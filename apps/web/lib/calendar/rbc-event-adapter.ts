import type {
  CalendarColor,
  CalendarEventRow,
  CalendarRow,
} from "@planevo/core/types/calendar"

export type PlanevoRbcEvent = {
  id: string
  title: string
  start: Date
  end: Date
  allDay: boolean
  planevoEventId: string
  calendarId: string
  color: CalendarColor
}

/** Map Planevo events to react-big-calendar inputs, honoring calendar visibility. */
export function toRbcEvents(
  events: CalendarEventRow[],
  calendars: CalendarRow[],
): PlanevoRbcEvent[] {
  const colorByCalendarId = new Map(
    calendars.map((calendar) => [calendar.id, calendar.color] as const),
  )
  const visibleIds = new Set(
    calendars
      .filter((calendar) => calendar.is_visible)
      .map((calendar) => calendar.id),
  )

  return events
    .filter((event) => visibleIds.has(event.calendar_id))
    .map((event) => {
      const color = colorByCalendarId.get(event.calendar_id) ?? "slate"
      return {
        id: event.id,
        title: event.title,
        start: new Date(event.starts_at),
        end: new Date(event.ends_at),
        allDay: event.all_day,
        planevoEventId: event.id,
        calendarId: event.calendar_id,
        color,
      }
    })
}

export function getPlanevoEventId(event: PlanevoRbcEvent): string {
  return event.planevoEventId
}

export function getEventColor(event: PlanevoRbcEvent): CalendarColor {
  return event.color
}
