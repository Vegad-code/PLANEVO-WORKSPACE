export type BrowserReminderCandidate = {
  reminderId: string
  eventId: string
  title: string
  startsAt: string
  offsetMinutes: number
  location: string | null
}

export type DueBrowserReminder = BrowserReminderCandidate & {
  notificationKey: string
}

export function dueBrowserReminder(
  candidate: BrowserReminderCandidate,
  {
    now,
    lookbackMs = 5 * 60_000,
    lookaheadMs = 30_000,
  }: {
    now: Date
    lookbackMs?: number
    lookaheadMs?: number
  },
): DueBrowserReminder | null {
  const startsAt = new Date(candidate.startsAt)
  if (
    !Number.isFinite(now.getTime()) ||
    !Number.isFinite(startsAt.getTime()) ||
    !Number.isInteger(candidate.offsetMinutes) ||
    candidate.offsetMinutes < 0
  ) {
    return null
  }
  const reminderAt =
    startsAt.getTime() - candidate.offsetMinutes * 60_000
  if (
    reminderAt < now.getTime() - lookbackMs ||
    reminderAt > now.getTime() + lookaheadMs
  ) {
    return null
  }
  return {
    ...candidate,
    notificationKey: `${candidate.reminderId}:${candidate.startsAt}`,
  }
}

export function browserReminderBody(
  candidate: BrowserReminderCandidate,
  {
    locale,
    timeZone,
  }: {
    locale?: string
    timeZone?: string
  } = {},
): string {
  const startsAt = new Date(candidate.startsAt)
  if (!Number.isFinite(startsAt.getTime())) return "Starts soon"
  const time = startsAt.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  })
  return candidate.location
    ? `${time} · ${candidate.location}`
    : `Starts at ${time}`
}

export function deliverBrowserReminder(
  reminder: DueBrowserReminder,
  {
    notify,
    remember,
  }: {
    notify: (
      title: string,
      options: { body: string; tag: string },
    ) => void
    remember: (notificationKey: string) => void
  },
): boolean {
  try {
    notify(reminder.title, {
      body: browserReminderBody(reminder),
      tag: reminder.notificationKey,
    })
    remember(reminder.notificationKey)
    return true
  } catch {
    return false
  }
}
