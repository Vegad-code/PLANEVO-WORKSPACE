import type {
  CalendarColor,
  CalendarEventRow,
  CalendarRow,
} from "@planevo/core/types/calendar"
import type { MonthItem } from "./month-items"

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

/** A Month-only RBC input backed by the unified event/task item model. */
export type MonthRbcEvent = {
  id: string
  title: string
  start: Date
  end: Date
  allDay: boolean
  monthItem: MonthItem
}

export type CalendarRbcEvent = PlanevoRbcEvent | MonthRbcEvent

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

/**
 * RBC owns the visible row limit and therefore the +N more count. Supplying
 * every unified Month item here means due tasks and events share that limit.
 */
export function toMonthRbcEvents(items: MonthItem[]): MonthRbcEvent[] {
  return items.map((item) => {
    if (item.kind === "task") {
      const taskDay = new Date(item.dueAt)
      taskDay.setHours(0, 0, 0, 0)
      const nextDay = new Date(taskDay)
      nextDay.setDate(nextDay.getDate() + 1)

      return {
        id: item.id,
        title: item.title,
        // RBC's Month sorter puts longer items ahead. An open task occupies
        // its due day only (exclusive next-day end) so it follows bars and
        // precedes timed events; completed tasks retain a zero-length sort key.
        start: taskDay,
        end: item.completed ? taskDay : nextDay,
        allDay: false,
        monthItem: item,
      }
    }

    return {
      id: item.id,
      title: item.title,
      start: item.start,
      end: item.end,
      allDay: item.allDay,
      monthItem: item,
    }
  })
}

export function isMonthRbcEvent(
  event: CalendarRbcEvent,
): event is MonthRbcEvent {
  return "monthItem" in event
}

export type MonthItemInteraction =
  | { kind: "event"; event: CalendarEventRow }
  | { kind: "task"; taskId: string; nextCompleted: boolean }

/** The interaction dispatch used by both the Month rows and its day agenda. */
export function getMonthItemInteraction(item: MonthItem): MonthItemInteraction {
  if (item.kind === "event") return { kind: "event", event: item.event }

  return {
    kind: "task",
    taskId: item.toggle.taskId,
    nextCompleted: item.toggle.nextCompleted,
  }
}
