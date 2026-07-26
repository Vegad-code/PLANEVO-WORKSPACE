/**
 * Shared local-day arithmetic for the Month grid.
 *
 * Every Month calculation works in whole local calendar days, so all of it goes
 * through these helpers rather than epoch-millisecond math. Adding days with
 * `setDate` keeps the wall-clock time intact across a daylight-saving boundary,
 * where `getTime() + n * 86_400_000` would silently shift an event by an hour.
 */

const MS_PER_DAY = 86_400_000

export function startOfLocalDay(date: Date): Date {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}

export function addLocalDays(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

/**
 * Whole calendar days from `from` to `to`. Rounding absorbs the 23- and 25-hour
 * days that daylight saving produces, so a one-day gap always measures as 1.
 */
export function localDayDiff(from: Date, to: Date): number {
  const fromStart = startOfLocalDay(from).getTime()
  const toStart = startOfLocalDay(to).getTime()
  return Math.round((toStart - fromStart) / MS_PER_DAY)
}

/** Local-timezone `YYYY-MM-DD` key, matching `dateKey` in calendar-state. */
export function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/** Parses a `YYYY-MM-DD` key back into local midnight of that day. */
export function parseLocalDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number)
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
}
