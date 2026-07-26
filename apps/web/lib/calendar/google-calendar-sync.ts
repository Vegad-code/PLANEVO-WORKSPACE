import { randomBytes, randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@planevo/core/types/database.types"
import {
  calendarTokenEncryptionKey,
  openCalendarToken,
  sealCalendarToken,
} from "./calendar-token-crypto.ts"
import { applyExternalCalendarSync } from "./external-calendar-store.ts"
import type { ExternalCalendarEvent } from "./ics-calendar.ts"
import {
  GoogleSyncTokenExpiredError,
  listGoogleEventsPage,
  refreshGoogleCalendarToken,
  stopGoogleCalendarWatch,
  toExternalGoogleEvent,
  watchGoogleCalendar,
  type GoogleCalendarApiFetch,
  type GoogleEventPayload,
} from "./google-calendar-api.ts"

type CalendarAccount =
  Database["public"]["Tables"]["calendar_accounts"]["Row"]
export type GoogleCalendarConnection =
  Database["public"]["Tables"]["calendar_connections"]["Row"]

type GoogleSyncDependencies = {
  listEventsPage: typeof listGoogleEventsPage
  refreshAccessToken: typeof refreshGoogleCalendarToken
  applyEvents: typeof applyExternalCalendarSync
  createWatch: typeof watchGoogleCalendar
  stopWatch: typeof stopGoogleCalendarWatch
}

const defaultDependencies: GoogleSyncDependencies = {
  listEventsPage: listGoogleEventsPage,
  refreshAccessToken: refreshGoogleCalendarToken,
  applyEvents: applyExternalCalendarSync,
  createWatch: watchGoogleCalendar,
  stopWatch: stopGoogleCalendarWatch,
}

const GOOGLE_EVENT_FALLBACK_BATCH_SIZE = 100
const MAX_GOOGLE_EVENT_PAGES = 10
const GOOGLE_SYNC_PAST_YEARS = 1
const GOOGLE_SYNC_FUTURE_YEARS = 2
const GOOGLE_REBASELINE_LEAD_YEARS = 1
const MAX_SYNC_RETRY_DELAY_MS = 6 * 60 * 60 * 1_000

function nextSyncRetryAt(now: Date, priorFailures: number): string {
  const failureCount = Math.max(1, priorFailures + 1)
  const delay = Math.min(
    MAX_SYNC_RETRY_DELAY_MS,
    5 * 60_000 * 2 ** Math.min(failureCount - 1, 6),
  )
  return new Date(now.getTime() + delay).toISOString()
}

async function updateOwnedConnection(
  client: SupabaseClient<Database>,
  connection: GoogleCalendarConnection,
  patch: Database["public"]["Tables"]["calendar_connections"]["Update"],
): Promise<void> {
  const { error } = await client
    .from("calendar_connections")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", connection.id)
    .eq("user_id", connection.user_id)
  if (error) throw error
}

async function loadGoogleAccount(
  client: SupabaseClient<Database>,
  connection: GoogleCalendarConnection,
): Promise<CalendarAccount> {
  if (!connection.account_id) {
    throw new TypeError("Google connection is missing its account.")
  }
  const { data, error } = await client
    .from("calendar_accounts")
    .select("*")
    .eq("id", connection.account_id)
    .eq("user_id", connection.user_id)
    .maybeSingle()
  if (error) throw error
  if (!data || data.revoked_at) {
    throw new Error("Google Calendar account is disconnected.")
  }
  return data
}

export async function freshGoogleCalendarAccessToken(
  client: SupabaseClient<Database>,
  account: CalendarAccount,
  {
    now = new Date(),
    fetchImpl = fetch,
    dependencies = defaultDependencies,
  }: {
    now?: Date
    fetchImpl?: GoogleCalendarApiFetch
    dependencies?: GoogleSyncDependencies
  } = {},
): Promise<string> {
  const key = calendarTokenEncryptionKey()
  if (new Date(account.token_expires_at).getTime() > now.getTime() + 60_000) {
    return openCalendarToken(account.access_token_ciphertext, key)
  }

  const refreshed = await dependencies.refreshAccessToken({
    refreshToken: openCalendarToken(account.refresh_token_ciphertext, key),
    fetchImpl,
  })
  const tokenExpiresAt = new Date(
    now.getTime() + refreshed.expiresInSeconds * 1_000,
  ).toISOString()
  const { error } = await client
    .from("calendar_accounts")
    .update({
      access_token_ciphertext: sealCalendarToken(refreshed.accessToken, key),
      token_expires_at: tokenExpiresAt,
      scopes: refreshed.scopes,
      updated_at: now.toISOString(),
    })
    .eq("id", account.id)
    .eq("user_id", account.user_id)
  if (error) throw error
  return refreshed.accessToken
}

async function collectGoogleEvents({
  accessToken,
  providerCalendarId,
  syncToken,
  now,
  fetchImpl,
  dependencies,
}: {
  accessToken: string
  providerCalendarId: string
  syncToken: string | null
  now: Date
  fetchImpl: GoogleCalendarApiFetch
  dependencies: GoogleSyncDependencies
}): Promise<{
  payloads: GoogleEventPayload[]
  nextSyncToken: string
  syncWindowEnd: string
}> {
  const payloads: GoogleEventPayload[] = []
  const seenPageTokens = new Set<string>()
  let pageToken: string | null = null
  let nextSyncToken: string | null = null
  let pageCount = 0
  const initialTimeMin = new Date(now)
  initialTimeMin.setUTCFullYear(
    initialTimeMin.getUTCFullYear() - GOOGLE_SYNC_PAST_YEARS,
  )
  const initialTimeMax = new Date(now)
  initialTimeMax.setUTCFullYear(
    initialTimeMax.getUTCFullYear() + GOOGLE_SYNC_FUTURE_YEARS,
  )

  do {
    pageCount += 1
    if (pageCount > MAX_GOOGLE_EVENT_PAGES) {
      throw new RangeError("Google Calendar returned too many event pages.")
    }
    if (pageToken) seenPageTokens.add(pageToken)

    const page = await dependencies.listEventsPage({
      accessToken,
      calendarId: providerCalendarId,
      pageToken,
      syncToken,
      initialTimeMin: syncToken ? null : initialTimeMin.toISOString(),
      initialTimeMax: syncToken ? null : initialTimeMax.toISOString(),
      fetchImpl,
    })
    payloads.push(...page.items)
    if (payloads.length > 5_000) {
      throw new RangeError("Google Calendar returned too many changes at once.")
    }
    if (
      page.nextPageToken &&
      seenPageTokens.has(page.nextPageToken)
    ) {
      throw new Error("Google repeated an event-list page token.")
    }
    pageToken = page.nextPageToken
    nextSyncToken = page.nextSyncToken ?? nextSyncToken
  } while (pageToken)

  if (!nextSyncToken) {
    throw new Error("Google did not return the next incremental sync token.")
  }
  return {
    payloads,
    nextSyncToken,
    syncWindowEnd: initialTimeMax.toISOString(),
  }
}

async function existingGoogleEventFallbacks(
  client: SupabaseClient<Database>,
  connection: GoogleCalendarConnection,
  payloads: GoogleEventPayload[],
): Promise<Map<string, Pick<ExternalCalendarEvent, "startsAt" | "endsAt" | "allDay">>> {
  const hasProviderTime = (
    value: GoogleEventPayload["start"] | GoogleEventPayload["end"],
  ): boolean =>
    Boolean(value?.dateTime || value?.date)

  const missingTimeIds = payloads
    // Google deletion notifications may keep empty start/end objects. Their
    // persisted range is required to turn that tombstone into a local delete.
    .filter(
      (event) =>
        event.id &&
        (!hasProviderTime(event.start) || !hasProviderTime(event.end)),
    )
    .map((event) => event.id)
  if (missingTimeIds.length === 0) return new Map()

  const fallbacks = new Map<
    string,
    Pick<ExternalCalendarEvent, "startsAt" | "endsAt" | "allDay">
  >()
  for (
    let index = 0;
    index < missingTimeIds.length;
    index += GOOGLE_EVENT_FALLBACK_BATCH_SIZE
  ) {
    const batch = missingTimeIds.slice(
      index,
      index + GOOGLE_EVENT_FALLBACK_BATCH_SIZE,
    )
    const { data, error } = await client
      .from("calendar_events")
      .select("external_event_id, starts_at, ends_at, all_day")
      .eq("external_connection_id", connection.id)
      .in("external_event_id", batch)
    if (error) throw error

    for (const event of data ?? []) {
      if (!event.external_event_id) continue
      fallbacks.set(event.external_event_id, {
        startsAt: event.starts_at,
        endsAt: event.ends_at,
        allDay: event.all_day,
      })
    }
  }
  return fallbacks
}

async function recordGoogleSyncFailure(
  client: SupabaseClient<Database>,
  connection: GoogleCalendarConnection,
  cause: unknown,
  now: Date,
): Promise<void> {
  const message =
    cause instanceof Error ? cause.message.slice(0, 1_000) : "Google sync failed."
  const failureCount = (connection.consecutive_failure_count ?? 0) + 1
  await updateOwnedConnection(client, connection, {
    last_sync_error: message,
    last_attempted_at: now.toISOString(),
    next_retry_at: nextSyncRetryAt(
      now,
      connection.consecutive_failure_count ?? 0,
    ),
    consecutive_failure_count: failureCount,
  }).catch(() => undefined)
}

/** Runs Google full/incremental sync, resetting exactly once after a 410. */
export async function syncGoogleConnection(
  client: SupabaseClient<Database>,
  connection: GoogleCalendarConnection,
  {
    now = new Date(),
    fetchImpl = fetch,
    dependencies = defaultDependencies,
  }: {
    now?: Date
    fetchImpl?: GoogleCalendarApiFetch
    dependencies?: GoogleSyncDependencies
  } = {},
): Promise<{ eventCount: number; fullSync: boolean }> {
  if (
    connection.provider !== "google" ||
    !connection.provider_calendar_id ||
    !connection.account_id
  ) {
    throw new TypeError("Google sync needs a complete Google connection.")
  }

  try {
    const account = await loadGoogleAccount(client, connection)
    const accessToken = await freshGoogleCalendarAccessToken(client, account, {
      now,
      fetchImpl,
      dependencies,
    })
    const rebaselineBefore = new Date(now)
    rebaselineBefore.setUTCFullYear(
      rebaselineBefore.getUTCFullYear() + GOOGLE_REBASELINE_LEAD_YEARS,
    )
    const syncWindowEnd = connection.sync_window_end
      ? new Date(connection.sync_window_end)
      : null
    let fullSync =
      connection.sync_token === null ||
      !syncWindowEnd ||
      !Number.isFinite(syncWindowEnd.getTime()) ||
      syncWindowEnd <= rebaselineBefore
    let delta
    try {
      delta = await collectGoogleEvents({
        accessToken,
        providerCalendarId: connection.provider_calendar_id,
        syncToken: fullSync ? null : connection.sync_token,
        now,
        fetchImpl,
        dependencies,
      })
    } catch (cause) {
      if (
        !(cause instanceof GoogleSyncTokenExpiredError) ||
        fullSync
      ) {
        throw cause
      }
      fullSync = true
      delta = await collectGoogleEvents({
        accessToken,
        providerCalendarId: connection.provider_calendar_id,
        syncToken: null,
        now,
        fetchImpl,
        dependencies,
      })
    }

    const fallbacks = await existingGoogleEventFallbacks(
      client,
      connection,
      delta.payloads,
    )
    const events = delta.payloads.flatMap((payload) => {
      const event = toExternalGoogleEvent(payload, fallbacks.get(payload.id))
      return event ? [event] : []
    })
    const eventCount = await dependencies.applyEvents(client, {
      ownerId: connection.user_id,
      connectionId: connection.id,
      events,
      replace: fullSync,
    })
    await updateOwnedConnection(client, connection, {
      sync_token: delta.nextSyncToken,
      sync_window_end: fullSync
        ? delta.syncWindowEnd
        : connection.sync_window_end,
      last_synced_at: now.toISOString(),
      last_attempted_at: now.toISOString(),
      next_retry_at: "-infinity",
      consecutive_failure_count: 0,
      last_sync_error: null,
    })
    return { eventCount, fullSync }
  } catch (cause) {
    await recordGoogleSyncFailure(client, connection, cause, now)
    throw cause
  }
}

function googleCalendarWebhookUrl(): string {
  const configured = process.env.CALENDAR_GOOGLE_WEBHOOK_URL?.trim()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  const url = configured
    ? new URL(configured)
    : appUrl
      ? new URL("/api/calendar-connections/google/webhook", appUrl)
      : null
  if (!url || url.protocol !== "https:") {
    throw new Error("Google Calendar webhook URL must use HTTPS.")
  }
  return url.href
}

/** Creates a replacement watch before retiring the old channel. */
export async function renewGoogleCalendarWatch(
  client: SupabaseClient<Database>,
  connection: GoogleCalendarConnection,
  {
    now = new Date(),
    fetchImpl = fetch,
    dependencies = defaultDependencies,
  }: {
    now?: Date
    fetchImpl?: GoogleCalendarApiFetch
    dependencies?: GoogleSyncDependencies
  } = {},
): Promise<void> {
  if (
    connection.provider !== "google" ||
    !connection.provider_calendar_id ||
    !connection.account_id
  ) {
    throw new TypeError("Google watch needs a complete Google connection.")
  }

  const account = await loadGoogleAccount(client, connection)
  const accessToken = await freshGoogleCalendarAccessToken(client, account, {
    now,
    fetchImpl,
    dependencies,
  })
  const channelId = randomUUID()
  const channelToken = randomBytes(32).toString("base64url")
  const requestedExpiration = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1_000)
  const watch = await dependencies.createWatch({
    accessToken,
    calendarId: connection.provider_calendar_id,
    channelId,
    channelToken,
    webhookUrl: googleCalendarWebhookUrl(),
    expiresAt: requestedExpiration,
    fetchImpl,
  })

  await updateOwnedConnection(client, connection, {
    watch_channel_id: channelId,
    watch_resource_id: watch.resourceId,
    watch_token: channelToken,
    watch_expires_at: watch.expiresAt.toISOString(),
    last_attempted_at: now.toISOString(),
    next_retry_at: "-infinity",
    consecutive_failure_count: 0,
    last_sync_error: null,
  })

  if (connection.watch_channel_id && connection.watch_resource_id) {
    await dependencies
      .stopWatch({
        accessToken,
        channelId: connection.watch_channel_id,
        resourceId: connection.watch_resource_id,
        fetchImpl,
      })
      .catch(() => undefined)
  }
}
