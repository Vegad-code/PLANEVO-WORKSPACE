import type { ExternalCalendarEvent } from "./ics-calendar.ts"
import { ianaWallTimeToDate } from "./iana-time-zone.ts"

const GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
const GOOGLE_REQUEST_TIMEOUT_MS = 15_000
const MAX_GOOGLE_CALENDARS = 50
const MAX_GOOGLE_CALENDAR_LIST_PAGES = 10
export const GOOGLE_OAUTH_STATE_COOKIE =
  "planevo_google_calendar_oauth_state"
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.readonly",
] as const

export type GoogleCalendarApiFetch = typeof fetch

export type GoogleOAuthTokens = {
  accessToken: string
  refreshToken: string | null
  expiresInSeconds: number
  scopes: string[]
}

export type GoogleProfile = {
  id: string
  email: string
  name: string | null
}

export type GoogleCalendarListEntry = {
  id: string
  summary: string
  primary?: boolean
  selected?: boolean
  accessRole?: string
}

export type GoogleEventPayload = {
  id: string
  status?: string
  summary?: string
  location?: string
  description?: string
  etag?: string
  updated?: string
  start?: { date?: string; dateTime?: string; timeZone?: string }
  end?: { date?: string; dateTime?: string; timeZone?: string }
}

export type GoogleEventsPage = {
  items: GoogleEventPayload[]
  nextPageToken: string | null
  nextSyncToken: string | null
}

export class GoogleSyncTokenExpiredError extends Error {
  constructor() {
    super("Google Calendar sync token expired.")
    this.name = "GoogleSyncTokenExpiredError"
  }
}

async function fetchGoogle(
  fetchImpl: GoogleCalendarApiFetch,
  url: string | URL,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController()
  const deadline = setTimeout(
    () => controller.abort(new Error("Google Calendar request timed out.")),
    GOOGLE_REQUEST_TIMEOUT_MS,
  )
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(deadline)
  }
}

function googleOAuthConfig(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) {
    throw new Error("Google Calendar OAuth is not configured.")
  }
  return { clientId, clientSecret }
}

export function googleCalendarRedirectUri(origin: string): string {
  return new URL("/api/calendar-connections/google/callback", origin).href
}

export function googleCalendarOAuthOrigin(requestUrl: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  return new URL(configured || requestUrl).origin
}

export function buildGoogleCalendarAuthorizationUrl({
  origin,
  state,
}: {
  origin: string
  state: string
}): string {
  if (!state) throw new Error("OAuth state must be non-empty.")
  const { clientId } = googleOAuthConfig()
  const url = new URL(GOOGLE_AUTHORIZATION_URL)
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", googleCalendarRedirectUri(origin))
  url.searchParams.set("response_type", "code")
  url.searchParams.set("access_type", "offline")
  url.searchParams.set("include_granted_scopes", "true")
  url.searchParams.set("prompt", "consent")
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "))
  url.searchParams.set("state", state)
  return url.href
}

async function readGoogleJson<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as
    | { error?: unknown; error_description?: unknown }
    | null
  if (!response.ok) {
    const message =
      typeof payload?.error_description === "string"
        ? payload.error_description
        : typeof payload?.error === "string"
          ? payload.error
          : `Google Calendar returned HTTP ${response.status}.`
    throw new Error(message)
  }
  return payload as T
}

export async function exchangeGoogleCalendarCode({
  code,
  origin,
  fetchImpl = fetch,
}: {
  code: string
  origin: string
  fetchImpl?: GoogleCalendarApiFetch
}): Promise<GoogleOAuthTokens> {
  const { clientId, clientSecret } = googleOAuthConfig()
  const response = await fetchGoogle(fetchImpl, GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: googleCalendarRedirectUri(origin),
    }),
  })
  const payload = await readGoogleJson<{
    access_token?: string
    refresh_token?: string
    expires_in?: number
    scope?: string
  }>(response)
  if (!payload.access_token || !payload.expires_in) {
    throw new Error("Google did not return a usable access token.")
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresInSeconds: payload.expires_in,
    scopes: payload.scope?.split(/\s+/).filter(Boolean) ?? [...GOOGLE_SCOPES],
  }
}

