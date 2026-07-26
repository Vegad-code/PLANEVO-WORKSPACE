/**
 * Whether an event's end is strictly before `now`.
 * Cosmetic styling only — never gate edit/delete/drag/resize on this.
 */
export function isCalendarEventPast(
  endsAt: string | Date,
  now: Date = new Date(),
): boolean {
  const end = endsAt instanceof Date ? endsAt : new Date(endsAt)
  if (Number.isNaN(end.getTime())) return false
  return end.getTime() < now.getTime()
}
