import {
  loadCalendarWeek,
  type CalendarWeekData,
} from "@planevo/core/queries/product-calendar"
import { loadProductTasks } from "@planevo/core/queries/product-tasks"
import type { DataAccess } from "@planevo/core/types/data-access"
import {
  parseCalendarSearchParams,
  type CalendarToolbarView,
} from "@/lib/calendar/calendar-navigation"
import { calendarRange, dateParam } from "@/lib/calendar/calendar-range"
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
} & CalendarWeekData

/** Serializable payload for TanStack Query cache and API responses. */
export type CalendarQueryPayload = {
  scope: CalendarScope
  anchorDate: string
  view: CalendarToolbarView
  workspaceId: string | null
  calendars: CalendarWeekData["calendars"]
  events: CalendarWeekData["events"]
  taskDues: CalendarWeekData["taskDues"]
  todayTasks: TodayColumnTask[]
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
    events: data.events,
    taskDues: data.taskDues,
    todayTasks: data.todayTasks,
  }
}

export async function fetchCalendarPageData(
  access: DataAccess,
  workspaceId: string | null,
  scope: CalendarScope,
  request: CalendarPageRequest = {},
): Promise<CalendarReadyData> {
  const { date: anchorDate, view } = parseCalendarSearchParams(request)
  const { start, end } = calendarRange(view, anchorDate)
  const workspaceFilter =
    scope === "workspace" && workspaceId ? { workspaceId } : {}

  const [week, tasks] = await Promise.all([
    loadCalendarWeek(access.client, access.ownerId, {
      start,
      end,
      eventRange: view === "month" ? "overlaps" : "starts-in",
      ...workspaceFilter,
    }),
    loadProductTasks(access.client, access.ownerId, workspaceFilter),
  ])

  const todayTasks: TodayColumnTask[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    due_at: task.due_at,
  }))

  return {
    scope,
    anchorDate,
    view,
    todayTasks,
    workspaceId,
    ...week,
  }
}
