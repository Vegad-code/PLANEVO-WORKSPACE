import type { MonthDragData, MonthDropData } from "./month-drag.ts"

type Point = { clientX: number; clientY: number }
type Rect = { left: number; right: number; top: number; bottom: number }

/** Only moving a task-linked event off Month's valid day targets unschedules it. */
export function monthOffGridTaskEventId(
  drag: MonthDragData,
  drop: MonthDropData | undefined,
): string | null {
  if (drag.type !== "month-move" || drop?.type === "month-day") return null
  if (drag.item.kind !== "event" || !drag.item.linkedTask) return null
  return drag.item.eventId
}

/** RBC owns week/day dragging, so its release point is checked against the grid. */
export function isPointOutsideRect(point: Point, rect: Rect): boolean {
  return (
    point.clientX < rect.left ||
    point.clientX > rect.right ||
    point.clientY < rect.top ||
    point.clientY > rect.bottom
  )
}
