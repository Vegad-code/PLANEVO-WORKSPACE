import type { QueryClient, QueryKey } from "@tanstack/react-query"
import {
  calendarMetaQueryKey,
  calendarMetaScopePrefix,
  calendarQueryScopePrefix,
  calendarRangeQueryKey,
  calendarTodayQueryKey,
  calendarTodayScopePrefix,
} from "@/lib/calendar/calendar-query-keys"
import {
  mergeCalendarQueryData,
  type CalendarMetaQueryPayload,
  type CalendarQueryPayload,
  type CalendarRangeQueryPayload,
  type CalendarTodayQueryPayload,
} from "@/lib/calendar/fetch-calendar-page-data"
import {
  eventWindowFromIso,
  rangesIntersect,
  type EventTimeWindow,
} from "@/lib/calendar/calendar-range-intersect"
import type { CalendarScope } from "@/lib/calendar/scope-prefs"
import type { CalendarView } from "@/features/calendar-product/calendar-toolbar"

export type { EventTimeWindow }
export { eventWindowFromIso, rangesIntersect }

export type CalendarCacheKeys = {
  rangeKey: ReturnType<typeof calendarRangeQueryKey>
  metaKey: ReturnType<typeof calendarMetaQueryKey>
  todayKey: ReturnType<typeof calendarTodayQueryKey>
}

/** Snapshot of every cache entry touched by an optimistic mutation. */
export type CalendarCacheSnapshot = {
  entries: Array<{
    queryKey: QueryKey
    data: unknown
  }>
}

export function calendarCacheKeys({
  scope,
  view,
  anchor,
}: {
  scope: CalendarScope
  view: CalendarView
  anchor: Date
}): CalendarCacheKeys {
  return {
    rangeKey: calendarRangeQueryKey(scope, view, anchor),
    metaKey: calendarMetaQueryKey(scope),
    todayKey: calendarTodayQueryKey(scope),
  }
}

/**
 * Cancel in-flight calendar fetches so they cannot overwrite an optimistic
 * patch that lands while a prior GET is still in flight.
 */
export async function cancelCalendarQueries(
  queryClient: QueryClient,
  scope: CalendarScope,
): Promise<void> {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: calendarQueryScopePrefix(scope) }),
    queryClient.cancelQueries({ queryKey: calendarMetaScopePrefix(scope) }),
    queryClient.cancelQueries({ queryKey: calendarTodayScopePrefix(scope) }),
  ])
}

export function readMergedCalendarCache(
  queryClient: QueryClient,
  keys: CalendarCacheKeys,
): CalendarQueryPayload | undefined {
  const range = queryClient.getQueryData<CalendarRangeQueryPayload>(keys.rangeKey)
  const meta = queryClient.getQueryData<CalendarMetaQueryPayload>(keys.metaKey)
  const today = queryClient.getQueryData<CalendarTodayQueryPayload>(keys.todayKey)
  if (!range || !meta || !today) return undefined
  return mergeCalendarQueryData({ range, meta, today })
}

export function writeMergedCalendarCache(
  queryClient: QueryClient,
  keys: CalendarCacheKeys,
  payload: CalendarQueryPayload,
): void {
  queryClient.setQueryData<CalendarRangeQueryPayload>(keys.rangeKey, {
    scope: payload.scope,
    anchorDate: payload.anchorDate,
    view: payload.view,
    workspaceId: payload.workspaceId,
    events: payload.events,
    taskDues: payload.taskDues,
  })
  queryClient.setQueryData<CalendarMetaQueryPayload>(keys.metaKey, {
    scope: payload.scope,
    workspaceId: payload.workspaceId,
    calendars: payload.calendars,
    views: payload.views,
  })
  queryClient.setQueryData<CalendarTodayQueryPayload>(keys.todayKey, {
    scope: payload.scope,
    todayTasks: payload.todayTasks,
  })
}

export function patchMergedCalendarCache(
  queryClient: QueryClient,
  keys: CalendarCacheKeys,
  patch: (payload: CalendarQueryPayload) => CalendarQueryPayload,
): CalendarQueryPayload | undefined {
  const current = readMergedCalendarCache(queryClient, keys)
  if (!current) return undefined
  const next = patch(current)
  writeMergedCalendarCache(queryClient, keys, next)
  return current
}

