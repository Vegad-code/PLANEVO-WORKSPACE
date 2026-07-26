import assert from "node:assert/strict"
import test from "node:test"
import {
  GoogleSyncTokenExpiredError,
  buildGoogleCalendarAuthorizationUrl,
  listGoogleCalendars,
  listGoogleEventsPage,
  toExternalGoogleEvent,
} from "./google-calendar-api.ts"

test("Google OAuth requests offline calendar access with a verified state round trip", () => {
  // Arrange
  process.env.GOOGLE_CALENDAR_CLIENT_ID = "client-id"
  process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "client-secret"

  // Act
  const url = new URL(
    buildGoogleCalendarAuthorizationUrl({
      origin: "https://planevo.example",
      state: "state-token",
    }),
  )

  // Assert
  assert.equal(url.searchParams.get("access_type"), "offline")
  assert.equal(url.searchParams.get("prompt"), "consent")
  assert.equal(url.searchParams.get("state"), "state-token")
  assert.match(url.searchParams.get("scope"), /calendar\.readonly/)
  assert.equal(
    url.searchParams.get("redirect_uri"),
    "https://planevo.example/api/calendar-connections/google/callback",
  )
})

test("calendar discovery is capped and rejects repeated pagination tokens", async () => {
  const fiftyCalendars = Array.from({ length: 50 }, (_, index) => ({
    id: `calendar-${index}`,
    summary: `Calendar ${index}`,
    accessRole: "reader",
  }))
  let requests = 0
  const calendars = await listGoogleCalendars("access", async () => {
    requests += 1
    return Response.json({
      items: fiftyCalendars,
      nextPageToken: "ignored-after-cap",
    })
  })

  assert.equal(calendars.length, 50)
  assert.equal(requests, 1)

  await assert.rejects(
    listGoogleCalendars("access", async () =>
      Response.json({
        items: [],
        nextPageToken: "repeated",
      }),
    ),
    /repeated a calendar-list page token/,
  )
})

test("incremental event requests use the sync token and surface HTTP 410 distinctly", async () => {
  // Arrange
  let requestedUrl = null
  const fetchImpl = async (url) => {
    requestedUrl = new URL(url)
    return new Response(JSON.stringify({ error: "Gone" }), { status: 410 })
  }

  // Act / Assert
  await assert.rejects(
    listGoogleEventsPage({
      accessToken: "access",
      calendarId: "team/calendar",
      syncToken: "sync-token",
      initialTimeMin: "2025-01-01T00:00:00.000Z",
      fetchImpl,
    }),
    GoogleSyncTokenExpiredError,
  )
  assert.equal(requestedUrl.searchParams.get("syncToken"), "sync-token")
  assert.equal(requestedUrl.searchParams.has("timeMin"), false)
  assert.match(requestedUrl.pathname, /team%2Fcalendar/)
})

test("Google events preserve timed, all-day, and deletion identities", () => {
  // Arrange / Act
  const timed = toExternalGoogleEvent({
    id: "timed",
    summary: "Planning",
    start: { dateTime: "2026-07-26T09:00:00-07:00" },
    end: { dateTime: "2026-07-26T10:00:00-07:00" },
  })
  const allDay = toExternalGoogleEvent({
    id: "all-day",
    start: { date: "2026-07-27" },
    end: { date: "2026-07-28" },
  })
  const wallTime = toExternalGoogleEvent({
    id: "wall-time",
    start: {
      dateTime: "2026-07-26T09:00:00.125",
      timeZone: "America/New_York",
    },
    end: {
      dateTime: "2026-07-26T10:00:00.125",
      timeZone: "America/New_York",
    },
  })
  const deleted = toExternalGoogleEvent(
    { id: "deleted", status: "cancelled" },
    {
      startsAt: "2026-07-27T16:00:00.000Z",
      endsAt: "2026-07-27T17:00:00.000Z",
      allDay: false,
    },
  )

  // Assert
  assert.equal(timed.startsAt, "2026-07-26T16:00:00.000Z")
  assert.equal(allDay.allDay, true)
  assert.equal(wallTime.startsAt, "2026-07-26T13:00:00.125Z")
  assert.equal(wallTime.endsAt, "2026-07-26T14:00:00.125Z")
  assert.equal(deleted.cancelled, true)
  assert.equal(deleted.externalEventId, "deleted")
})
