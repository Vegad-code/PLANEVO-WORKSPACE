/**
 * Splits calendar events into day/week grid columns using the same local-day
 * rules as react-big-calendar and the month grid.
 */
import { startOfWeekSunday } from "./calendar-range.ts"
import { lastOccupiedMoment } from "./month-items.ts"
import {
  addLocalDays,
  localDayDiff,
  startOfLocalDay,
} from "./month-day-index.ts"

export const TIME_GRID_WEEK_COLUMNS = 7

export type TimeGridColumn = {
  index: number
  dayStart: Date
}

export function timeGridColumns({
  view,
  anchor,
}: {
  view: "day" | "week"
  anchor: Date
}): TimeGridColumn[] {
  if (view === "day") {
    return [{ index: 0, dayStart: startOfLocalDay(anchor) }]
  }
  const weekStart = startOfWeekSunday(anchor)
  return Array.from({ length: TIME_GRID_WEEK_COLUMNS }, (_, index) => ({
    index,
    dayStart: addLocalDays(weekStart, index),
  }))
}

export type TimedDaySegment = {
  eventId: string
  column: number
  segmentStart: Date
  segmentEnd: Date
}

/** One timed event may occupy multiple day columns when it crosses midnight. */
export function timedSegmentsForEvent({
  eventId,
  start,
  end,
  columns,
}: {
  eventId: string
  start: Date
  end: Date
  columns: readonly TimeGridColumn[]
}): TimedDaySegment[] {
  if (end.getTime() <= start.getTime() || columns.length === 0) return []

  const segments: TimedDaySegment[] = []
  for (const { index, dayStart } of columns) {
    const dayEnd = addLocalDays(dayStart, 1)
    const segmentStart =
      start.getTime() > dayStart.getTime() ? start : dayStart
    const segmentEnd = end.getTime() < dayEnd.getTime() ? end : dayEnd
    if (segmentEnd.getTime() <= segmentStart.getTime()) continue
    segments.push({
      eventId,
      column: index,
      segmentStart,
      segmentEnd,
    })
  }
  return segments
}

export type AllDayColumnSpan = {
  eventId: string
  columnStart: number
  columnEnd: number
}

export function allDaySpanForEvent({
  eventId,
  start,
  end,
  columns,
}: {
  eventId: string
  start: Date
  end: Date
  columns: readonly TimeGridColumn[]
}): AllDayColumnSpan | null {
  if (columns.length === 0) return null

  const gridStart = columns[0]!.dayStart
  const lastColumn = columns.length - 1
  const lastDay = lastOccupiedMoment(start, end)
  const rawStart = localDayDiff(gridStart, startOfLocalDay(start))
  const rawEnd = localDayDiff(gridStart, startOfLocalDay(lastDay))
  if (rawEnd < 0 || rawStart > lastColumn) return null

  return {
    eventId,
    columnStart: Math.max(0, rawStart),
    columnEnd: Math.min(lastColumn, rawEnd),
  }
}

export type AllDayRowPlacement = AllDayColumnSpan & { row: number }

/** Greedy lane assignment for the all-day band — mirrors month bar lanes. */
export function assignAllDayRows(
  spans: readonly AllDayColumnSpan[],
): AllDayRowPlacement[] {
  const laneEnds: number[] = []
  const sorted = [...spans].sort((left, right) => {
    const startDelta = left.columnStart - right.columnStart
    if (startDelta !== 0) return startDelta
    const spanDelta =
      right.columnEnd -
      right.columnStart -
      (left.columnEnd - left.columnStart)
    if (spanDelta !== 0) return spanDelta
    return left.eventId.localeCompare(right.eventId)
  })

  return sorted.map((span) => {
    let row = laneEnds.findIndex((laneEnd) => laneEnd < span.columnStart)
    if (row === -1) {
      row = laneEnds.length
      laneEnds.push(span.columnEnd)
    } else {
      laneEnds[row] = span.columnEnd
    }
    return { ...span, row }
  })
}
