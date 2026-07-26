import { NextResponse } from "next/server"
import {
  fetchCalendarMetaData,
  fetchCalendarRangeData,
  fetchCalendarTodayData,
  serializeCalendarQueryData,
} from "@/lib/calendar/fetch-calendar-page-data"
import { getDataAccess } from "@/lib/data/access"
import { getCurrentWorkspace } from "@/lib/data/current-workspace"
import type { CalendarScope } from "@/lib/calendar/scope-prefs"

function requestedScope(value: string | null): CalendarScope {
  return value === "workspace" ? "workspace" : "all"
}

type CalendarPart = "range" | "meta" | "today" | "all"

function requestedPart(value: string | null): CalendarPart {
  if (value === "range" || value === "meta" || value === "today") return value
  return "all"
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const scope = requestedScope(searchParams.get("scope"))
  const part = requestedPart(searchParams.get("part"))
  const date = searchParams.get("date") ?? undefined
  const view = searchParams.get("view") ?? undefined
  const week = searchParams.get("week") ?? undefined

  const currentWorkspace = await getCurrentWorkspace()
  const access = currentWorkspace?.access ?? (await getDataAccess())

  if (!access) {
    return NextResponse.json(
      { success: false, error: "Sign in to see your calendar.", data: null },
      { status: 401 },
    )
  }

  let workspaceId = currentWorkspace?.workspace.id ?? null
  let resolvedScope = scope

  if (scope === "workspace" && workspaceId === null) {
    resolvedScope = "all"
  }

  try {
    if (part === "range") {
      const data = await fetchCalendarRangeData(
        access,
        workspaceId,
        resolvedScope,
        { date, view, week },
      )
      return NextResponse.json({ success: true, error: null, data })
    }

    if (part === "meta") {
      const data = await fetchCalendarMetaData(
        access,
        workspaceId,
        resolvedScope,
      )
      return NextResponse.json({ success: true, error: null, data })
    }

    if (part === "today") {
      const data = await fetchCalendarTodayData(
        access,
        workspaceId,
        resolvedScope,
      )
      return NextResponse.json({ success: true, error: null, data })
    }

    const [range, meta, today] = await Promise.all([
      fetchCalendarRangeData(access, workspaceId, resolvedScope, {
        date,
        view,
        week,
      }),
      fetchCalendarMetaData(access, workspaceId, resolvedScope),
      fetchCalendarTodayData(access, workspaceId, resolvedScope),
    ])

    return NextResponse.json({
      success: true,
      error: null,
      data: serializeCalendarQueryData({
        scope: resolvedScope,
        anchorDate: new Date(range.anchorDate),
        view: range.view,
        workspaceId,
        calendars: meta.calendars,
        views: meta.views,
        events: range.events,
        taskDues: range.taskDues,
        todayTasks: today.todayTasks,
      }),
    })
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to load calendar data.", data: null },
      { status: 500 },
    )
  }
}
