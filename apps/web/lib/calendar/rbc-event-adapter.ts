import type {
  CalendarColor,
  CalendarColorValue,
  CalendarDisplayEvent,
  CalendarLinkedTask,
  CalendarRow,
} from "@planevo/core/types/calendar"
import { isLinkedTaskComplete } from "./task-linked-events.ts"
import { calendarEventDisplayRange } from "./calendar-event-display-range.ts"

export const DRAFT_CREATE_EVENT_ID = "__draft-create__"
export const DRAFT_CREATE_PLACEHOLDER_TITLE = "(No title)"

export type PlanevoRbcEvent = {
  id: string
  title: string
  start: Date
  end: Date
  allDay: boolean
  planevoEventId: string
  calendarId: string
  color: CalendarColor
  source: CalendarDisplayEvent["source"]
  isReadOnly: boolean
  linkedTask: CalendarLinkedTask | null
  isTaskComplete: boolean
  isDraft?: boolean
}

export type DraftCreateEventState = {
  startsAt: string
  endsAt: string
  title: string
  calendarId: string
  allDay: boolean
  color: CalendarColorValue | null
}

export type DraftCreateEventInput = DraftCreateEventState & {
  color: CalendarColor
}

/** Map already context-filtered Planevo events to react-big-calendar inputs. */
export function toRbcEvents(
  events: CalendarDisplayEvent[],
  calendars: CalendarRow[],
): PlanevoRbcEvent[] {
  const colorByCalendarId = new Map(
    calendars.map((calendar) => [calendar.id, calendar.color] as const),
  )
  return events
    .flatMap((event) => {
      const color =
        event.color ??
        colorByCalendarId.get(event.calendar_id) ??
        "graphite"
      const range = calendarEventDisplayRange(event)
      if (!range) return []
      return [{
        id: event.id,
        title: event.linked_task?.title ?? event.title,
        start: range.start,
        end: range.end,
        allDay: event.all_day,
        planevoEventId: event.id,
        calendarId: event.calendar_id,
        color,
        source: event.source,
        isReadOnly: event.source !== "planevo",
        linkedTask: event.linked_task,
        isTaskComplete: isLinkedTaskComplete(event.linked_task),
      }]
    })
}

export function getPlanevoEventId(event: PlanevoRbcEvent): string {
  return event.planevoEventId
}

export function getEventColor(event: PlanevoRbcEvent): CalendarColor {
  return event.color
}

export function isDraftCreateEvent(event: PlanevoRbcEvent): boolean {
  return event.isDraft === true || event.id === DRAFT_CREATE_EVENT_ID
}

export function toDraftRbcEvent(input: DraftCreateEventInput): PlanevoRbcEvent {
  const trimmedTitle = input.title.trim()
  return {
    id: DRAFT_CREATE_EVENT_ID,
    title: trimmedTitle || DRAFT_CREATE_PLACEHOLDER_TITLE,
    start: new Date(input.startsAt),
    end: new Date(input.endsAt),
    allDay: input.allDay,
    planevoEventId: DRAFT_CREATE_EVENT_ID,
    calendarId: input.calendarId,
    color: input.color,
    source: "planevo",
    isReadOnly: false,
    linkedTask: null,
    isTaskComplete: false,
    isDraft: true,
  }
}
