import "server-only"

import { getDataAccess } from "@/lib/data/access"
import { getCurrentWorkspace } from "@/lib/data/current-workspace"
import {
  fetchCalendarPageData,
  type CalendarPageRequest,
  type CalendarReadyData,
  serializeCalendarQueryData,
  type CalendarQueryPayload,
} from "@/lib/calendar/fetch-calendar-page-data"
import type { CalendarScope } from "@/lib/calendar/scope-prefs"
import type { CalendarToolbarView } from "@/lib/calendar/calendar-navigation"

export type { CalendarPageRequest, CalendarQueryPayload, CalendarReadyData }
export { fetchCalendarPageData, serializeCalendarQueryData }

export type CalendarPageData =
  | {
      status: "unauthenticated"
      scope: CalendarScope
    }
  | ({
      status: "ready"
      initialView: CalendarToolbarView
    } & Omit<CalendarReadyData, "view">)

/**
 * Server loader for the Calendar product. Event window follows `view` + `date`
 * (Sunday-start weeks). Legacy `week=YYYY-Www` is still accepted.
 */
export async function loadCalendarPageData(
  scope: CalendarScope = "all",
  request: CalendarPageRequest = {},
): Promise<CalendarPageData> {
  const currentWorkspace = await getCurrentWorkspace()
  const access = currentWorkspace?.access ?? (await getDataAccess())

  if (!access) {
    return { status: "unauthenticated", scope }
  }

  const workspaceId = currentWorkspace?.workspace.id ?? null
  const ready = await fetchCalendarPageData(access, workspaceId, scope, request)

  return {
    status: "ready",
    scope: ready.scope,
    anchorDate: ready.anchorDate,
    initialView: ready.view,
    todayTasks: ready.todayTasks,
    workspaceId: ready.workspaceId,
    calendars: ready.calendars,
    views: ready.views,
    events: ready.events,
    taskDues: ready.taskDues,
  }
}