function isRangeQueryKey(
  queryKey: QueryKey,
  scope: CalendarScope,
): queryKey is readonly ["calendar", CalendarScope, string, string, string] {
  return (
    Array.isArray(queryKey) &&
    queryKey.length === 5 &&
    queryKey[0] === "calendar" &&
    queryKey[1] === scope &&
    typeof queryKey[2] === "string" &&
    typeof queryKey[3] === "string" &&
    typeof queryKey[4] === "string"
  )
}

function snapshotEntry(
  queryClient: QueryClient,
  queryKey: QueryKey,
): { queryKey: QueryKey; data: unknown } {
  return {
    queryKey,
    data: queryClient.getQueryData(queryKey),
  }
}

export function restoreCalendarCacheSnapshot(
  queryClient: QueryClient,
  snapshot: CalendarCacheSnapshot,
): void {
  for (const entry of snapshot.entries) {
    queryClient.setQueryData(entry.queryKey, entry.data)
  }
}

/**
 * Patch every warm range/meta/today cache for a scope. When `eventWindow` is
 * provided, only range keys whose [start,end) intersects that window are
 * patched; meta/today always patch when present so task rails stay coherent.
 *
 * Returns a snapshot of every key that was written so callers can roll back.
 * If no merged payload exists for the active keys, still patches any range
 * payload that is present alone (incomplete-cache partial path).
 */
