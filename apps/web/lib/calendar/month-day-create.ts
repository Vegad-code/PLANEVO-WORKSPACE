/**
 * Month cells have no time axis to drag against, so creating from a day needs a
 * default slot. 9am matches the hour the week grid scrolls to and the hour the
 * planning rail treats as the start of the day.
 */
export const MONTH_CREATE_START_HOUR = 9
export const MONTH_CREATE_DURATION_MINUTES = 60

export function defaultMonthCreateRange(date: Date): {
  startsAt: Date
  endsAt: Date
} {
  const startsAt = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    MONTH_CREATE_START_HOUR,
    0,
    0,
    0,
  )

  return {
    startsAt,
    endsAt: new Date(
      startsAt.getTime() + MONTH_CREATE_DURATION_MINUTES * 60_000,
    ),
  }
}
