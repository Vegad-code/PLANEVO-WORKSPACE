import type {
  CalendarContext,
  CalendarSurfaceView,
} from "@planevo/core/types/calendar"
import { dateParam } from "./calendar-range.ts"
import type { CalendarScope } from "./scope-prefs.ts"

type CalendarContextProjection = {
  id: string
  is_main: boolean
  is_included_in_main: boolean
}

export function parseCalendarContext(
  calendarId?: string,
): CalendarContext | null {
  if (calendarId === undefined) return { kind: "main" }
  const normalizedId = calendarId.trim()
  return normalizedId
    ? { kind: "calendar", calendarId: normalizedId }
    : null
}

export function calendarContextKey(context: CalendarContext): string {
  return context.kind === "main"
    ? "main"
    : `calendar:${context.calendarId}`
}

export function calendarHref(
  context: CalendarContext,
  state?: {
    scope: CalendarScope
    date: Date
    view: CalendarSurfaceView
  },
): string {
  const pathname = context.kind === "main"
    ? "/calendar"
    : `/calendar/c/${encodeURIComponent(context.calendarId)}`
  if (!state) return pathname

  const params = new URLSearchParams()
  if (state.scope === "workspace") {
    params.set("scope", "workspace")
  }
  params.set("date", dateParam(state.date))
  params.set(
    "view",
    calendarSupportsView(context, state.view) ? state.view : "month",
  )
  return `${pathname}?${params.toString()}`
}

export function calendarSupportsView(
  context: CalendarContext,
  view: CalendarSurfaceView,
): boolean {
  return view !== "year" || context.kind === "main"
}

export function filterCalendarsForContext<
  TCalendar extends CalendarContextProjection,
>(
  calendars: readonly TCalendar[],
  context: CalendarContext,
): TCalendar[] {
  if (context.kind === "calendar") {
    return calendars.filter(({ id }) => id === context.calendarId)
  }
  return calendars.filter(
    ({ is_main, is_included_in_main }) =>
      is_main || is_included_in_main,
  )
}

export function calendarIdsForContext<
  TCalendar extends CalendarContextProjection,
>(
  calendars: readonly TCalendar[],
  context: CalendarContext,
): string[] {
  return filterCalendarsForContext(calendars, context).map(({ id }) => id)
}
