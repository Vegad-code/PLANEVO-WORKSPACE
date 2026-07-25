/** Google-style compact time for month view chips: 9a, 9:30a, 12p, 3:30p */
export function formatCompactMonthTime(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const period = hours < 12 ? "a" : "p"
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  if (minutes === 0) {
    return `${hour12}${period}`
  }
  const minutePart = String(minutes).padStart(2, "0")
  return `${hour12}:${minutePart}${period}`
}
