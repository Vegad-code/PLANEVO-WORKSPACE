"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
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
import {
  invalidateIntersectingRanges,
  writeMergedCalendarCache,
} from "@/lib/calendar/calendar-query-cache"
import type {
  CalendarMetaQueryPayload,
  CalendarQueryPayload,
  CalendarRangeQueryPayload,
  CalendarTodayQueryPayload,
} from "@/lib/calendar/fetch-calendar-page-data"
import { mergeCalendarQueryData } from "@/lib/calendar/fetch-calendar-page-data"
import { dateParam } from "@/lib/calendar/calendar-range"
import { calendarRenderSlices } from "@/lib/calendar/calendar-render-slices"
import type { CalendarScope } from "@/lib/calendar/scope-prefs"
import type { CalendarView } from "./calendar-toolbar"
import type { CalendarContext } from "@planevo/core/types/calendar"

type CalendarApiResponse<T> = {
  success: boolean
  error: string | null
  data: T | null
}

async function fetchCalendarPart<T>(
  part: "range" | "meta" | "today" | "all",
  scope: CalendarScope,
  context: CalendarContext,
  view: CalendarToolbarView,
  anchor: Date,
  signal?: AbortSignal,
): Promise<T> {
  const params = new URLSearchParams({ part })
  params.set("context", context.kind)
  if (context.kind === "calendar") {
    params.set("calendarId", context.calendarId)
  }
  if (scope === "workspace") {
    params.set("scope", "workspace")
  }
  if (part === "range" || part === "all") {
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

export function useCalendarData(
  scope: CalendarScope,
  context: CalendarContext,
  view: CalendarView,
  anchorDate: Date,
) {
  const queryClient = useQueryClient()
  const rangeKey = useMemo(
    () => calendarRangeQueryKey(scope, context, view, anchorDate),
    [anchorDate, context, scope, view],
  )
  const metaKey = useMemo(
    () => calendarMetaQueryKey(scope, context),
    [context, scope],
  )
  const todayKey = useMemo(
    () => calendarTodayQueryKey(scope, context),
    [context, scope],
  )
  const shouldBootstrap =
    queryClient.getQueryData(rangeKey) === undefined &&
    queryClient.getQueryData(todayKey) === undefined

  const bootstrapQuery = useQuery({
    queryKey: ["calendar-bootstrap", ...rangeKey],
    queryFn: ({ signal }) =>
      fetchCalendarPart<CalendarQueryPayload>(
        "all",
        scope,
        context,
        view,
        anchorDate,
        signal,
      ),
    enabled: shouldBootstrap,
    staleTime: RANGE_STALE_MS,
  })
  const bootstrapData = shouldBootstrap ? bootstrapQuery.data : undefined

  const rangeQuery = useQuery({
    queryKey: rangeKey,
    queryFn: ({ signal }) =>
      fetchCalendarPart<CalendarRangeQueryPayload>(
        "range",
        scope,
        context,
        view,
        anchorDate,
        signal,
      ),
    enabled: !shouldBootstrap,
    staleTime: RANGE_STALE_MS,
  })

  const metaQuery = useQuery({
    queryKey: metaKey,
    queryFn: ({ signal }) =>
      fetchCalendarPart<CalendarMetaQueryPayload>(
        "meta",
        scope,
        context,
        view,
        anchorDate,
        signal,
      ),
    enabled: !shouldBootstrap,
    staleTime: META_STALE_MS,
  })

  const todayQuery = useQuery({
    queryKey: todayKey,
    queryFn: ({ signal }) =>
      fetchCalendarPart<CalendarTodayQueryPayload>(
        "today",
        scope,
        context,
        view,
        anchorDate,
        signal,
      ),
    enabled: !shouldBootstrap,
    staleTime: TODAY_STALE_MS,
  })

  useEffect(() => {
    if (!bootstrapQuery.data) return
    writeMergedCalendarCache(
      queryClient,
      { rangeKey, metaKey, todayKey },
      bootstrapQuery.data,
    )
  }, [
    bootstrapQuery.data,
    metaKey,
    queryClient,
    rangeKey,
    todayKey,
  ])

  useEffect(() => {
    let active = true
    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: () => void,
        options?: { timeout: number },
      ) => number
      cancelIdleCallback?: (handle: number) => void
    }

    const prefetchAdjacentRanges = () => {
      if (!active) return
      for (const direction of [-1, 1] as const) {
        const nextAnchor = stepAnchor(view, anchorDate, direction)
        void queryClient.prefetchQuery({
          queryKey: calendarRangeQueryKey(scope, context, view, nextAnchor),
          queryFn: ({ signal }) =>
            fetchCalendarPart<CalendarRangeQueryPayload>(
              "range",
              scope,
              context,
              view,
              nextAnchor,
              signal,
            ),
          staleTime: RANGE_STALE_MS,
        })
      }
    }

    const idleHandle = idleWindow.requestIdleCallback?.(
      prefetchAdjacentRanges,
      { timeout: 2_000 },
    )
    const timeoutHandle =
      idleHandle === undefined
        ? window.setTimeout(prefetchAdjacentRanges, 750)
        : null

    return () => {
      active = false
      if (idleHandle !== undefined) {
        idleWindow.cancelIdleCallback?.(idleHandle)
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle)
      }
    }
  }, [anchorDate, context, queryClient, scope, view])

  const data = useMemo<CalendarQueryPayload | undefined>(() => {
    if (bootstrapData) return bootstrapData
    if (!rangeQuery.data || !metaQuery.data || !todayQuery.data) return undefined
    return mergeCalendarQueryData({
      range: rangeQuery.data,
      meta: metaQuery.data,
      today: todayQuery.data,
    })
  }, [
    bootstrapData,
    metaQuery.data,
    rangeQuery.data,
    todayQuery.data,
  ])
  const slices = useMemo(
    () => {
      if (bootstrapData) {
        return {
          calendars: bootstrapData.calendars,
          events: bootstrapData.events,
          taskDues: bootstrapData.taskDues,
          todayTasks: bootstrapData.todayTasks,
        }
      }
      return calendarRenderSlices({
        range: rangeQuery.data,
        meta: metaQuery.data,
        today: todayQuery.data,
      })
    },
    [
      bootstrapData,
      metaQuery.data,
      rangeQuery.data,
      todayQuery.data,
    ],
  )

  return {
    data,
    ...slices,
    /** True only while the active range is fetching (not meta/today). */
    isRangeFetching: rangeQuery.isFetching || bootstrapQuery.isFetching,
    isRangePending:
      !bootstrapData && !rangeQuery.data && rangeQuery.isPending,
    isMetaFetching: metaQuery.isFetching || bootstrapQuery.isFetching,
    isMetaPending:
      !bootstrapData && !metaQuery.data && metaQuery.isPending,
    isTodayFetching: todayQuery.isFetching || bootstrapQuery.isFetching,
    isTodayPending:
      !bootstrapData && !todayQuery.data && todayQuery.isPending,
    isFetching:
      bootstrapQuery.isFetching ||
      rangeQuery.isFetching ||
      metaQuery.isFetching ||
      todayQuery.isFetching,
    isError:
      bootstrapQuery.isError ||
      rangeQuery.isError ||
      metaQuery.isError ||
      todayQuery.isError,
    error:
      bootstrapQuery.error ??
      rangeQuery.error ??
      metaQuery.error ??
      todayQuery.error,
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
    context,
    view,
    anchor,
  }: {
    scope: CalendarScope
    context: CalendarContext
    view: CalendarView
    anchor: Date
  }) => {
    void queryClient.invalidateQueries({
      queryKey: calendarRangeQueryKey(scope, context, view, anchor),
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
  context,
  view,
  anchor,
}: {
  scope: CalendarScope
  context: CalendarContext
  view: CalendarView
  anchor: Date
}) {
  return {
    rangeKey: calendarRangeQueryKey(scope, context, view, anchor),
    metaKey: calendarMetaQueryKey(scope, context),
    todayKey: calendarTodayQueryKey(scope, context),
  }
}
