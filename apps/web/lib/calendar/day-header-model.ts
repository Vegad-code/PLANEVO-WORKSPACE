export const isSameCalendarDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

export const isCalendarToday = (
  date: Date,
  now: Date = new Date(),
): boolean => isSameCalendarDay(date, now)

export const formatDayHeaderWeekday = (
  date: Date,
  locale = "en-US",
): string =>
  date
    .toLocaleDateString(locale, { weekday: "short" })
    .replace(/\./g, "")
    .toUpperCase()

export const formatDayHeaderDayNumber = (date: Date): string =>
  String(date.getDate())

/** Month cell label: "May 1" on the 1st, otherwise day number only. */
export const formatMonthDateLabel = (
  date: Date,
  locale = "en-US",
): string => {
  if (date.getDate() === 1) {
    return date.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
    })
  }
  return String(date.getDate())
}

export const formatDayHeaderAccessibleLabel = (
  date: Date,
  locale = "en-US",
): string =>
  date.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
