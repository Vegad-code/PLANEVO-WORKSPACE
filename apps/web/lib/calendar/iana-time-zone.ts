export type WallTimeParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  millisecond?: number
}

/** Resolves a provider-authored wall time without consulting the server zone. */
export function ianaWallTimeToDate(
  time: WallTimeParts,
  timeZone: string,
): Date {
  let formatter: Intl.DateTimeFormat
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  } catch {
    throw new Error(`Calendar feed uses an unsupported timezone: ${timeZone}.`)
  }

  const target = Date.UTC(
    time.year,
    time.month - 1,
    time.day,
    time.hour,
    time.minute,
    time.second,
  )
  let candidate = target
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(candidate))
        .filter(({ type }) => type !== "literal")
        .map(({ type, value }) => [type, Number(value)]),
    )
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    )
    const correction = target - represented
    if (correction === 0) {
      return new Date(candidate + (time.millisecond ?? 0))
    }
    candidate += correction
  }

  throw new Error(
    `Calendar feed contains a nonexistent local time in ${timeZone}.`,
  )
}
