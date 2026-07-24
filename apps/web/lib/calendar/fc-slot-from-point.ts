/**
 * Resolve a drop datetime from a pointer position over a FullCalendar
 * timeGrid. Used to bridge @dnd-kit task drags onto the FC grid without
 * wiring FC's HTML5 Draggable (which fights dnd-kit sensors).
 */
export function startsAtFromCalendarPoint(
  clientX: number,
  clientY: number,
): string | null {
  const hit = document.elementFromPoint(clientX, clientY)
  if (!(hit instanceof Element)) return null

  const slot = hit.closest<HTMLElement>(".fc-timegrid-slot")
  const col = hit.closest<HTMLElement>(".fc-timegrid-col[data-date]")
  if (!slot || !col) return null

  const dateStr = col.dataset.date
  const timeStr = slot.dataset.time
  if (!dateStr || !timeStr) return null

  // FC data-time is typically "HH:MM:SS"
  const [hours, minutes] = timeStr.split(":").map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null

  const start = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(start.getTime())) return null
  start.setHours(hours, minutes, 0, 0)
  return start.toISOString()
}
