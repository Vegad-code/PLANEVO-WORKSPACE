/**
 * Google Calendar parity for week/day time-grid interactions.
 *
 * GCal always snaps drag-move, drag-resize, and click-drag create to 15-minute
 * walls (:00 / :15 / :30 / :45). Density / zoom only changes pixel spacing —
 * never the minute step. All-day and month stay day-level (out of scope).
 *
 * React Big Calendar ties visual slot size and interaction snap to the same
 * `step` value; `timeslots` keeps each group one hour so gutter labels stay
 * hourly like GCal. A plain click still opens GCal's usual default 30-minute
 * block (see `TIME_GRID_CLICK_CREATE_MINUTES`) even though the snap step is 15.
 */

export const TIME_GRID_SNAP_MINUTES = 15 as const

/** GCal's usual default timed-event length on a single click (not a drag). */
export const TIME_GRID_CLICK_CREATE_MINUTES = 30 as const

/** RBC `timeslots`: number of `step`-sized slots that make one hour group. */
export const TIME_GRID_SLOTS_PER_HOUR = (60 /
  TIME_GRID_SNAP_MINUTES) as 4

/**
 * Round local minutes up onto a snap boundary. Exact boundaries stay put.
 * Returns null when inputs cannot produce a snap (caller keeps prior state).
 */
export function ceilMinutesToTimeGridSnap({
  minutes,
  snapMinutes = TIME_GRID_SNAP_MINUTES,
}: {
  minutes: number
  snapMinutes?: number
}): number | null {
  if (
    !Number.isFinite(minutes) ||
    !Number.isFinite(snapMinutes) ||
    snapMinutes <= 0
  ) {
    return null
  }
  return Math.ceil(minutes / snapMinutes) * snapMinutes
}

/**
 * Snap a local Date upward onto the time-grid (seconds/ms cleared).
 * Does not mutate the input. Returns null when snap cannot be computed.
 */
export function snapDateUpToTimeGrid({
  date,
  snapMinutes = TIME_GRID_SNAP_MINUTES,
}: {
  date: Date
  snapMinutes?: number
}): Date | null {
  if (Number.isNaN(date.getTime())) return null
  const rounded = ceilMinutesToTimeGridSnap({
    minutes: date.getMinutes(),
    snapMinutes,
  })
  if (rounded === null) return null

  const next = new Date(date)
  next.setSeconds(0, 0)
  if (rounded >= 60) {
    next.setHours(next.getHours() + 1, 0, 0, 0)
    return next
  }
  next.setMinutes(rounded, 0, 0)
  return next
}

/** True when local minutes land on the GCal time-grid snap. */
export function isOnTimeGridSnap({
  date,
  snapMinutes = TIME_GRID_SNAP_MINUTES,
}: {
  date: Date
  snapMinutes?: number
}): boolean {
  if (Number.isNaN(date.getTime())) return false
  if (!Number.isFinite(snapMinutes) || snapMinutes <= 0) return false
  return date.getMinutes() % snapMinutes === 0 && date.getSeconds() === 0
}

export type TimeGridCreateAction = "click" | "select" | "doubleClick"

/**
 * Normalize an RBC slot selection to GCal create behavior:
 * - drag (`select`): keep the snapped range
 * - click / doubleClick: if RBC only selected one snap step, expand to the
 *   default 30-minute block starting at the clicked snap
 *
 * Returns null when the range is unusable (caller ignores the gesture).
 */
export function normalizeTimeGridCreateRange({
  start,
  end,
  action,
  snapMinutes = TIME_GRID_SNAP_MINUTES,
  clickDefaultMinutes = TIME_GRID_CLICK_CREATE_MINUTES,
}: {
  start: Date
  end: Date
  action: TimeGridCreateAction
  snapMinutes?: number
  clickDefaultMinutes?: number
}): { start: Date; end: Date } | null {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  if (
    !Number.isFinite(snapMinutes) ||
    snapMinutes <= 0 ||
    !Number.isFinite(clickDefaultMinutes) ||
    clickDefaultMinutes <= 0
  ) {
    return null
  }

  const startMs = start.getTime()
  const endMs = end.getTime()
  if (endMs <= startMs) return null

  const durationMinutes = (endMs - startMs) / 60_000
  const isClickLike = action === "click" || action === "doubleClick"
  if (isClickLike && Math.abs(durationMinutes - snapMinutes) < 1e-9) {
    return {
      start: new Date(start),
      end: new Date(startMs + clickDefaultMinutes * 60_000),
    }
  }

  return { start: new Date(start), end: new Date(end) }
}
