/**
 * Places calendar loading placeholders from real events — never invents
 * positions. Empty input → empty plan (chrome-only skeleton).
 *
 * Craft fields (title, color, times) pass through so the UI can render the
 * user's event chrome as faint ghosts, not generic gray bars.
 */
import type {
  CalendarColorValue,
  CalendarDisplayEvent,
} from "@planevo/core/types/calendar"
import { DEFAULT_CALENDAR_COLOR } from "./calendar-color.ts"
import { calendarEventDisplayRange } from "./calendar-event-display-range.ts"
import { eventBlockPosition } from "./event-block-position.ts"
import {
  allDaySpanForEvent,
  assignAllDayRows,
  timedSegmentsForEvent,
  timeGridColumns,
} from "./calendar-time-grid-segments.ts"
import { layoutIntervals } from "./interval-layout.ts"
import { monthGridDays } from "./month-grid-days.ts"
import {
  getMonthEventDisplayStyle,
  type MonthEventItem,
  type MonthItem,
} from "./month-items.ts"
import {
  layoutMonthItems,
  type BarSegment,
  DAYS_PER_WEEK,
} from "./month-lane-layout.ts"
import { localDateKey, localDayDiff } from "./month-day-index.ts"

export const CALENDAR_SKELETON_WEEK_COLUMNS = 7
export const CALENDAR_SKELETON_MONTH_CELLS = 42
export const CALENDAR_SKELETON_MAX_MONTH_STACK = 3
/** Height needed to also show a time range ghost under the title. */
export const CALENDAR_SKELETON_TIME_LABEL_MIN_HEIGHT_PERCENT = 4

export type CalendarSkeletonView = "day" | "week" | "month"

export type CalendarSkeletonTimedItem = {
  kind: "timed"
  key: string
  column: number
  topPercent: number
  heightPercent: number
  left: number
  width: number
  title: string
  color: CalendarColorValue
  startsAt: Date
  endsAt: Date
}

export type CalendarSkeletonAllDayItem = {
  kind: "allDay"
  key: string
  columnStart: number
  columnSpan: number
  row: number
  title: string
  color: CalendarColorValue
}

export type CalendarSkeletonMonthBarItem = {
  kind: "monthBar"
  key: string
  weekIndex: number
  columnStart: number
  columnSpan: number
  lane: number
  title: string
  color: CalendarColorValue
}

export type CalendarSkeletonMonthSingleItem = {
  kind: "monthSingle"
  key: string
  cellIndex: number
  stackIndex: number
  title: string
  color: CalendarColorValue
  startsAt: Date
  allDay: boolean
}

export type CalendarSkeletonLayout = {
  timed: CalendarSkeletonTimedItem[]
  allDay: CalendarSkeletonAllDayItem[]
  monthBars: CalendarSkeletonMonthBarItem[]
  monthSingles: CalendarSkeletonMonthSingleItem[]
  monthRowCount: number
  laneCountByWeek: number[]
}

export type CalendarSkeletonEventInput = {
  id: string
  starts_at: string
  ends_at: string
  all_day: boolean
  source?: CalendarDisplayEvent["source"]
  title?: string
  color?: CalendarColorValue
}

type SkeletonEvent = CalendarSkeletonEventInput

function emptyLayout(): CalendarSkeletonLayout {
  return {
    timed: [],
    allDay: [],
    monthBars: [],
    monthSingles: [],
    monthRowCount: 0,
    laneCountByWeek: [],
  }
}

function craftOf(event: SkeletonEvent): {
  title: string
  color: CalendarColorValue
} {
  return {
    title: (event.title ?? "").trim(),
    color: event.color ?? DEFAULT_CALENDAR_COLOR,
  }
}

function skeletonToMonthItem(event: SkeletonEvent): MonthEventItem | null {
  const range = calendarEventDisplayRange({
    ...event,
    source: event.source ?? "planevo",
  })
  if (!range) return null
  const { title, color } = craftOf(event)
  return {
    kind: "event",
    displayStyle: getMonthEventDisplayStyle(event),
    id: `event:${event.id}`,
    title,
    start: range.start,
    end: range.end,
    eventId: event.id,
    calendarId: "",
    calendarColor: color,
    source: event.source ?? "planevo",
    isSyncedSource: event.source !== "planevo",
    allDay: event.all_day,
    linkedTask: null,
    isTaskComplete: false,
    event: event as CalendarDisplayEvent,
  }
}

function monthBarToSkeletonItem(segment: BarSegment): CalendarSkeletonMonthBarItem {
  return {
    kind: "monthBar",
    key: `${segment.itemId}:w${segment.weekIndex}:lane${segment.lane}`,
    weekIndex: segment.weekIndex,
    columnStart: segment.columnStart,
    columnSpan: segment.columnSpan,
    lane: segment.lane,
    title: segment.item.title,
    color: segment.item.calendarColor,
  }
}

