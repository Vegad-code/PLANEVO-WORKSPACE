import type {
  CalendarColor,
  CalendarDisplayEvent,
  CalendarEventRow,
  CalendarLinkedTask,
  CalendarRow,
  TaskDueChip,
} from "@planevo/core/types/calendar"
import { isLinkedTaskComplete } from "./task-linked-events.ts"
import { calendarEventDisplayRange } from "./calendar-event-display-range.ts"
import { filterTaskDuesWithoutScheduledBlocks } from "./scheduled-task-dedup.ts"

export type MonthEventItem = {
  kind: "event"
  displayStyle: "timed" | "bar"
  id: string
  title: string
  start: Date
  end: Date
  eventId: string
  calendarId: string
  calendarColor: CalendarColor
  source: CalendarEventRow["source"]
  isSyncedSource: boolean
  allDay: boolean
  linkedTask: CalendarLinkedTask | null
  isTaskComplete: boolean
  event: CalendarDisplayEvent
}

export type MonthTaskItem = {
  kind: "task"
  displayStyle: "task"
  id: string
  title: string
  start: Date
  end: Date
  taskId: string
  dueAt: Date
  completed: boolean
  toggle: {
    taskId: string
    nextCompleted: boolean
  }
  task: TaskDueChip
}

export type MonthItem = MonthEventItem | MonthTaskItem

function startOfLocalDay(date: Date): Date {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}

function addLocalDays(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function isCompletedTaskStatus(status: string): boolean {
  return status === "done" || status === "cancelled"
}

/**
 * Calendar events use an exclusive end. Subtracting a millisecond finds the
 * last day the event actually occupies, so an all-day event ending at midnight
 * does not incorrectly render on the next day.
 */
export function lastOccupiedMoment(start: Date, end: Date): Date {
  if (end.getTime() <= start.getTime()) return start
  return new Date(end.getTime() - 1)
}

export function getMonthEventDisplayStyle(
  event: Pick<CalendarEventRow, "starts_at" | "ends_at" | "all_day">,
): MonthEventItem["displayStyle"] {
  if (event.all_day) return "bar"

  const start = new Date(event.starts_at)
  const lastMoment = lastOccupiedMoment(start, new Date(event.ends_at))
  return startOfLocalDay(start).getTime() === startOfLocalDay(lastMoment).getTime()
    ? "timed"
    : "bar"
}

export function eventToMonthItem(
  event: CalendarDisplayEvent,
  calendarColor: CalendarColor,
): MonthEventItem {
  const range = calendarEventDisplayRange(event)
  const start = range?.start ?? new Date(event.starts_at)
  const end = range?.end ?? new Date(event.ends_at)

  return {
    kind: "event",
    displayStyle: getMonthEventDisplayStyle(event),
    id: `event:${event.id}`,
    title: event.linked_task?.title ?? event.title,
    start,
    end,
    eventId: event.id,
    calendarId: event.calendar_id,
    calendarColor: event.color ?? calendarColor,
    source: event.source,
    isSyncedSource: event.source !== "planevo",
    allDay: event.all_day,
    linkedTask: event.linked_task,
    isTaskComplete: isLinkedTaskComplete(event.linked_task),
    event,
  }
}

export function taskDueToMonthItem(task: TaskDueChip): MonthTaskItem {
  const dueAt = new Date(task.dueAt)
  const completed = isCompletedTaskStatus(task.status)

  return {
    kind: "task",
    displayStyle: "task",
    id: `task:${task.taskId}`,
    title: task.title,
    start: dueAt,
    end: dueAt,
    taskId: task.taskId,
    dueAt,
    completed,
    toggle: {
      taskId: task.taskId,
      nextCompleted: !completed,
    },
    task,
  }
}

/** Build the visible event and task-due rows used only by Month. */
export function toMonthItems(
  events: CalendarDisplayEvent[],
  taskDues: TaskDueChip[],
  calendars: CalendarRow[],
): MonthItem[] {
  const visibleCalendars = new Map(
    calendars.map((calendar) => [calendar.id, calendar.color] as const),
  )

  const eventItems = events.flatMap((event) => {
    const color = visibleCalendars.get(event.calendar_id)
    return color ? [eventToMonthItem(event, color)] : []
  })

  const visibleTaskDues = filterTaskDuesWithoutScheduledBlocks(taskDues, events)

  return sortMonthItems([...eventItems, ...visibleTaskDues.map(taskDueToMonthItem)])
}

function sortGroup(item: MonthItem): number {
  if (item.kind === "event" && item.displayStyle === "bar") return 0
  if (item.kind === "task" && !item.completed) return 1
  if (item.kind === "event") return 2
  return 3
}

/** Month stack order: bars, open task dues, timed events, completed task dues. */
export function sortMonthItems(items: MonthItem[]): MonthItem[] {
  return [...items].sort((left, right) => {
    const groupDelta = sortGroup(left) - sortGroup(right)
    if (groupDelta !== 0) return groupDelta

    const timeDelta = left.start.getTime() - right.start.getTime()
    if (timeDelta !== 0) return timeDelta

    return left.title.localeCompare(right.title) || left.id.localeCompare(right.id)
  })
}

/** Every Month item belonging to a local calendar day, including spanning bars. */
export function monthItemsForCalendarDay(
  items: MonthItem[],
  day: Date,
): MonthItem[] {
  const windowStart = startOfLocalDay(day)
  const windowEnd = addLocalDays(windowStart, 1)

  return sortMonthItems(
    items.filter((item) => {
      if (item.kind === "task") {
        return (
          item.dueAt >= windowStart &&
          item.dueAt < windowEnd
        )
      }
      return item.start < windowEnd && item.end > windowStart
    }),
  )
}
