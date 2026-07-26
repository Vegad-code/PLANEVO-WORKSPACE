/**
 * Resolve a drop datetime from a pointer position over the calendar grid.
 *
 * The time grid registers no dnd-kit droppables — react-big-calendar owns that
 * DOM — so this is the only path by which a dragged task becomes a time. It
 * reads the slot data attributes RBC emits via slotPropGetter.
 */
export function startsAtFromCalendarPoint(
  clientX: number,
  clientY: number,
): string | null {
  const hit = document.elementFromPoint(clientX, clientY)
  if (!(hit instanceof Element)) return null

  const slot = hit.closest<HTMLElement>("[data-calendar-slot-time]")
  const col = hit.closest<HTMLElement>("[data-calendar-day]")
  if (!slot || !col) return null

  const dateStr = col.dataset.calendarDay
  const timeStr = slot.dataset.calendarSlotTime
  if (!dateStr || !timeStr) return null

  const [hours, minutes] = timeStr.split(":").map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null

  const start = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(start.getTime())) return null
  start.setHours(hours, minutes, 0, 0)
  return start.toISOString()
}
