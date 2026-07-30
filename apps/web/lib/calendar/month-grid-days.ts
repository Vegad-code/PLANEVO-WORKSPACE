import { calendarDays } from "@planevo/core/state/calendar-state"
import { DAYS_PER_WEEK } from "./month-lane-layout.ts"

const WEEKS_IN_FETCH_WINDOW = 6

/**
 * Rendered month grid days — trims an empty sixth week so skeleton and month
 * view share the same row count.
 */
export function monthGridDays(anchor: Date): Date[] {
  const window = calendarDays(anchor)
  const anchorMonth = anchor.getMonth()
  const lastWeek = window.slice((WEEKS_IN_FETCH_WINDOW - 1) * DAYS_PER_WEEK)
  const isLastWeekEmpty = lastWeek.every(
    (day) => day.getMonth() !== anchorMonth,
  )
  return isLastWeekEmpty
    ? window.slice(0, (WEEKS_IN_FETCH_WINDOW - 1) * DAYS_PER_WEEK)
    : window
}
