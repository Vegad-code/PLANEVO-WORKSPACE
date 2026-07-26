import { addLocalDays, localDateKey } from "./month-day-index.ts"

const WEEKS_PER_PAGE = 4
const DAYS_PER_PAGE = WEEKS_PER_PAGE * 7

/**
 * Page up/down moves four weeks so the focused weekday column is preserved
 * while landing in the adjacent calendar month.
 */
export function focusDateAfterPageKey(
  active: Date,
  direction: "PageUp" | "PageDown",
): Date {
  const offset = direction === "PageDown" ? DAYS_PER_PAGE : -DAYS_PER_PAGE
  return addLocalDays(active, offset)
}

/** Picks the visible day key closest to `target`, preferring the same weekday. */
export function focusDateKeyInGrid(target: Date, days: Date[]): string {
  const targetKey = localDateKey(target)
  if (days.some((day) => localDateKey(day) === targetKey)) return targetKey

  const weekday = target.getDay()
  const candidates = days.filter((day) => day.getDay() === weekday)
  if (candidates.length === 0) return localDateKey(days[0]!)

  const targetTime = target.getTime()
  let closest = candidates[0]!
  let closestDistance = Math.abs(closest.getTime() - targetTime)

  for (const candidate of candidates.slice(1)) {
    const distance = Math.abs(candidate.getTime() - targetTime)
    if (distance < closestDistance) {
      closest = candidate
      closestDistance = distance
    }
  }

  return localDateKey(closest)
}