export async function refreshGoogleCalendarToken({
  refreshToken,
  fetchImpl = fetch,
}: {
  refreshToken: string
  fetchImpl?: GoogleCalendarApiFetch
}): Promise<Omit<GoogleOAuthTokens, "refreshToken">> {
  const { clientId, clientSecret } = googleOAuthConfig()
  const response = await fetchGoogle(fetchImpl, GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })
  const payload = await readGoogleJson<{
    access_token?: string
    expires_in?: number
    scope?: string
  }>(response)
  if (!payload.access_token || !payload.expires_in) {
    throw new Error("Google did not refresh the access token.")
  }
  return {
    accessToken: payload.access_token,
    expiresInSeconds: payload.expires_in,
    scopes: payload.scope?.split(/\s+/).filter(Boolean) ?? [...GOOGLE_SCOPES],
  }
}

async function googleAuthorizedJson<T>({
  url,
  accessToken,
  fetchImpl,
  init,
}: {
  url: string | URL
  accessToken: string
  fetchImpl: GoogleCalendarApiFetch
  init?: RequestInit
}): Promise<T> {
  const response = await fetchGoogle(fetchImpl, url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...init?.headers,
    },
  })
  return readGoogleJson<T>(response)
}

export async function loadGoogleProfile(
  accessToken: string,
  fetchImpl: GoogleCalendarApiFetch = fetch,
): Promise<GoogleProfile> {
  const profile = await googleAuthorizedJson<{
    id?: string
    email?: string
    name?: string
  }>({
    url: GOOGLE_USERINFO_URL,
    accessToken,
    fetchImpl,
  })
  if (!profile.id || !profile.email) {
    throw new Error("Google account identity is unavailable.")
  }
  return { id: profile.id, email: profile.email, name: profile.name ?? null }
}

export async function listGoogleCalendars(
  accessToken: string,
  fetchImpl: GoogleCalendarApiFetch = fetch,
): Promise<GoogleCalendarListEntry[]> {
  const calendars: GoogleCalendarListEntry[] = []
  const seenPageTokens = new Set<string>()
  let pageToken: string | null = null
  let pageCount = 0
  do {
    pageCount += 1
    if (pageCount > MAX_GOOGLE_CALENDAR_LIST_PAGES) {
      throw new Error("Google returned too many calendar-list pages.")
    }
    if (pageToken) seenPageTokens.add(pageToken)

    const url = new URL(`${GOOGLE_CALENDAR_API}/users/me/calendarList`)
    url.searchParams.set("maxResults", String(MAX_GOOGLE_CALENDARS))
    if (pageToken) url.searchParams.set("pageToken", pageToken)
    const page = await googleAuthorizedJson<{
      items?: GoogleCalendarListEntry[]
      nextPageToken?: string
    }>({ url, accessToken, fetchImpl })
    for (const calendar of page.items ?? []) {
      if (calendar.id && calendar.accessRole !== "none") {
        calendars.push(calendar)
      }
      if (calendars.length >= MAX_GOOGLE_CALENDARS) break
    }
    if (calendars.length >= MAX_GOOGLE_CALENDARS) break

    const nextPageToken = page.nextPageToken ?? null
    if (nextPageToken && seenPageTokens.has(nextPageToken)) {
      throw new Error("Google repeated a calendar-list page token.")
    }
    pageToken = nextPageToken
  } while (pageToken)
  return calendars
}

export async function listGoogleEventsPage({
  accessToken,
  calendarId,
  pageToken = null,
  syncToken = null,
  initialTimeMin = null,
  initialTimeMax = null,
  fetchImpl = fetch,
}: {
  accessToken: string
  calendarId: string
  pageToken?: string | null
  syncToken?: string | null
  initialTimeMin?: string | null
  initialTimeMax?: string | null
  fetchImpl?: GoogleCalendarApiFetch
}): Promise<GoogleEventsPage> {
  const url = new URL(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
  )
  url.searchParams.set("maxResults", "2500")
  url.searchParams.set("singleEvents", "true")
  url.searchParams.set("showDeleted", "true")
  if (pageToken) url.searchParams.set("pageToken", pageToken)
  if (syncToken) {
    url.searchParams.set("syncToken", syncToken)
  } else if (initialTimeMin) {
    url.searchParams.set("timeMin", initialTimeMin)
    if (initialTimeMax) url.searchParams.set("timeMax", initialTimeMax)
  }

  const response = await fetchGoogle(fetchImpl, url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  })
  if (response.status === 410) throw new GoogleSyncTokenExpiredError()
  const payload = await readGoogleJson<{
    items?: GoogleEventPayload[]
    nextPageToken?: string
    nextSyncToken?: string
  }>(response)
  return {
    items: payload.items ?? [],
    nextPageToken: payload.nextPageToken ?? null,
    nextSyncToken: payload.nextSyncToken ?? null,
  }
}

