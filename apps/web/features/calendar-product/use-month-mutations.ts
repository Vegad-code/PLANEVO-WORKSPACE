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
}: {
  scope: CalendarScope
  anchor: Date
  onSettled: () => void
}): { applyMonthMove: (move: MonthMoveResult) => void } {
  const queryClient = useQueryClient()

  const applyMonthMove = useCallback(
    (move: MonthMoveResult) => {
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
        }
        onSettled()
      })()
    },
    [anchor, onSettled, queryClient, scope],
  )

  return { applyMonthMove }
}
