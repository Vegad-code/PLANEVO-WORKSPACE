import {
  loadTaskIdsForCalendarIds,
  loadTaskIdsForCalendarContext,
  loadCalendars,
  loadCalendarWeek,
  type CalendarWeekData,
} from "@planevo/core/queries/product-calendar"
import { loadTodayColumnTasks } from "@planevo/core/queries/product-tasks"
import type { DataAccess } from "@planevo/core/types/data-access"
import type {
  CalendarDisplayEvent,
  CalendarContext,
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
import { calendarIdsForContext, calendarSupportsView } from "@/lib/calendar/calendar-context"

export type CalendarPageRequest = {
  date?: string
  view?: string
  week?: string
  context?: CalendarContext
  /** Internal page-loader seed; never accepted from URL params. */
  contextCalendarIds?: string[]
}

export type CalendarReadyData = {
  context: CalendarContext
  scope: CalendarScope
  anchorDate: Date
  view: CalendarToolbarView
  todayTasks: TodayColumnTask[]
  workspaceId: string | null
  calendars: CalendarWeekData["calendars"]
  events: CalendarDisplayEvent[]
  taskDues: CalendarWeekData["taskDues"]
}

/** Range-scoped payload: events and due chips for the active view window. */
export type CalendarRangeQueryPayload = {
  context: CalendarContext
  scope: CalendarScope
  anchorDate: string
  view: CalendarToolbarView
  workspaceId: string | null
  events: CalendarDisplayEvent[]
  taskDues: CalendarWeekData["taskDues"]
}

/** Infrequently changing calendar chrome: owned and connected sources. */
export type CalendarMetaQueryPayload = {
  context: CalendarContext
  scope: CalendarScope
  workspaceId: string | null
  calendars: CalendarWeekData["calendars"]
}

/** Planning-rail task list — lightweight rows only. */
export type CalendarTodayQueryPayload = {
  context: CalendarContext
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
    todayTasks: today.todayTasks,
  }
}

export function serializeCalendarQueryData(
  data: CalendarReadyData,
): CalendarQueryPayload {
  return {
    context: data.context,
    scope: data.scope,
    anchorDate: dateParam(data.anchorDate),
    view: data.view,
    workspaceId: data.workspaceId,
    calendars: data.calendars,
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
  const context = request.context ?? { kind: "main" }
  const parsed = parseCalendarSearchParams(request)
  const anchorDate = parsed.date
  const view = calendarSupportsView(context, parsed.view)
    ? parsed.view
    : "month"
  const { start, end } = calendarRange(view, anchorDate)
  const workspaceFilter = workspaceFilterForScope(scope, workspaceId)

  const week = await loadCalendarWeek(access.client, access.ownerId, {
    start,
    end,
    eventRange: view === "month" ? "overlaps" : "starts-in",
    includeCalendars: false,
    context,
    contextCalendarIds: request.contextCalendarIds,
    ...workspaceFilter,
  })

  const allowedCalendarIds = new Set(week.calendarIds)
  const events = decorateTaskLinkedEvents({
    // Exceptions may move an occurrence into or out of an isolated calendar.
    // Materialize the complete family first, then filter by effective source.
    events: materializeCalendarEvents({
      standalone: week.events,
      masters: week.recurringMasters,
      exceptions: week.recurrenceExceptions,
      windowStart: start,
      windowEnd: end,
      eventRange: view === "month" ? "overlaps" : "starts-in",
    }).filter((event) => allowedCalendarIds.has(event.calendar_id)),
    tasks: week.linkedTasks.map(toCalendarLinkedTask),
  })

  return {
    scope,
    context,
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
  context: CalendarContext = { kind: "main" },
): Promise<CalendarMetaQueryPayload> {
  const calendars = await loadCalendars(access.client, access.ownerId)

  return {
    scope,
    context,
    workspaceId,
    calendars,
  }
}

export async function fetchCalendarTodayData(
  access: DataAccess,
  workspaceId: string | null,
  scope: CalendarScope,
  context: CalendarContext = { kind: "main" },
  contextCalendarIds?: string[],
): Promise<CalendarTodayQueryPayload> {
  const workspaceFilter = workspaceFilterForScope(scope, workspaceId)
  const taskIds =
    contextCalendarIds === undefined
      ? await loadTaskIdsForCalendarContext(
          access.client,
          access.ownerId,
          context,
        )
      : await loadTaskIdsForCalendarIds(
          access.client,
          access.ownerId,
          contextCalendarIds,
        )
  const tasks = await loadTodayColumnTasks(access.client, access.ownerId, {
    ...workspaceFilter,
    taskIds,
  })

  return {
    scope,
    context,
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
  const context = request.context ?? { kind: "main" }
  const parsed = parseCalendarSearchParams(request)
  const anchorDate = parsed.date
  const view = calendarSupportsView(context, parsed.view)
    ? parsed.view
    : "month"
  const metaPromise = fetchCalendarMetaData(
    access,
    workspaceId,
    scope,
    context,
  )
  // Derive context IDs from meta calendars so range/today do not wait on a
  // separate calendars round-trip before starting.
  const meta = await metaPromise
  const contextCalendarIds = calendarIdsForContext(meta.calendars, context)
  const [range, today] = await Promise.all([
    fetchCalendarRangeData(access, workspaceId, scope, {
      ...request,
      contextCalendarIds,
    }),
    fetchCalendarTodayData(
      access,
      workspaceId,
      scope,
      context,
      contextCalendarIds,
    ),
  ])

  return {
    scope,
    context,
    anchorDate,
    view,
    workspaceId,
    calendars: meta.calendars,
    events: range.events,
    taskDues: range.taskDues,
    todayTasks: today.todayTasks,
  }
}
