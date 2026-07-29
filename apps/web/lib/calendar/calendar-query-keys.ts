import type { CalendarToolbarView } from "./calendar-navigation.ts"
import { calendarRange, dateParam } from "./calendar-range.ts"
import type { CalendarScope } from "./scope-prefs.ts"
import {
  calendarContextKey,
} from "./calendar-context.ts"
import type { CalendarContext } from "@planevo/core/types/calendar"

export function calendarRangeQueryKey(
  scope: CalendarScope,
  context: CalendarContext,
  view: CalendarToolbarView,
  anchor: Date,
) {
  const { start, end } = calendarRange(view, anchor)
  return [
    "calendar",
    scope,
    calendarContextKey(context),
    view,
    dateParam(start),
    dateParam(end),
  ] as const
}

/** @deprecated Use calendarRangeQueryKey — kept for incremental migration. */
export const calendarQueryKey = calendarRangeQueryKey

export function calendarMetaQueryKey(
  scope: CalendarScope,
  context: CalendarContext,
) {
  void scope
  void context
  return ["calendar-meta"] as const
}

export function calendarTodayQueryKey(
  scope: CalendarScope,
  context: CalendarContext,
) {
  return ["calendar-today", scope, calendarContextKey(context)] as const
}

export function calendarQueryScopePrefix(
  scope: CalendarScope,
  context?: CalendarContext,
) {
  return context
    ? (["calendar", scope, calendarContextKey(context)] as const)
    : (["calendar", scope] as const)
}

export function calendarMetaScopePrefix(scope: CalendarScope) {
  void scope
  return ["calendar-meta"] as const
}

export function calendarTodayScopePrefix(scope: CalendarScope) {
  return ["calendar-today", scope] as const
}
