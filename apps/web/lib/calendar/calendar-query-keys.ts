import type { CalendarToolbarView } from "./calendar-navigation.ts"
import { calendarRange, dateParam } from "./calendar-range.ts"
import type { CalendarScope } from "./scope-prefs.ts"

export function calendarRangeQueryKey(
  scope: CalendarScope,
  view: CalendarToolbarView,
  anchor: Date,
) {
  const { start, end } = calendarRange(view, anchor)
  return [
    "calendar",
    scope,
    view,
    dateParam(start),
    dateParam(end),
  ] as const
}

/** @deprecated Use calendarRangeQueryKey — kept for incremental migration. */
export const calendarQueryKey = calendarRangeQueryKey

export function calendarMetaQueryKey(scope: CalendarScope) {
  return ["calendar-meta", scope] as const
}

export function calendarTodayQueryKey(scope: CalendarScope) {
  return ["calendar-today", scope] as const
}

export function calendarQueryScopePrefix(scope: CalendarScope) {
  return ["calendar", scope] as const
}

export function calendarMetaScopePrefix(scope: CalendarScope) {
  return ["calendar-meta", scope] as const
}

export function calendarTodayScopePrefix(scope: CalendarScope) {
  return ["calendar-today", scope] as const
}
