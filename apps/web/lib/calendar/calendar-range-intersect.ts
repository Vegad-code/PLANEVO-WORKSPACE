/**
 * Pure range-intersection helpers for calendar cache patching.
 * Kept free of React Query / path aliases so node:test can import them.
 */

export type IsoDayWindow = {
  start: string
  end: string
}

export type EventTimeWindow = {
  startsAt: string
  endsAt: string
}

/**
 * Range keys are [calendar, scope, view, startDate, endDate]. Two windows
 * intersect when each starts before the other ends.
 */
export function rangesIntersect(
  left: IsoDayWindow,
  right: IsoDayWindow,
): boolean {
  return left.start < right.end && right.start < left.end
}

export function eventWindowFromIso({
  startsAt,
  endsAt,
}: EventTimeWindow): IsoDayWindow {
  const start = startsAt.slice(0, 10)
  const endDay = endsAt.slice(0, 10)
  const endInstant = new Date(endsAt)
  const endsAtMidnight =
    endInstant.getUTCHours() === 0 &&
    endInstant.getUTCMinutes() === 0 &&
    endInstant.getUTCSeconds() === 0 &&
    endInstant.getUTCMilliseconds() === 0

  if (endsAtMidnight && endsAt.endsWith("T00:00:00.000Z")) {
    return { start, end: endDay }
  }

  const next = new Date(`${endDay}T00:00:00`)
  next.setDate(next.getDate() + 1)
  const year = next.getFullYear()
  const month = String(next.getMonth() + 1).padStart(2, "0")
  const day = String(next.getDate()).padStart(2, "0")
  return { start, end: `${year}-${month}-${day}` }
}
