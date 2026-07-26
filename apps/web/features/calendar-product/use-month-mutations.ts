"use client"

import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  updateEventTimesAction,
  updateTaskDueDateAction,
} from "@/app/(workspace)/calendar/actions"
import { calendarQueryKey } from "@/lib/calendar/calendar-query-keys"
import {
  patchEventTimes,
  patchTaskDueDate,
} from "@/lib/calendar/calendar-query-optimistic"
import type { CalendarQueryPayload } from "@/lib/calendar/fetch-calendar-page-data"
import type { MonthMoveResult } from "@/lib/calendar/month-drag"
import type { CalendarScope } from "@/lib/calendar/scope-prefs"
import { toast } from "@/components/ui/toast"
import { resolveEventMutationTarget } from "@/lib/calendar/event-mutation-target"

/**
 * Applies a month drag optimistically, then reconciles with the server.
 *
 * Dragging has to look instant, so the cached payload is patched before the
 * request goes out and rolled back to the exact snapshot if it fails. The other
 * calendar mutations are fire-and-invalidate, which is fine for click-driven
 * edits but reads as lag when you are dragging something across a grid.
 */
export function useMonthMutations({
  scope,
  anchor,
  onSettled,
  onRecurringEventMove,
  onEventMoveCommitted,
}: {
  scope: CalendarScope
  anchor: Date
  onSettled: () => void
  onRecurringEventMove: (
    move: Extract<MonthMoveResult, { kind: "event" }>,
  ) => void
  onEventMoveCommitted: (
    move: Extract<MonthMoveResult, { kind: "event" }>,
  ) => void
}): { applyMonthMove: (move: MonthMoveResult) => void } {
  const queryClient = useQueryClient()

  const applyMonthMove = useCallback(
    (move: MonthMoveResult) => {
      if (
        move.kind === "event" &&
        resolveEventMutationTarget(move.event)?.kind !== "standalone"
      ) {
        onRecurringEventMove(move)
        return
      }

      const queryKey = calendarQueryKey(scope, "month", anchor)
      const previous =
        queryClient.getQueryData<CalendarQueryPayload>(queryKey)

      if (previous) {
        queryClient.setQueryData(
          queryKey,
          move.kind === "event"
            ? patchEventTimes(previous, move)
            : patchTaskDueDate(previous, move),
        )
      }

      void (async () => {
        const result =
          move.kind === "event"
            ? await updateEventTimesAction(move)
            : await updateTaskDueDateAction(move)

        if (!result.ok) {
          if (previous) queryClient.setQueryData(queryKey, previous)
          toast(result.error, { tone: "error" })
        } else if (move.kind === "event") {
          onEventMoveCommitted(move)
        }
        onSettled()
      })()
    },
    [
      anchor,
      onEventMoveCommitted,
      onRecurringEventMove,
      onSettled,
      queryClient,
      scope,
    ],
  )

  return { applyMonthMove }
}
