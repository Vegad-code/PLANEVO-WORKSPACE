import { parseWeekParam } from "@planevo/core/state/calendar-state"
import { dateParam, parseCalendarDate } from "./calendar-range.ts"
import type { CalendarScope } from "./scope-prefs.ts"

export type CalendarToolbarView = "day" | "week" | "month" | "year"

const TOOLBAR_VIEWS = new Set<CalendarToolbarView>([
  "day",
  "week",
  "month",
  "year",
])

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

/** Sunday 00:00 for the week containing `date` (Google Calendar week). */
export function startOfWeekSunday(date: Date): Date {
  const start = startOfDay(date)
  start.setDate(start.getDate() - start.getDay())
  return start
}

export function parseCalendarToolbarView(value?: string): CalendarToolbarView {
  return value && TOOLBAR_VIEWS.has(value as CalendarToolbarView)
    ? (value as CalendarToolbarView)
    : "week"
}

export function stepAnchor(
  view: CalendarToolbarView,
  anchor: Date,
  direction: -1 | 1,
): Date {
  const normalized = startOfDay(anchor)
  if (view === "day") {
    return addDays(normalized, direction)
  }
  if (view === "week") {
    return addDays(normalized, direction * 7)
  }
  if (view === "month") {
    return new Date(
      normalized.getFullYear(),
      normalized.getMonth() + direction,
      normalized.getDate(),
    )
  }
  return new Date(
    normalized.getFullYear() + direction,
    normalized.getMonth(),
    normalized.getDate(),
  )
}

export function goToToday(now: Date = new Date()): Date {
  return startOfDay(now)
}

export function switchView(
  _currentView: CalendarToolbarView,
  anchor: Date,
  _nextView: CalendarToolbarView,
): Date {
  return startOfDay(anchor)
}

export function formatToolbarTitle(
  anchor: Date,
  view: CalendarToolbarView,
  now: Date = new Date(),
): string {
  const normalized = startOfDay(anchor)

  if (view === "year") {
    return String(normalized.getFullYear())
  }

  if (view === "month") {
    return normalized.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    })
  }

  if (view === "day") {
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      month: "long",
      day: "numeric",
    }
    if (normalized.getFullYear() !== now.getFullYear()) {
      options.year = "numeric"
    }
    return normalized.toLocaleDateString(undefined, options)
  }

  const weekStart = startOfWeekSunday(normalized)
  const weekEnd = addDays(weekStart, 6)
  const startMonth = weekStart.getMonth()
  const endMonth = weekEnd.getMonth()
  const startYear = weekStart.getFullYear()
  const endYear = weekEnd.getFullYear()

  if (startMonth === endMonth && startYear === endYear) {
    return weekStart.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    })
  }

  if (startYear === endYear) {
    const startLabel = weekStart.toLocaleDateString(undefined, { month: "short" })
    const endLabel = weekEnd.toLocaleDateString(undefined, { month: "short" })
    return `${startLabel} – ${endLabel} ${endYear}`
  }

  const startLabel = weekStart.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  })
  const endLabel = weekEnd.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  })
  return `${startLabel} – ${endLabel}`
}

export function parseCalendarSearchParams(params: {
  date?: string
  view?: string
  week?: string
}): { date: Date; view: CalendarToolbarView } {
  const view = parseCalendarToolbarView(params.view)

  if (params.date) {
    return { date: parseCalendarDate(params.date), view }
  }

  if (params.week) {
    const legacyMonday = parseWeekParam(params.week)
    if (legacyMonday) {
      return { date: startOfDay(legacyMonday), view }
    }
  }

  return { date: startOfDay(new Date()), view }
}

export function buildCalendarSearchParams(input: {
  scope?: CalendarScope
  date: Date
  view: CalendarToolbarView
}): string {
  const params = new URLSearchParams()
  if (input.scope === "workspace") {
    params.set("scope", "workspace")
  }
  params.set("date", dateParam(input.date))
  params.set("view", input.view)
  const query = params.toString()
  return query ? `/calendar?${query}` : "/calendar"
}
