import assert from "node:assert/strict"
import test from "node:test"
import { parseIcsCalendar } from "./ics-calendar.ts"

const feed = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Planevo Test//EN",
  "BEGIN:VEVENT",
  "UID:standalone",
  "DTSTART:20260726T100000Z",
  "DTEND:20260726T110000Z",
  "SUMMARY:Planning",
  "DESCRIPTION:Bring notes",
  "LOCATION:Room 2",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:holiday",
  "DTSTART;VALUE=DATE:20260727",
  "DTEND;VALUE=DATE:20260728",
  "SUMMARY:Holiday",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:series",
  "DTSTART:20260726T120000Z",
  "DTEND:20260726T123000Z",
  "RRULE:FREQ=DAILY;COUNT=3",
  "EXDATE:20260727T120000Z",
  "SUMMARY:Daily focus",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:series",
  "RECURRENCE-ID:20260728T120000Z",
  "DTSTART:20260728T140000Z",
  "DTEND:20260728T150000Z",
  "SUMMARY:Moved focus",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n")

const window = {
  windowStart: new Date("2026-07-25T00:00:00.000Z"),
  windowEnd: new Date("2026-07-30T00:00:00.000Z"),
}

test("ICS parsing keeps timed, all-day, and descriptive event fields", () => {
  const events = parseIcsCalendar(feed, window)
  const standalone = events.find(
    ({ externalEventId }) => externalEventId === "standalone",
  )
  const holiday = events.find(
    ({ externalEventId }) => externalEventId === "holiday",
  )

  assert.deepEqual(standalone, {
    externalEventId: "standalone",
    title: "Planning",
    startsAt: "2026-07-26T10:00:00.000Z",
    endsAt: "2026-07-26T11:00:00.000Z",
    allDay: false,
    location: "Room 2",
    description: "Bring notes",
    etag: null,
    updatedAt: null,
    cancelled: false,
  })
  assert.equal(holiday?.allDay, true)
  assert.equal(holiday.startsAt, "2026-07-27T00:00:00.000Z")
  assert.equal(holiday.endsAt, "2026-07-28T00:00:00.000Z")
})

test("IANA TZID values work without an embedded VTIMEZONE", () => {
  const timezoned = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:new-york",
    "DTSTART;TZID=America/New_York:20260726T090000",
    "DTEND;TZID=America/New_York:20260726T100000",
    "SUMMARY:New York morning",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")

  const [event] = parseIcsCalendar(timezoned, window)
  assert.equal(event.startsAt, "2026-07-26T13:00:00.000Z")
  assert.equal(event.endsAt, "2026-07-26T14:00:00.000Z")
})

test("unknown and nonexistent local times fail closed", () => {
  const feedFor = (timeZone, localTime) =>
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      "UID:invalid-zone",
      `DTSTART;TZID=${timeZone}:${localTime}`,
      `DTEND;TZID=${timeZone}:20260308T033000`,
      "SUMMARY:Invalid timezone event",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n")

  assert.throws(
    () => parseIcsCalendar(feedFor("Not/A_Real_Zone", "20260308T020000"), window),
    /unsupported timezone/,
  )
  assert.throws(
    () =>
      parseIcsCalendar(
        feedFor("America/New_York", "20260308T023000"),
        {
          windowStart: new Date("2026-03-08T00:00:00.000Z"),
          windowEnd: new Date("2026-03-09T00:00:00.000Z"),
        },
      ),
    /nonexistent local time/,
  )
})

test("ICS recurrence expands deterministically with exclusions and moved exceptions", () => {
  const events = parseIcsCalendar(feed, window)
  const series = events.filter(({ externalEventId }) =>
    externalEventId.startsWith("series::"),
  )

  assert.deepEqual(
    series.map(({ externalEventId, title, startsAt, endsAt }) => ({
      externalEventId,
      title,
      startsAt,
      endsAt,
    })),
    [
      {
        externalEventId: "series::2026-07-26T12:00:00.000Z",
        title: "Daily focus",
        startsAt: "2026-07-26T12:00:00.000Z",
        endsAt: "2026-07-26T12:30:00.000Z",
      },
      {
        externalEventId: "series::2026-07-28T12:00:00.000Z",
        title: "Moved focus",
        startsAt: "2026-07-28T14:00:00.000Z",
        endsAt: "2026-07-28T15:00:00.000Z",
      },
    ],
  )
})

test("invalid feeds, invalid ranges, and runaway recurrences fail closed", () => {
  assert.throws(() => parseIcsCalendar("not an ics file", window))
  assert.throws(() =>
    parseIcsCalendar(feed, {
      windowStart: new Date("invalid"),
      windowEnd: window.windowEnd,
    }),
  )

  const runaway = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:runaway",
    "DTSTART:20260101T120000Z",
    "DTEND:20260101T123000Z",
    "RRULE:FREQ=MINUTELY",
    "SUMMARY:Runaway",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")
  assert.throws(
    () =>
      parseIcsCalendar(runaway, {
        windowStart: new Date("2026-01-01T00:00:00.000Z"),
        windowEnd: new Date("2027-01-01T00:00:00.000Z"),
      }),
    /too many occurrences/,
  )
})

test("long-running daily series skip old instances without tripping the output cap", () => {
  const longRunning = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:long-running",
    "DTSTART:20000101T120000Z",
    "DTEND:20000101T123000Z",
    "RRULE:FREQ=DAILY",
    "SUMMARY:Daily ritual",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")

  const events = parseIcsCalendar(longRunning, {
    windowStart: new Date("2026-07-25T00:00:00.000Z"),
    windowEnd: new Date("2026-07-30T00:00:00.000Z"),
  })

  assert.equal(events.length, 5)
  assert.equal(events[0].startsAt, "2026-07-25T12:00:00.000Z")
})
