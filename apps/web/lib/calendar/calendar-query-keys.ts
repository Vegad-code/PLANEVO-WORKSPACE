import type { CalendarToolbarView } from "./calendar-navigation.ts"
import { calendarRange, dateParam } from "./calendar-range.ts"
import type { CalendarScope } from "./scope-prefs.ts"

export function calendarQueryKey(
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

export function calendarQueryScopePrefix(scope: CalendarScope) {
  return ["calendar", scope] as const
}