function planMonthSkeletonLayout(
  anchor: Date,
  events: readonly SkeletonEvent[],
): CalendarSkeletonLayout {
  const days = monthGridDays(anchor)
  if (days.length === 0) return emptyLayout()

  const gridStart = days[0]!
  const items: MonthItem[] = []
  for (const event of events) {
    const item = skeletonToMonthItem(event)
    if (item) items.push(item)
  }

  const monthLayout = layoutMonthItems(items, days)

  const monthSingles: CalendarSkeletonMonthSingleItem[] = []
  for (const [dateKey, singles] of monthLayout.singlesByDay) {
    const day = days.find((candidate) => localDateKey(candidate) === dateKey)
    if (!day) continue
    const cellIndex = localDayDiff(gridStart, day)
    if (cellIndex < 0 || cellIndex >= days.length) continue
    singles.forEach((item, index) => {
      if (index >= CALENDAR_SKELETON_MAX_MONTH_STACK) return
      // Skeleton loads events only — task due chips are not event ghosts.
      if (item.kind !== "event") return
      monthSingles.push({
        kind: "monthSingle",
        key: `${item.id}:${cellIndex}:${index}`,
        cellIndex,
        stackIndex: index,
        title: item.title,
        color: item.calendarColor,
        startsAt: item.start,
        allDay: item.allDay,
      })
    })
  }

  const monthBars = monthLayout.bars.map(monthBarToSkeletonItem)

  return {
    timed: [],
    allDay: [],
    monthBars,
    monthSingles,
    monthRowCount: days.length / DAYS_PER_WEEK,
    laneCountByWeek: monthLayout.laneCountByWeek,
  }
}

type TimedColumnSegment = {
  eventId: string
  title: string
  color: CalendarColorValue
  segmentStart: Date
  segmentEnd: Date
}

function planTimeGridSkeletonLayout({
  view,
  anchor,
  events,
}: {
  view: "day" | "week"
  anchor: Date
  events: readonly SkeletonEvent[]
}): CalendarSkeletonLayout {
  const columns = timeGridColumns({ view, anchor })
  const allDaySpans: Array<
    ReturnType<typeof allDaySpanForEvent> & {
      title: string
      color: CalendarColorValue
    }
  > = []
  const timedByColumn = new Map<number, TimedColumnSegment[]>()
  const craftByEventId = new Map<string, { title: string; color: CalendarColorValue }>()

  for (const event of events) {
    const range = calendarEventDisplayRange({
    ...event,
    source: event.source ?? "planevo",
  })
    if (!range) continue
    const craft = craftOf(event)
    craftByEventId.set(event.id, craft)

    if (event.all_day) {
      const span = allDaySpanForEvent({
        eventId: event.id,
        start: range.start,
        end: range.end,
        columns,
      })
      if (span) allDaySpans.push({ ...span, ...craft })
      continue
    }

    const segments = timedSegmentsForEvent({
      eventId: event.id,
      start: range.start,
      end: range.end,
      columns,
    })
    for (const segment of segments) {
      const bucket = timedByColumn.get(segment.column) ?? []
      bucket.push({
        eventId: segment.eventId,
        title: craft.title,
        color: craft.color,
        segmentStart: segment.segmentStart,
        segmentEnd: segment.segmentEnd,
      })
      timedByColumn.set(segment.column, bucket)
    }
  }

  const timed: CalendarSkeletonTimedItem[] = []
  for (const [column, segments] of timedByColumn) {
    const layout = layoutIntervals({
      intervals: segments.map((segment) => ({
        id: `${segment.eventId}:${segment.segmentStart.getTime()}`,
        start: segment.segmentStart,
        end: segment.segmentEnd,
      })),
    })
    for (const item of layout) {
      const source = segments.find(
        (segment) =>
          `${segment.eventId}:${segment.segmentStart.getTime()}` ===
          item.interval.id,
      )
      const craft = source
        ? { title: source.title, color: source.color }
        : { title: "", color: DEFAULT_CALENDAR_COLOR }
      const { topPercent, heightPercent } = eventBlockPosition(
        item.interval.start,
        item.interval.end,
      )
      timed.push({
        kind: "timed",
        key: `${item.interval.id}:col${column}`,
        column,
        topPercent,
        heightPercent,
        left: item.left,
        width: item.width,
        title: craft.title,
        color: craft.color,
        startsAt: item.interval.start,
        endsAt: item.interval.end,
      })
    }
  }

  const allDay = assignAllDayRows(allDaySpans).map((placement) => {
    const craft = craftByEventId.get(placement.eventId) ?? {
      title: "",
      color: DEFAULT_CALENDAR_COLOR,
    }
    return {
      kind: "allDay" as const,
      key: `${placement.eventId}:all-day:${placement.row}`,
      columnStart: placement.columnStart,
      columnSpan: placement.columnEnd - placement.columnStart + 1,
      row: placement.row,
      title: craft.title,
      color: craft.color,
    }
  })

  return {
    timed,
    allDay,
    monthBars: [],
    monthSingles: [],
    monthRowCount: 0,
    laneCountByWeek: [],
  }
}

/**
 * Build skeleton placements for the visible grid from known events.
 * Unknown / empty event lists produce no event placeholders.
 */
export function planCalendarGridSkeletonLayout({
  view,
  anchor,
  events,
}: {
  view: CalendarSkeletonView
  anchor: Date
  events: readonly SkeletonEvent[]
}): CalendarSkeletonLayout {
  if (events.length === 0) return emptyLayout()
  if (view === "month") return planMonthSkeletonLayout(anchor, events)
  return planTimeGridSkeletonLayout({ view, anchor, events })
}

/** Week-view column count for day vs week skeletons. */
export function calendarSkeletonColumnCount(
  view: CalendarSkeletonView,
): number {
  return view === "day" ? 1 : CALENDAR_SKELETON_WEEK_COLUMNS
}
