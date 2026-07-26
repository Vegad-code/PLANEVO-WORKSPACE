"use client"

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { useEffect, useMemo } from "react"
import { stepAnchor, type CalendarToolbarView } from "@/lib/calendar/calendar-navigation"
import {
  calendarMetaQueryKey,
  calendarMetaScopePrefix,
  calendarQueryScopePrefix,
  calendarRangeQueryKey,
  calendarTodayQueryKey,
  calendarTodayScopePrefix,
} from "@/lib/calendar/calendar-query-keys"
import { invalidateIntersectingRanges } from "@/lib/calendar/calendar-query-cache"
import type {
  CalendarMetaQueryPayload,
  CalendarQueryPayload,
  CalendarRangeQueryPayload,
  CalendarTodayQueryPayload,
} from "@/lib/calendar/fetch-calendar-page-data"
import { mergeCalendarQueryData } from "@/lib/calendar/fetch-calendar-page-data"
import { dateParam } from "@/lib/calendar/calendar-range"
import type { CalendarScope } from "@/lib/calendar/scope-prefs"
import type { CalendarView } from "./calendar-toolbar"

type CalendarApiResponse<T> = {
  success: boolean
  error: string | null
  data: T | null
}

async function fetchCalendarPart<T>(
  part: "range" | "meta" | "today",
  scope: CalendarScope,
  view: CalendarToolbarView,
  anchor: Date,
  signal?: AbortSignal,
): Promise<T> {
  const params = new URLSearchParams({ part })
  if (scope === "workspace") {
    params.set("scope", "workspace")
  }
  if (part === "range") {
    params.set("date", dateParam(anchor))
    params.set("view", view)
  }

  const response = await fetch(`/api/product-calendar?${params.toString()}`, {
    signal,
  })
  const body = (await response.json()) as CalendarApiResponse<T>

  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.error ?? "Failed to load calendar data.")
  }

  return body.data
}

const RANGE_STALE_MS = 60_000
const META_STALE_MS = 300_000
const TODAY_STALE_MS = 30_000

export function useCalendarData(scope: CalendarScope, view: CalendarView, anchorDate: Date) {
  const queryClient = useQueryClient()

  const rangeQuery = useQuery({
    queryKey: calendarRangeQueryKey(scope, view, anchorDate),
    queryFn: ({ signal }) =>
      fetchCalendarPart<CalendarRangeQueryPayload>(
        "range",
        scope,
        view,
        anchorDate,
        signal,
      ),
    placeholderData: keepPreviousData,
    staleTime: RANGE_STALE_MS,
  })

  const metaQuery = useQuery({
    queryKey: calendarMetaQueryKey(scope),
    queryFn: ({ signal }) =>
      fetchCalendarPart<CalendarMetaQueryPayload>(
        "meta",
        scope,
        view,
        anchorDate,
        signal,
      ),
    staleTime: META_STALE_MS,
  })

  const todayQuery = useQuery({
    queryKey: calendarTodayQueryKey(scope),
    queryFn: ({ signal }) =>
      fetchCalendarPart<CalendarTodayQueryPayload>(
        "today",
        scope,
        view,
        anchorDate,
        signal,
      ),
    staleTime: TODAY_STALE_MS,
  })

  useEffect(() => {
    const controllers: AbortController[] = []
    for (const direction of [-1, 1] as const) {
      const nextAnchor = stepAnchor(view, anchorDate, direction)
      const controller = new AbortController()
      controllers.push(controller)
      void queryClient.prefetchQuery({
        queryKey: calendarRangeQueryKey(scope, view, nextAnchor),
        queryFn: () =>
          fetchCalendarPart<CalendarRangeQueryPayload>(
            "range",
            scope,
            view,
            nextAnchor,
            controller.signal,
          ),
        staleTime: RANGE_STALE_MS,
      })
    }
    return () => {
      for (const controller of controllers) controller.abort()
    }
  }, [anchorDate, queryClient, scope, view])

  const data = useMemo<CalendarQueryPayload | undefined>(() => {
    if (!rangeQuery.data || !metaQuery.data || !todayQuery.data) return undefined
    return mergeCalendarQueryData({
      range: rangeQuery.data,
      meta: metaQuery.data,
      today: todayQuery.data,
    })
  }, [metaQuery.data, rangeQuery.data, todayQuery.data])

  return {
    data,
    /** True only while the active range is fetching (not meta/today). */
    isRangeFetching: rangeQuery.isFetching && !rangeQuery.isPlaceholderData,
    isMetaFetching: metaQuery.isFetching,
    isTodayFetching: todayQuery.isFetching,
    isFetching:
      rangeQuery.isFetching || metaQuery.isFetching || todayQuery.isFetching,
    isPlaceholderData: rangeQuery.isPlaceholderData,
    isError: rangeQuery.isError || metaQuery.isError || todayQuery.isError,
    error: rangeQuery.error ?? metaQuery.error ?? todayQuery.error,
  }
}

export function useInvalidateCalendarData() {
  const queryClient = useQueryClient()

  return (scope: CalendarScope) => {
    void queryClient.invalidateQueries({
      queryKey: calendarQueryScopePrefix(scope),
    })
    void queryClient.invalidateQueries({
      queryKey: calendarMetaScopePrefix(scope),
    })
    void queryClient.invalidateQueries({
      queryKey: calendarTodayScopePrefix(scope),
    })
  }
}

export function useInvalidateActiveCalendarRange() {
  const queryClient = useQueryClient()

  return ({
    scope,
    view,
    anchor,
  }: {
    scope: CalendarScope
    view: CalendarView
    anchor: Date
  }) => {
    void queryClient.invalidateQueries({
      queryKey: calendarRangeQueryKey(scope, view, anchor),
    })
  }
}

export function useInvalidateIntersectingRanges() {
  const queryClient = useQueryClient()

  return ({
    scope,
    start,
    end,
  }: {
    scope: CalendarScope
    start: string
    end: string
  }) => {
    invalidateIntersectingRanges({ queryClient, scope, start, end })
  }
}

export function useInvalidateCalendarMeta() {
  const queryClient = useQueryClient()

  return (scope: CalendarScope) => {
    void queryClient.invalidateQueries({
      queryKey: calendarMetaScopePrefix(scope),
    })
  }
}

export function useCalendarQueryKeys({
  scope,
  view,
  anchor,
}: {
  scope: CalendarScope
  view: CalendarView
  anchor: Date
}) {
  return {
    rangeKey: calendarRangeQueryKey(scope, view, anchor),
    metaKey: calendarMetaQueryKey(scope),
    todayKey: calendarTodayQueryKey(scope),
  }
}
