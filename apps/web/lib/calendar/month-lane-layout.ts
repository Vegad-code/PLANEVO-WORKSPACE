import type { MonthEventItem, MonthItem } from "./month-items.ts"
import { lastOccupiedMoment } from "./month-items.ts"
import { localDateKey, localDayDiff } from "./month-day-index.ts"

export const DAYS_PER_WEEK = 7

/**
 * One week's slice of a multi-day bar. A bar crossing a week boundary produces
 * one segment per week it touches, all sharing the same `lane`.
 */
export type BarSegment = {
  itemId: string
  item: MonthEventItem
  weekIndex: number
  /** Row within the cell's stack. Stable for a bar across every week it spans. */
  lane: number
  /** 0 = Sunday, within this week's row. */
  columnStart: number
  columnSpan: number
  isContinuedFromPrevWeek: boolean
  isContinuedIntoNextWeek: boolean
}

export type MonthLayout = {
  bars: BarSegment[]
  /** Lane rows each week must reserve, so cells in a row stay aligned. */
  laneCountByWeek: number[]
  /** Non-bar items keyed by local date key, in the caller's order. */
  singlesByDay: Map<string, MonthItem[]>
}

/**
 * An event that renders as a spanning bar. Narrowing on the intersection rather
 * than on `MonthEventItem` matters: a plain `item is MonthEventItem` predicate
 * would make TypeScript treat every non-bar as a task, hiding timed events.
 */
export type MonthBarItem = MonthEventItem & { displayStyle: "bar" }

function isBar(item: MonthItem): item is MonthBarItem {
  return item.kind === "event" && item.displayStyle === "bar"
}

/** The last calendar day a bar actually occupies, honouring exclusive ends. */
function lastOccupiedDay(item: MonthBarItem): Date {
  return lastOccupiedMoment(item.start, item.end)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Positions Month items on the grid.
 *
 * `items` must already be in `sortMonthItems` order — that order *is* the
 * placement order and is never recomputed here. Leaving react-big-calendar was
 * largely about this: its month renderer re-partitioned multi-day events ahead
 * of single-day ones before any caller-supplied comparator could run.
 *
 * `days` is the rendered grid (35 or 42 cells, Sunday-first).
 */
export function layoutMonthItems(
  items: MonthItem[],
  days: Date[],
): MonthLayout {
  const bars: BarSegment[] = []
  const laneCountByWeek: number[] = []
  const singlesByDay = new Map<string, MonthItem[]>()

  if (days.length === 0) return { bars, laneCountByWeek, singlesByDay }

  const gridStart = days[0]!
  const lastColumn = days.length - 1
  const weekCount = Math.ceil(days.length / DAYS_PER_WEEK)
  for (let week = 0; week < weekCount; week += 1) laneCountByWeek.push(0)

  const renderedDayKeys = new Set(days.map(localDateKey))

  // Absolute column index of the last day each lane is occupied through.
  const laneEnds: number[] = []

  for (const item of items) {
    if (!isBar(item)) {
      const key = localDateKey(item.kind === "task" ? item.dueAt : item.start)
      if (!renderedDayKeys.has(key)) continue
      const bucket = singlesByDay.get(key)
      if (bucket) bucket.push(item)
      else singlesByDay.set(key, [item])
      continue
    }

    // Unclamped so a bar starting before (or ending after) the grid still
    // reports itself as continuing, rather than looking like it begins here.
    const rawStart = localDayDiff(gridStart, item.start)
    const rawEnd = localDayDiff(gridStart, lastOccupiedDay(item))
    if (rawEnd < 0 || rawStart > lastColumn) continue

    const columnStart = clamp(rawStart, 0, lastColumn)
    const columnEnd = clamp(rawEnd, 0, lastColumn)

    // Greedy interval-graph colouring: first lane free at this column wins.
    // Lanes are assigned across the whole grid, not per week, so a bar keeps
    // the same lane on both sides of a week boundary instead of jumping rows.
    let lane = laneEnds.findIndex((end) => end < columnStart)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(columnEnd)
    } else {
      laneEnds[lane] = columnEnd
    }

    const firstWeek = Math.floor(columnStart / DAYS_PER_WEEK)
    const lastWeek = Math.floor(columnEnd / DAYS_PER_WEEK)

    for (let week = firstWeek; week <= lastWeek; week += 1) {
      const weekFirstColumn = week * DAYS_PER_WEEK
      const weekLastColumn = weekFirstColumn + DAYS_PER_WEEK - 1
      const segmentStart = Math.max(columnStart, weekFirstColumn)
      const segmentEnd = Math.min(columnEnd, weekLastColumn)

      bars.push({
        itemId: item.id,
        item,
        weekIndex: week,
        lane,
        columnStart: segmentStart - weekFirstColumn,
        columnSpan: segmentEnd - segmentStart + 1,
        isContinuedFromPrevWeek: rawStart < weekFirstColumn,
        isContinuedIntoNextWeek: rawEnd > weekLastColumn,
      })

      laneCountByWeek[week] = Math.max(laneCountByWeek[week] ?? 0, lane + 1)
    }
  }

  return { bars, laneCountByWeek, singlesByDay }
}
