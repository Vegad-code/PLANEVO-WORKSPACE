/**
 * Last-painted calendar events for content-aware loading skeletons.
 * Multi-range session store — never invents positions; empty / miss → chrome-only.
 * Survives hard refresh within the tab; never treated as source of truth.
 *
 * Stores geometry + craft fields (title, color, source) so the skeleton can
 * render the user's real event chrome as faint ghosts.
 */
import type {
  CalendarColorValue,
  CalendarDisplayEvent,
} from "@planevo/core/types/calendar"
import {
  DEFAULT_CALENDAR_COLOR,
  normalizeCalendarColor,
} from "./calendar-color.ts"
import type { CalendarSkeletonView } from "./calendar-grid-skeleton-layout.ts"
import { calendarRange, dateParam } from "./calendar-range.ts"

const STORAGE_KEY = "planevo.calendar.skeleton-events.v2"
const MAX_RANGE_ENTRIES = 12
const MAX_EVENTS_PER_RANGE = 80

export type CalendarSkeletonEventGeometry = {
  id: string
  starts_at: string
  ends_at: string
  all_day: boolean
  source?: CalendarDisplayEvent["source"]
  title?: string
  color?: CalendarColorValue
}

export type CalendarSkeletonRangeEntry = {
  view: CalendarSkeletonView
  rangeStart: string
  rangeEnd: string
  events: CalendarSkeletonEventGeometry[]
  savedAt: number
}

type CalendarSkeletonEventStore = {
  version: 2
  entries: CalendarSkeletonRangeEntry[]
}

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined"
}

export function skeletonRangeKey({
  view,
  anchor,
}: {
  view: CalendarSkeletonView
  anchor: Date
}): { rangeStart: string; rangeEnd: string } {
  const { start, end } = calendarRange(view, anchor)
  return { rangeStart: dateParam(start), rangeEnd: dateParam(end) }
}

function isCalendarColorValue(value: unknown): value is CalendarColorValue {
  return typeof value === "string" && normalizeCalendarColor(value) !== null
}

export function sanitizeCalendarSkeletonEvents(
  events: ReadonlyArray<{
    id?: unknown
    starts_at?: unknown
    ends_at?: unknown
    all_day?: unknown
    source?: unknown
    title?: unknown
    color?: unknown
  }>,
): CalendarSkeletonEventGeometry[] {
  const out: CalendarSkeletonEventGeometry[] = []
  for (const event of events) {
    if (
      typeof event?.id !== "string" ||
      typeof event?.starts_at !== "string" ||
      typeof event?.ends_at !== "string" ||
      typeof event?.all_day !== "boolean"
    ) {
      continue
    }
    if (
      Number.isNaN(new Date(event.starts_at).getTime()) ||
      Number.isNaN(new Date(event.ends_at).getTime())
    ) {
      continue
    }
    const geometry: CalendarSkeletonEventGeometry = {
      id: event.id,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      all_day: event.all_day,
    }
    if (
      event.source === "planevo" ||
      event.source === "google" ||
      event.source === "ics"
    ) {
      geometry.source = event.source
    }
    if (typeof event.title === "string") {
      geometry.title = event.title
    }
    if (isCalendarColorValue(event.color)) {
      geometry.color = normalizeCalendarColor(event.color) ?? undefined
    }
    out.push(geometry)
    if (out.length >= MAX_EVENTS_PER_RANGE) break
  }
  return out
}

/**
 * Prefer live range events when present; otherwise the remembered snapshot for
 * this exact visible range. Never invents geometry.
 */
export function resolveCalendarSkeletonEvents({
  view,
  anchor,
  liveEvents,
}: {
  view: CalendarSkeletonView
  anchor: Date
  liveEvents?: ReadonlyArray<CalendarSkeletonEventGeometry> | null
}): CalendarSkeletonEventGeometry[] {
  const live = sanitizeCalendarSkeletonEvents(liveEvents ?? [])
  if (live.length > 0) return live
  return readCalendarSkeletonEvents({ view, anchor })
}

function readStore(): CalendarSkeletonEventStore {
  if (!canUseSessionStorage()) return { version: 2, entries: [] }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { version: 2, entries: [] }
    const parsed = JSON.parse(raw) as Partial<CalendarSkeletonEventStore>
    if (parsed.version !== 2 || !Array.isArray(parsed.entries)) {
      return { version: 2, entries: [] }
    }
    return { version: 2, entries: parsed.entries }
  } catch {
    return { version: 2, entries: [] }
  }
}

function writeStore(store: CalendarSkeletonEventStore): void {
  if (!canUseSessionStorage()) return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Quota / private mode — skeleton falls back to chrome-only.
  }
}

export function rememberCalendarSkeletonEvents({
  view,
  anchor,
  events,
}: {
  view: CalendarSkeletonView
  anchor: Date
  events: ReadonlyArray<CalendarSkeletonEventGeometry>
}): void {
  if (!canUseSessionStorage()) return
  const { rangeStart, rangeEnd } = skeletonRangeKey({ view, anchor })
  const nextEntry: CalendarSkeletonRangeEntry = {
    view,
    rangeStart,
    rangeEnd,
    events: sanitizeCalendarSkeletonEvents(events),
    savedAt: Date.now(),
  }
  const store = readStore()
  const remaining = store.entries.filter(
    (entry) =>
      !(
        entry.view === view &&
        entry.rangeStart === rangeStart &&
        entry.rangeEnd === rangeEnd
      ),
  )
  writeStore({
    version: 2,
    entries: [nextEntry, ...remaining].slice(0, MAX_RANGE_ENTRIES),
  })
}

export function readCalendarSkeletonEvents({
  view,
  anchor,
}: {
  view: CalendarSkeletonView
  anchor?: Date
}): CalendarSkeletonEventGeometry[] {
  if (!anchor) return []
  const { rangeStart, rangeEnd } = skeletonRangeKey({ view, anchor })
  const store = readStore()
  const entry = store.entries.find(
    (candidate) =>
      candidate.view === view &&
      candidate.rangeStart === rangeStart &&
      candidate.rangeEnd === rangeEnd,
  )
  if (!entry || !Array.isArray(entry.events)) return []
  return sanitizeCalendarSkeletonEvents(entry.events)
}

/**
 * Map live display events + calendars into skeleton geometry (true times + craft).
 */
export function skeletonEventsFromDisplay({
  events,
  calendars,
}: {
  events: ReadonlyArray<
    Pick<
      CalendarDisplayEvent,
      | "id"
      | "starts_at"
      | "ends_at"
      | "all_day"
      | "source"
      | "title"
      | "color"
      | "calendar_id"
    > & {
      linked_task?: CalendarDisplayEvent["linked_task"]
    }
  >
  calendars: ReadonlyArray<{ id: string; color: CalendarColorValue }>
}): CalendarSkeletonEventGeometry[] {
  const colorByCalendar = new Map(
    calendars.map((calendar) => [calendar.id, calendar.color]),
  )
  return sanitizeCalendarSkeletonEvents(
    events.map((event) => ({
      id: event.id,
      starts_at: event.starts_at,
      ends_at: event.ends_at,
      all_day: event.all_day,
      source: event.source,
      title: (event.linked_task?.title ?? event.title).trim(),
      color: event.color ?? colorByCalendar.get(event.calendar_id) ?? DEFAULT_CALENDAR_COLOR,
    })),
  )
}
