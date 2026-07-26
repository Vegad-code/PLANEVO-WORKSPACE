import {
  listCalendarViews,
  loadCalendars,
  loadCalendarWeek,
  type CalendarWeekData,
} from "@planevo/core/queries/product-calendar"
import { loadTodayColumnTasks } from "@planevo/core/queries/product-tasks"
import type { DataAccess } from "@planevo/core/types/data-access"
import type {
  CalendarDisplayEvent,
  CalendarViewRow,
} from "@planevo/core/types/calendar"
import {
  parseCalendarSearchParams,
  type CalendarToolbarView,
} from "@/lib/calendar/calendar-navigation"
import { calendarRange, dateParam } from "@/lib/calendar/calendar-range"
import { materializeCalendarEvents } from "@/lib/calendar/recurrence-window"
import {
  decorateTaskLinkedEvents,
  toCalendarLinkedTask,
} from "@/lib/calendar/task-linked-events"
import type { CalendarScope } from "@/lib/calendar/scope-prefs"
import type { TodayColumnTask } from "@/features/calendar-product/today-task-row"

export type CalendarPageRequest = {
  date?: string
  view?: string
  week?: string
}

export type CalendarReadyData = {
  scope: CalendarScope
  anchorDate: Date
  view: CalendarToolbarView
  todayTasks: TodayColumnTask[]
  workspaceId: string | null
  calendars: CalendarWeekData["calendars"]
  views: CalendarViewRow[]
  events: CalendarDisplayEvent[]
  taskDues: CalendarWeekData["taskDues"]
}

/** Range-scoped payload: events and due chips for the active view window. */
export type CalendarRangeQueryPayload = {
  scope: CalendarScope
  anchorDate: string
  view: CalendarToolbarView
  workspaceId: string | null
  events: CalendarDisplayEvent[]
  taskDues: CalendarWeekData["taskDues"]
}

/** Infrequently changing calendar chrome: sources list and saved views. */
export type CalendarMetaQueryPayload = {
  scope: CalendarScope
  workspaceId: string | null
  calendars: CalendarWeekData["calendars"]
  views: CalendarViewRow[]
}

/** Planning-rail task list — lightweight rows only. */
export type CalendarTodayQueryPayload = {
  scope: CalendarScope
  todayTasks: TodayColumnTask[]
}

/** Serializable merged payload for optimistic patchers and legacy callers. */
export type CalendarQueryPayload = CalendarRangeQueryPayload &
  CalendarMetaQueryPayload &
  CalendarTodayQueryPayload

export function mergeCalendarQueryData({
  range,
  meta,
  today,
}: {
  range: CalendarRangeQueryPayload
  meta: CalendarMetaQueryPayload
  today: CalendarTodayQueryPayload
}): CalendarQueryPayload {
  return {
    ...range,
    calendars: meta.calendars,
    views: meta.views,
    todayTasks: today.todayTasks,
  }
}

export function serializeCalendarQueryData(
  data: CalendarReadyData,
): CalendarQueryPayload {
  return {
    scope: data.scope,
    anchorDate: dateParam(data.anchorDate),
    view: data.view,
    workspaceId: data.workspaceId,
    calendars: data.calendars,
    views: data.views,
    events: data.events,
    taskDues: data.taskDues,
    todayTasks: data.todayTasks,
  }
}

function workspaceFilterForScope(
  scope: CalendarScope,
  workspaceId: string | null,
) {
  return scope === "workspace" && workspaceId ? { workspaceId } : {}
}

export async function fetchCalendarRangeData(
  access: DataAccess,
  workspaceId: string | null,
  scope: CalendarScope,
  request: CalendarPageRequest = {},
): Promise<CalendarRangeQueryPayload> {
  const { date: anchorDate, view } = parseCalendarSearchParams(request)
  const { start, end } = calendarRange(view, anchorDate)
  const workspaceFilter = workspaceFilterForScope(scope, workspaceId)

  const week = await loadCalendarWeek(access.client, access.ownerId, {
    start,
    end,
    eventRange: view === "month" ? "overlaps" : "starts-in",
    includeCalendars: false,
    ...workspaceFilter,
  })

  const events = decorateTaskLinkedEvents({
    events: materializeCalendarEvents({
      standalone: week.events,
      masters: week.recurringMasters,
      exceptions: week.recurrenceExceptions,
      windowStart: start,
      windowEnd: end,
      eventRange: view === "month" ? "overlaps" : "starts-in",
    }),
    tasks: week.linkedTasks.map(toCalendarLinkedTask),
  })

  return {
    scope,
    anchorDate: dateParam(anchorDate),
    view,
    workspaceId,
    events,
    taskDues: week.taskDues,
  }
}

export async function fetchCalendarMetaData(
  access: DataAccess,
  workspaceId: string | null,
  scope: CalendarScope,
): Promise<CalendarMetaQueryPayload> {
  const [calendars, views] = await Promise.all([
    loadCalendars(access.client, access.ownerId),
    listCalendarViews(access.client, access.ownerId),
  ])

  return {
    scope,
    workspaceId,
    calendars,
    views,
  }
}

export async function fetchCalendarTodayData(
  access: DataAccess,
  workspaceId: string | null,
  scope: CalendarScope,
): Promise<CalendarTodayQueryPayload> {
  const workspaceFilter = workspaceFilterForScope(scope, workspaceId)
  const tasks = await loadTodayColumnTasks(
    access.client,
    access.ownerId,
    workspaceFilter,
  )

  return {
    scope,
    todayTasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      due_at: task.due_at,
    })),
  }
}

export async function fetchCalendarPageData(
  access: DataAccess,
  workspaceId: string | null,
  scope: CalendarScope,
  request: CalendarPageRequest = {},
): Promise<CalendarReadyData> {
  const { date: anchorDate, view } = parseCalendarSearchParams(request)
  const [range, meta, today] = await Promise.all([
    fetchCalendarRangeData(access, workspaceId, scope, request),
    fetchCalendarMetaData(access, workspaceId, scope),
    fetchCalendarTodayData(access, workspaceId, scope),
  ])

  return {
    scope,
    anchorDate,
    view,
    workspaceId,
    calendars: meta.calendars,
    views: meta.views,
    events: range.events,
    taskDues: range.taskDues,
    todayTasks: today.todayTasks,
  }
}
