"use client"

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useEffect } from "react"
import { stepAnchor, type CalendarToolbarView } from "@/lib/calendar/calendar-navigation"
import {
  calendarQueryKey,
  calendarQueryScopePrefix,
} from "@/lib/calendar/calendar-query-keys"
import type { CalendarQueryPayload } from "@/lib/calendar/fetch-calendar-page-data"
import { dateParam } from "@/lib/calendar/calendar-range"
import type { CalendarScope } from "@/lib/calendar/scope-prefs"
import type { CalendarView } from "./calendar-toolbar"

type CalendarApiResponse = {
  success: boolean
  error: string | null
  data: CalendarQueryPayload | null
}

async function fetchCalendarQuery(
  scope: CalendarScope,
  view: CalendarToolbarView,
  anchor: Date,
): Promise<CalendarQueryPayload> {
  const params = new URLSearchParams()
  if (scope === "workspace") {
    params.set("scope", "workspace")
  }
  params.set("date", dateParam(anchor))
  params.set("view", view)

  const response = await fetch(`/api/product-calendar?${params.toString()}`)
  const body = (await response.json()) as CalendarApiResponse

  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error ?? "Failed to load calendar data.")
  }

  return body.data
}

export function useCalendarData(scope: CalendarScope, view: CalendarView, anchorDate: Date) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: calendarQueryKey(scope, view, anchorDate),
    queryFn: () => fetchCalendarQuery(scope, view, anchorDate),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  useEffect(() => {
    for (const direction of [-1, 1] as const) {
      const nextAnchor = stepAnchor(view, anchorDate, direction)
      void queryClient.prefetchQuery({
        queryKey: calendarQueryKey(scope, view, nextAnchor),
        queryFn: () => fetchCalendarQuery(scope, view, nextAnchor),
        staleTime: 60_000,
      })
    }
  }, [anchorDate, queryClient, scope, view])

  return query
}

export function useInvalidateCalendarData() {
  const queryClient = useQueryClient()

  return (scope: CalendarScope) => {
    void queryClient.invalidateQueries({
      queryKey: calendarQueryScopePrefix(scope),
    })
  }
}
