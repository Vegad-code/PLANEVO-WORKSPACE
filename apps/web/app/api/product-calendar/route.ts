import { NextResponse } from "next/server"
import {
  fetchCalendarPageData,
  serializeCalendarQueryData,
} from "@/lib/calendar/fetch-calendar-page-data"
import { getDataAccess } from "@/lib/data/access"
import { getCurrentWorkspace } from "@/lib/data/current-workspace"
import type { CalendarScope } from "@/lib/calendar/scope-prefs"

function requestedScope(value: string | null): CalendarScope {
  return value === "workspace" ? "workspace" : "all"
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const scope = requestedScope(searchParams.get("scope"))
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
    const ready = await fetchCalendarPageData(
      access,
      workspaceId,
      resolvedScope,
      { date, view, week },
    )

    return NextResponse.json({
      success: true,
      error: null,
      data: serializeCalendarQueryData(ready),
    })
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to load calendar data.", data: null },
      { status: 500 },
    )
  }
}
