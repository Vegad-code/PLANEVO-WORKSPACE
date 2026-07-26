import ICAL from "ical.js"
import { ianaWallTimeToDate } from "./iana-time-zone.ts"

const MAX_ICS_EVENTS = 5_000
const MAX_ICS_ITERATIONS_PER_SERIES = 100_000

export type ExternalCalendarEvent = {
  externalEventId: string
  title: string
  startsAt: string
  endsAt: string
  allDay: boolean
  location: string | null
  description: string | null
  etag: string | null
  updatedAt: string | null
  cancelled: boolean
}

function validRange(start: Date, end: Date): boolean {
  return (
    Number.isFinite(start.getTime()) &&
    Number.isFinite(end.getTime()) &&
    end > start
  )
}

function statusCancelled(event: InstanceType<typeof ICAL.Event>): boolean {
  const status = event.component.getFirstPropertyValue("status")
  return typeof status === "string" && status.toUpperCase() === "CANCELLED"
}

type IcalTime = InstanceType<typeof ICAL.Time>

function utcDateFromIcalFields(time: IcalTime): Date {
  return new Date(
    Date.UTC(
      time.year,
      time.month - 1,
      time.day,
      time.isDate ? 0 : time.hour,
      time.isDate ? 0 : time.minute,
      time.isDate ? 0 : time.second,
    ),
  )
}

function propertyTimeZone(
  event: InstanceType<typeof ICAL.Event>,
  propertyName: "dtstart" | "dtend",
): string | null {
  const property =
    event.component.getFirstProperty(propertyName) ??
    event.component.getFirstProperty("dtstart")
  const value = property?.getParameter("tzid")
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function icalTimeToDate({
  time,
  event,
  propertyName,
}: {
  time: IcalTime
  event: InstanceType<typeof ICAL.Event>
  propertyName: "dtstart" | "dtend"
}): Date {
  if (time.isDate) return utcDateFromIcalFields(time)
  const timeZone = propertyTimeZone(event, propertyName)
  if (timeZone && time.zone === ICAL.Timezone.localTimezone) {
    return ianaWallTimeToDate(
      {
        year: time.year,
        month: time.month,
        day: time.day,
        hour: time.hour,
        minute: time.minute,
        second: time.second,
      },
      timeZone,
    )
  }
  return time.toJSDate()
}

function toExternalEvent({
  event,
  start,
  end,
  externalEventId,
}: {
  event: InstanceType<typeof ICAL.Event>
  start: InstanceType<typeof ICAL.Time>
  end: InstanceType<typeof ICAL.Time>
  externalEventId: string
}): ExternalCalendarEvent | null {
  const startsAt = icalTimeToDate({
    time: start,
    event,
    propertyName: "dtstart",
  })
  const endsAt = icalTimeToDate({
    time: end,
    event,
    propertyName: "dtend",
  })
  if (!validRange(startsAt, endsAt)) return null

  return {
    externalEventId,
    title: event.summary?.trim() || "Untitled event",
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    allDay: start.isDate,
    location: event.location?.trim() || null,
    description: event.description?.trim() || null,
    etag: null,
    updatedAt: null,
    cancelled: statusCancelled(event),
  }
}

function inWindow(
  event: ExternalCalendarEvent,
  windowStart: Date,
  windowEnd: Date,
): boolean {
  return (
    new Date(event.startsAt) < windowEnd &&
    new Date(event.endsAt) > windowStart
  )
}

/**
 * Parses a subscription snapshot and expands recurrence inside a bounded
 * rolling window. Occurrence ids use the original recurrence identity, so a
 * moved exception updates the same row rather than duplicating it.
 */
export function parseIcsCalendar(
  source: string,
  {
    windowStart,
    windowEnd,
  }: {
    windowStart: Date
    windowEnd: Date
  },
): ExternalCalendarEvent[] {
  if (!validRange(windowStart, windowEnd)) {
    throw new Error("ICS expansion needs a valid time window.")
  }

  const root = new ICAL.Component(ICAL.parse(source))
  if (root.name !== "vcalendar") {
    throw new Error("The subscription did not return an iCalendar feed.")
  }

  const parsed = root
    .getAllSubcomponents("vevent")
    .map((component) => new ICAL.Event(component))
  const masters = new Map<string, InstanceType<typeof ICAL.Event>>()
  const exceptions = new Map<
    string,
    Array<InstanceType<typeof ICAL.Event>>
  >()

  for (const event of parsed) {
    const uid = event.uid?.trim()
    if (!uid) continue
    if (event.isRecurrenceException()) {
      const current = exceptions.get(uid) ?? []
      current.push(event)
      exceptions.set(uid, current)
    } else {
      masters.set(uid, event)
    }
  }

  const output: ExternalCalendarEvent[] = []
  const append = (event: ExternalCalendarEvent) => {
    if (output.length >= MAX_ICS_EVENTS) {
      throw new Error("Calendar feed produced too many occurrences.")
    }
    output.push(event)
  }
  for (const [uid, master] of masters) {
    for (const exception of exceptions.get(uid) ?? []) {
      master.relateException(exception)
    }

    if (!master.isRecurring()) {
      const item = toExternalEvent({
        event: master,
        start: master.startDate,
        end: master.endDate,
        externalEventId: uid,
      })
      if (item && inWindow(item, windowStart, windowEnd)) append(item)
      continue
    }

    // ICAL's iterator(startTime) treats that argument as the recurrence seed,
    // not only a lower bound, which can silently replace the authored hour.
    // Start from DTSTART and skip until the bounded window instead.
    const iterator = master.iterator()
    let iterationCount = 0
    for (
      let recurrenceId = iterator.next();
      recurrenceId;
      recurrenceId = iterator.next()
    ) {
      iterationCount += 1
      if (iterationCount > MAX_ICS_ITERATIONS_PER_SERIES) {
        throw new Error("Calendar feed produced too many occurrences.")
      }

      const details = master.getOccurrenceDetails(recurrenceId)
      const occurrenceStartsAt = icalTimeToDate({
        time: details.startDate,
        event: details.item,
        propertyName: "dtstart",
      })
      if (occurrenceStartsAt >= windowEnd) break
      const item = toExternalEvent({
        event: details.item,
        start: details.startDate,
        end: details.endDate,
        externalEventId: `${uid}::${icalTimeToDate({
          time: details.recurrenceId,
          event: master,
          propertyName: "dtstart",
        }).toISOString()}`,
      })
      if (item && inWindow(item, windowStart, windowEnd)) append(item)
    }
  }

  return output.sort(
    (left, right) =>
      left.startsAt.localeCompare(right.startsAt) ||
      left.externalEventId.localeCompare(right.externalEventId),
  )
}
