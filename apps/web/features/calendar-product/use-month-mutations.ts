"use client"

import { useCallback } from "react"
import type { MonthMoveResult } from "@/lib/calendar/month-drag"
import type { CalendarScope } from "@/lib/calendar/scope-prefs"
import type { CalendarContext } from "@planevo/core/types/calendar"
import type { CalendarView } from "./calendar-toolbar"
import { useCalendarMutations } from "./use-calendar-mutations"

/**
 * Thin adapter: month drag routes through the shared optimistic mutation
 * runner so week/day and month share cancel → multi-cache patch → reconcile.
 */
export function useMonthMutations({
  scope,
  context,
  view,
  anchor,
  onRecurringEventMove,
  onEventMoveCommitted,
}: {
  scope: CalendarScope
  context: CalendarContext
  view: CalendarView
  anchor: Date
  onRecurringEventMove: (
    move: Extract<MonthMoveResult, { kind: "event" }>,
  ) => void
  onEventMoveCommitted: (
    move: Extract<MonthMoveResult, { kind: "event" }>,
  ) => void
}): { applyMonthMove: (move: MonthMoveResult) => void } {
  const { applyMonthMove: applyMove } = useCalendarMutations({
    scope,
    context,
    view,
    anchor,
  })

  const applyMonthMove = useCallback(
    (move: MonthMoveResult) => {
      applyMove(move, { onRecurringEventMove, onEventMoveCommitted })
    },
    [applyMove, onEventMoveCommitted, onRecurringEventMove],
  )

  return { applyMonthMove }
}
