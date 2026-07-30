/**
 * Whether an event's end is strictly before `now`.
 * Time/date helper only — event fills must stay solid (do not paper-wash
 * past blocks; that made saved events look muted vs draft/swatch).
 */
export function isCalendarEventPast(
  endsAt: string | Date,
  now: Date = new Date(),
): boolean {
  const end = endsAt instanceof Date ? endsAt : new Date(endsAt)
  if (Number.isNaN(end.getTime())) return false
  return end.getTime() < now.getTime()
}
