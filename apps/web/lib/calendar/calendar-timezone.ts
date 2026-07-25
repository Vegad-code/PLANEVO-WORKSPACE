export function formatUtcOffsetLabel(
  date: Date = new Date(),
  offsetMinutes: number = -date.getTimezoneOffset(),
): string {
  const sign = offsetMinutes >= 0 ? "+" : "-"
  const absolute = Math.abs(offsetMinutes)
  const hours = String(Math.floor(absolute / 60)).padStart(2, "0")
  const minutes = String(absolute % 60).padStart(2, "0")
  return `UTC${sign}${hours}:${minutes}`
}

/** Compact label for the grid time gutter (Google Calendar uses GMT±N). */
export function formatGmtOffsetLabel(
  date: Date = new Date(),
  offsetMinutes: number = -date.getTimezoneOffset(),
): string {
  const sign = offsetMinutes >= 0 ? "+" : "-"
  const hours = Math.floor(Math.abs(offsetMinutes) / 60)
  return `GMT${sign}${hours}`
}
