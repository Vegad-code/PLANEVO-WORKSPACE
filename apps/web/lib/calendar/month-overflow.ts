import type { MonthItem } from "./month-items.ts"

/** Rows assumed per cell before the grid has been measured (SSR, first paint). */
export const DEFAULT_MONTH_CAPACITY = 3

/** Upper bound on items rendered per cell, so a pathological day can't bloat the DOM. */
export const MAX_MONTH_ITEMS_PER_DAY = 12

export type WeekLanePlan = {
  /** Bar lanes every cell in the week reserves, so bars never clip mid-span. */
  visibleLaneCount: number
}

export type DayOverflow = {
  visibleSingles: MonthItem[]
  overflowCount: number
  hasOverflow: boolean
}

/**
 * Decides how many bar lanes a week's cells reserve.
 *
 * Lane geometry is resolved once per week rather than per day: a bar spanning
 * Monday to Friday must appear on all five cells or none, and deciding per cell
 * would let a busy Wednesday punch a hole through the middle of it. Every cell
 * reserves the same lane rows even where a lane is empty, which is what keeps
 * the bars in a row sitting on one baseline.
 *
 * A lane is given up week-wide only when some day genuinely cannot fit its
 * items otherwise — that day will need a row for its "+N more" trigger.
 */
export function planWeekLanes({
  laneCountForWeek,
  dayItemCounts,
  capacity,
}: {
  laneCountForWeek: number
  /** Bars plus single-day items per cell in this week. */
  dayItemCounts: number[]
  capacity: number
}): WeekLanePlan {
  const lanes = Math.max(laneCountForWeek, 0)
  const someDayOverflows = dayItemCounts.some((count) => count > capacity)
  const laneRoom = Math.max(someDayOverflows ? capacity - 1 : capacity, 0)

  return { visibleLaneCount: Math.min(lanes, laneRoom) }
}

/**
 * Splits one day's single-item stack into what fits and what falls behind "+N".
 *
 * The budget is per day: a quiet cell shows its one event even when the day
 * beside it is overflowing, because only a cell with something hidden spends a
 * row on the trigger.
 *
 * `hiddenBarCount` is the bars covering *this* day whose lane the week could
 * not fit. They are always counted. react-big-calendar's month renderer dropped
 * overflowing multi-day bars without counting them (upstream #2658, closed
 * wontfix), and preventing that is why bars are tallied here at all.
 */
export function computeDayOverflow({
  visibleLaneCount,
  hiddenBarCount,
  singlesForDay,
  capacity,
}: {
  visibleLaneCount: number
  hiddenBarCount: number
  singlesForDay: MonthItem[]
  capacity: number
}): DayOverflow {
  const roomForSingles = Math.max(capacity - visibleLaneCount, 0)
  const fitsWithoutTrigger =
    hiddenBarCount === 0 && singlesForDay.length <= roomForSingles

  if (fitsWithoutTrigger) {
    return {
      visibleSingles: singlesForDay,
      overflowCount: 0,
      hasOverflow: false,
    }
  }

  // One row goes to the "+N more" trigger itself.
  const budget = Math.max(roomForSingles - 1, 0)
  const visibleSingles = singlesForDay.slice(0, budget)

  return {
    visibleSingles,
    overflowCount:
      hiddenBarCount + (singlesForDay.length - visibleSingles.length),
    hasOverflow: true,
  }
}
