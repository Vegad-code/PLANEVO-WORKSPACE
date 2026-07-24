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
