import type { MonthEventItem, MonthItem } from "./month-items.ts"
import { lastOccupiedMoment } from "./month-items.ts"
import { addLocalDays, localDayDiff, parseLocalDateKey } from "./month-day-index.ts"

export type MonthMoveResult =
  | {
      kind: "event"
      operation: "move" | "resize"
      eventId: string
      event: MonthEventItem["event"]
      startsAt: string
      endsAt: string
    }
  | { kind: "task"; taskId: string; dueAt: string }

/** What a dragged month chip, bar, or resize handle carries. */
export type MonthDragData =
  | { type: "month-move"; item: MonthItem; originDateKey: string }
  | { type: "month-resize"; item: MonthEventItem; edge: "start" | "end" }

/** What a month day cell offers as a drop target. */
export type MonthDropData = { type: "month-day"; dateKey: string }

/**
 * Resolves a completed month drag into the change it implies.
 *
 * Kept here rather than in the drop handler so the whole gesture — move versus
 * resize, which edge, which day — is decided by one tested pure function.
 */
export function resolveMonthDrag(
  drag: MonthDragData,
  drop: MonthDropData,
): MonthMoveResult | null {
  return drag.type === "month-move"
    ? moveItemToDay(drag.item, drag.originDateKey, drop.dateKey)
    : resizeBarEdge(drag.item, drag.edge, drop.dateKey)
}

/**
 * Moves an item to a different day, keeping its time of day.
 *
 * The shift is measured from `originDateKey` — the cell the drag started in —
 * rather than the item's own start, so grabbing a multi-day bar in the middle
 * moves it by the distance dragged instead of snapping its start to the drop
 * target. The shift is applied in whole calendar days via `addLocalDays`, so an
 * event at 9am stays at 9am even across a daylight-saving boundary. Returns
 * null when the drop lands back on the day it started from.
 */
export function moveItemToDay(
  item: MonthItem,
  originDateKey: string,
  targetDateKey: string,
): MonthMoveResult | null {
  const deltaDays = localDayDiff(
    parseLocalDateKey(originDateKey),
    parseLocalDateKey(targetDateKey),
  )
  if (deltaDays === 0) return null

  if (item.kind === "task") {
    return {
      kind: "task",
      taskId: item.taskId,
      dueAt: addLocalDays(item.dueAt, deltaDays).toISOString(),
    }
  }
  if (item.source !== "planevo") return null

  return {
    kind: "event",
    operation: "move",
    eventId: item.eventId,
    event: item.event,
    startsAt: addLocalDays(item.start, deltaDays).toISOString(),
    endsAt: addLocalDays(item.end, deltaDays).toISOString(),
  }
}

/**
 * Drags one edge of a multi-day bar to a new day.
 *
 * Both edges shift by whole days, which preserves the event's times of day and
 * the exclusive-end convention documented on `lastOccupiedMoment`: an all-day
 * bar ending at midnight keeps ending at midnight, one day past its last day.
 * The moved edge is clamped so it can never cross the opposite edge, collapsing
 * at worst to a single-day bar. Returns null when nothing changes.
 */
export function resizeBarEdge(
  item: MonthEventItem,
  edge: "start" | "end",
  targetDateKey: string,
): MonthMoveResult | null {
  if (item.source !== "planevo") return null
  const target = parseLocalDateKey(targetDateKey)
  const lastDay = lastOccupiedMoment(item.start, item.end)

  if (edge === "start") {
    const rawDelta = localDayDiff(item.start, target)
    const maxDelta = localDayDiff(item.start, lastDay)
    const deltaDays = Math.min(rawDelta, maxDelta)
    if (deltaDays === 0) return null
    return {
      kind: "event",
      operation: "resize",
      eventId: item.eventId,
      event: item.event,
      startsAt: addLocalDays(item.start, deltaDays).toISOString(),
      endsAt: item.end.toISOString(),
    }
  }

  const rawDelta = localDayDiff(lastDay, target)
  const minDelta = localDayDiff(lastDay, item.start)
  const deltaDays = Math.max(rawDelta, minDelta)
  if (deltaDays === 0) return null
  return {
    kind: "event",
    operation: "resize",
    eventId: item.eventId,
    event: item.event,
    startsAt: item.start.toISOString(),
    endsAt: addLocalDays(item.end, deltaDays).toISOString(),
  }
}
