/** Client-side due-date helpers for quick-add task buckets (mirrors server actions). */

export function endOfWeekIso(now: Date): string {
  const date = new Date(now)
  const daysUntilSunday = (7 - date.getDay()) % 7
  date.setDate(date.getDate() + daysUntilSunday)
  date.setHours(23, 59, 0, 0)
  return date.toISOString()
}

export function endOfMonthIso(now: Date): string {
  return new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    0,
    0,
  ).toISOString()
}

export function quickAddTaskDueAt(
  bucket: "week" | "month" | "none",
  now = new Date(),
): string | null {
  if (bucket === "week") return endOfWeekIso(now)
  if (bucket === "month") return endOfMonthIso(now)
  return null
}
