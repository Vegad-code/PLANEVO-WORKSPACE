/** Full-day window like Google Calendar: 12 AM through 11 PM (24 hours). */
export const DAY_START_HOUR = 0
export const DAY_END_HOUR = 24
export const VISIBLE_HOURS = DAY_END_HOUR - DAY_START_HOUR

/** Fallback scroll target (hour) when today isn't in the visible range. */
export const DEFAULT_SCROLL_HOUR = 8

/** Minimum readable timed block height as % of the full-day grid (~30 minutes). */
export const MIN_EVENT_BLOCK_HEIGHT_PERCENT = (0.5 / VISIBLE_HOURS) * 100

/** Hours from the start of the day window, clamped to [0, VISIBLE_HOURS]. */
export function hoursIntoDayWindow(date: Date): number {
  const hoursIntoWindow =
    date.getHours() + date.getMinutes() / 60 - DAY_START_HOUR
  return Math.min(Math.max(hoursIntoWindow, 0), VISIBLE_HOURS)
}

/** Percent offset from the top of the grid for a moment within the day. */
export function percentOffsetForTime(date: Date): number {
  return (hoursIntoDayWindow(date) / VISIBLE_HOURS) * 100
}

export type EventBlockPosition = {
  topPercent: number
  heightPercent: number
}

/** Absolute block geometry for an event, as % of the full-day grid. */
export function eventBlockPosition(
  startsAt: string | Date,
  endsAt: string | Date,
): EventBlockPosition {
  const start = startsAt instanceof Date ? startsAt : new Date(startsAt)
  const end = endsAt instanceof Date ? endsAt : new Date(endsAt)
  const topPercent = percentOffsetForTime(start)
  const bottomPercent = percentOffsetForTime(end)
  const minHeightPercent = MIN_EVENT_BLOCK_HEIGHT_PERCENT
  const heightPercent = Math.max(bottomPercent - topPercent, minHeightPercent)
  return { topPercent, heightPercent }
}
