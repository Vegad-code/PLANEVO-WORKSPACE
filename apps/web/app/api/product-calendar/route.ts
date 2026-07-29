import { NextResponse } from "next/server"
import {
  fetchCalendarMetaData,
  fetchCalendarPageData,
  fetchCalendarRangeData,
  fetchCalendarTodayData,
  serializeCalendarQueryData,
} from "@/lib/calendar/fetch-calendar-page-data"
import { getDataAccess } from "@/lib/data/access"
import { getCurrentWorkspace } from "@/lib/data/current-workspace"
import type { CalendarScope } from "@/lib/calendar/scope-prefs"
import type { CalendarContext } from "@planevo/core/types/calendar"
import { z } from "zod"

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
  const contextKind = searchParams.get("context")
  const calendarId = searchParams.get("calendarId")
  const context: CalendarContext =
    contextKind === "calendar" && z.string().uuid().safeParse(calendarId).success
      ? { kind: "calendar", calendarId: calendarId as string }
      : { kind: "main" }
  if (contextKind === "calendar" && context.kind !== "calendar") {
    return NextResponse.json(
      { success: false, error: "Calendar not found.", data: null },
      { status: 400 },
    )
  }

  const currentWorkspace = await getCurrentWorkspace()
  const access = currentWorkspace?.access ?? (await getDataAccess())

  if (!access) {
    return NextResponse.json(
      { success: false, error: "Sign in to see your calendar.", data: null },
      { status: 401 },
    )
  }

  const workspaceId = currentWorkspace?.workspace.id ?? null
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
        { date, view, week, context },
      )
      return NextResponse.json({ success: true, error: null, data })
    }

    if (part === "meta") {
      const data = await fetchCalendarMetaData(
        access,
        workspaceId,
        resolvedScope,
        context,
      )
      return NextResponse.json({ success: true, error: null, data })
    }

    if (part === "today") {
      const data = await fetchCalendarTodayData(
        access,
        workspaceId,
        resolvedScope,
        context,
      )
      return NextResponse.json({ success: true, error: null, data })
    }

    const data = await fetchCalendarPageData(
      access,
      workspaceId,
      resolvedScope,
      { date, view, week, context },
    )

    return NextResponse.json({
      success: true,
      error: null,
      data: serializeCalendarQueryData(data),
    })
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to load calendar data.", data: null },
      { status: 500 },
    )
  }
}