export function patchAllIntersectingCalendarCaches({
  queryClient,
  scope,
  activeKeys,
  eventWindow,
  patch,
  touchToday = true,
  touchMeta = false,
}: {
  queryClient: QueryClient
  scope: CalendarScope
  activeKeys: CalendarCacheKeys
  eventWindow?: EventTimeWindow | null
  patch: (payload: CalendarQueryPayload) => CalendarQueryPayload
  touchToday?: boolean
  touchMeta?: boolean
}): CalendarCacheSnapshot {
  const snapshot: CalendarCacheSnapshot = { entries: [] }
  const window = eventWindow ? eventWindowFromIso(eventWindow) : null

  const meta =
    queryClient.getQueryData<CalendarMetaQueryPayload>(activeKeys.metaKey) ??
    queryClient
      .getQueriesData<CalendarMetaQueryPayload>({
        queryKey: calendarMetaScopePrefix(scope),
      })
      .find(([, data]) => data)?.[1]

  const today =
    queryClient.getQueryData<CalendarTodayQueryPayload>(activeKeys.todayKey) ??
    queryClient
      .getQueriesData<CalendarTodayQueryPayload>({
        queryKey: calendarTodayScopePrefix(scope),
      })
      .find(([, data]) => data)?.[1]

  const rangeEntries = queryClient.getQueriesData<CalendarRangeQueryPayload>({
    queryKey: calendarQueryScopePrefix(scope),
  })

  let patchedAny = false

  for (const [queryKey, range] of rangeEntries) {
    if (!range || !isRangeQueryKey(queryKey, scope)) continue
    const keyStart = queryKey[3]
    const keyEnd = queryKey[4]
    if (
      window &&
      !rangesIntersect({ start: keyStart, end: keyEnd }, window)
    ) {
      continue
    }

    snapshot.entries.push(snapshotEntry(queryClient, queryKey))

    if (meta && today) {
      const merged = mergeCalendarQueryData({ range, meta, today })
      const next = patch(merged)
      queryClient.setQueryData<CalendarRangeQueryPayload>(queryKey, {
        scope: next.scope,
        anchorDate: next.anchorDate,
        view: next.view,
        workspaceId: next.workspaceId,
        events: next.events,
        taskDues: next.taskDues,
      })
      patchedAny = true
    } else {
      // Incomplete cache: apply a range-only projection of the patch.
      const stubMeta: CalendarMetaQueryPayload = meta ?? {
        scope,
        workspaceId: range.workspaceId,
        calendars: [],
        views: [],
      }
      const stubToday: CalendarTodayQueryPayload = today ?? {
        scope,
        todayTasks: [],
      }
      const merged = mergeCalendarQueryData({
        range,
        meta: stubMeta,
        today: stubToday,
      })
      const next = patch(merged)
      queryClient.setQueryData<CalendarRangeQueryPayload>(queryKey, {
        scope: next.scope,
        anchorDate: next.anchorDate,
        view: next.view,
        workspaceId: next.workspaceId,
        events: next.events,
        taskDues: next.taskDues,
      })
      patchedAny = true
    }
  }

  // Always patch active range if nothing else matched (e.g. create with no window).
  if (!patchedAny) {
    const activeRange =
      queryClient.getQueryData<CalendarRangeQueryPayload>(activeKeys.rangeKey)
    if (activeRange) {
      snapshot.entries.push(snapshotEntry(queryClient, activeKeys.rangeKey))
      const stubMeta: CalendarMetaQueryPayload = meta ?? {
        scope,
        workspaceId: activeRange.workspaceId,
        calendars: [],
        views: [],
      }
      const stubToday: CalendarTodayQueryPayload = today ?? {
        scope,
        todayTasks: [],
      }
      const merged = mergeCalendarQueryData({
        range: activeRange,
        meta: stubMeta,
        today: stubToday,
      })
      const next = patch(merged)
      queryClient.setQueryData<CalendarRangeQueryPayload>(activeKeys.rangeKey, {
        scope: next.scope,
        anchorDate: next.anchorDate,
        view: next.view,
        workspaceId: next.workspaceId,
        events: next.events,
        taskDues: next.taskDues,
      })
    }
  }

  if (touchToday && today) {
    snapshot.entries.push(snapshotEntry(queryClient, activeKeys.todayKey))
    const activeRange =
      queryClient.getQueryData<CalendarRangeQueryPayload>(activeKeys.rangeKey)
    if (activeRange && meta) {
      const merged = mergeCalendarQueryData({
        range: activeRange,
        meta,
        today,
      })
      const next = patch(merged)
      queryClient.setQueryData<CalendarTodayQueryPayload>(activeKeys.todayKey, {
        scope: next.scope,
        todayTasks: next.todayTasks,
      })
    } else if (activeRange) {
      const stubMeta: CalendarMetaQueryPayload = {
        scope,
        workspaceId: activeRange.workspaceId,
        calendars: [],
        views: [],
      }
      const merged = mergeCalendarQueryData({
        range: activeRange,
        meta: stubMeta,
        today,
      })
      const next = patch(merged)
      queryClient.setQueryData<CalendarTodayQueryPayload>(activeKeys.todayKey, {
        scope: next.scope,
        todayTasks: next.todayTasks,
      })
    }
  }

  if (touchMeta && meta) {
    snapshot.entries.push(snapshotEntry(queryClient, activeKeys.metaKey))
    const activeRange =
      queryClient.getQueryData<CalendarRangeQueryPayload>(activeKeys.rangeKey)
    if (activeRange && today) {
      const merged = mergeCalendarQueryData({
        range: activeRange,
        meta,
        today,
      })
      const next = patch(merged)
      queryClient.setQueryData<CalendarMetaQueryPayload>(activeKeys.metaKey, {
        scope: next.scope,
        workspaceId: next.workspaceId,
        calendars: next.calendars,
        views: next.views,
      })
    }
  }

  return snapshot
}

/**
 * Invalidate only range queries whose window intersects [start, end).
 * Used after recurrence materialization that cannot be safely client-patched.
 */
export function invalidateIntersectingRanges({
  queryClient,
  scope,
  start,
  end,
}: {
  queryClient: QueryClient
  scope: CalendarScope
  start: string
  end: string
}): void {
  const entries = queryClient.getQueriesData<CalendarRangeQueryPayload>({
    queryKey: calendarQueryScopePrefix(scope),
  })
  for (const [queryKey] of entries) {
    if (!isRangeQueryKey(queryKey, scope)) continue
    if (
      !rangesIntersect(
        { start: queryKey[3], end: queryKey[4] },
        { start, end },
      )
    ) {
      continue
    }
    void queryClient.invalidateQueries({ queryKey })
  }
}