function googleEventInstant(
  value: GoogleEventPayload["start"],
): { iso: string; allDay: boolean } | null {
  if (value?.dateTime) {
    const offsetPresent = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value.dateTime)
    const wallTime = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?$/.exec(
      value.dateTime,
    )
    const instant =
      !offsetPresent && value.timeZone && wallTime
        ? ianaWallTimeToDate(
            {
              year: Number(wallTime[1]),
              month: Number(wallTime[2]),
              day: Number(wallTime[3]),
              hour: Number(wallTime[4]),
              minute: Number(wallTime[5]),
              second: Number(wallTime[6]),
              millisecond: Number(
                (wallTime[7] ?? "").slice(0, 3).padEnd(3, "0"),
              ),
            },
            value.timeZone,
          )
        : new Date(value.dateTime)
    return Number.isFinite(instant.getTime())
      ? { iso: instant.toISOString(), allDay: false }
      : null
  }
  if (value?.date && /^\d{4}-\d{2}-\d{2}$/.test(value.date)) {
    return { iso: `${value.date}T00:00:00.000Z`, allDay: true }
  }
  return null
}

export function toExternalGoogleEvent(
  event: GoogleEventPayload,
  fallback?: Pick<ExternalCalendarEvent, "startsAt" | "endsAt" | "allDay">,
): ExternalCalendarEvent | null {
  const start = googleEventInstant(event.start)
  const end = googleEventInstant(event.end)
  const cancelled = event.status === "cancelled"
  const resolvedStart = start?.iso ?? fallback?.startsAt
  const resolvedEnd = end?.iso ?? fallback?.endsAt
  if (!event.id || !resolvedStart || !resolvedEnd) return null
  if (new Date(resolvedEnd) <= new Date(resolvedStart)) return null

  return {
    externalEventId: event.id,
    title: event.summary?.trim() || (cancelled ? "Cancelled event" : "Untitled event"),
    startsAt: resolvedStart,
    endsAt: resolvedEnd,
    allDay: start?.allDay ?? fallback?.allDay ?? false,
    location: event.location?.trim() || null,
    description: event.description?.trim() || null,
    etag: event.etag ?? null,
    updatedAt: event.updated ?? null,
    cancelled,
  }
}

export async function watchGoogleCalendar({
  accessToken,
  calendarId,
  channelId,
  channelToken,
  webhookUrl,
  expiresAt,
  fetchImpl = fetch,
}: {
  accessToken: string
  calendarId: string
  channelId: string
  channelToken: string
  webhookUrl: string
  expiresAt: Date
  fetchImpl?: GoogleCalendarApiFetch
}): Promise<{ resourceId: string; expiresAt: Date }> {
  const payload = await googleAuthorizedJson<{
    resourceId?: string
    expiration?: string
  }>({
    url: `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/watch`,
    accessToken,
    fetchImpl,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: webhookUrl,
        token: channelToken,
        expiration: String(expiresAt.getTime()),
      }),
    },
  })
  if (!payload.resourceId) {
    throw new Error("Google did not create a watch channel.")
  }
  const resolvedExpiration = payload.expiration
    ? new Date(Number(payload.expiration))
    : expiresAt
  return { resourceId: payload.resourceId, expiresAt: resolvedExpiration }
}

export async function stopGoogleCalendarWatch({
  accessToken,
  channelId,
  resourceId,
  fetchImpl = fetch,
}: {
  accessToken: string
  channelId: string
  resourceId: string
  fetchImpl?: GoogleCalendarApiFetch
}): Promise<void> {
  const response = await fetchGoogle(
    fetchImpl,
    `${GOOGLE_CALENDAR_API}/channels/stop`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: channelId, resourceId }),
    },
  )
  if (!response.ok && response.status !== 404) {
    await readGoogleJson(response)
  }
}
