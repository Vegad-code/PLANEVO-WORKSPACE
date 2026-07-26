/** GCal-style now badge: spaced colon, e.g. `11 : 10 AM`. */
export function formatNowIndicatorTime(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const period = hours < 12 ? "AM" : "PM"
  const hour12 = hours % 12 === 0 ? 12 : hours % 12
  const minutePart = String(minutes).padStart(2, "0")
  return `${hour12} :${minutePart} ${period}`
}
