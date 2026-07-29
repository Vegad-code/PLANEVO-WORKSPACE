import type {
  CalendarEmbedTarget,
  CalendarSurfaceView,
} from "@planevo/core/types/calendar"
import { dateParam } from "./calendar-range.ts"
import type { CalendarPageRequest } from "./fetch-calendar-page-data.ts"

export function parseCalendarEmbedTarget({
  targetKind,
  calendarId,
}: {
  targetKind: string
  calendarId?: string
}): CalendarEmbedTarget | null {
  if (targetKind === "main") return { kind: "main" }
  if (targetKind !== "calendar") return null
  const id = calendarId?.trim()
  return id ? { kind: "calendar", calendarId: id } : null
}

export function embeddedCalendarRequest({
  target,
  view,
  now,
}: {
  target: CalendarEmbedTarget
  view: CalendarSurfaceView
  now: Date
}): CalendarPageRequest {
  return {
    context: target,
    date: dateParam(now),
    view: view === "year" ? "month" : view,
  }
}
