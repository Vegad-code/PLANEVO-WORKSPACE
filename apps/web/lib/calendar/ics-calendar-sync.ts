import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@planevo/core/types/database.types"
import { applyExternalCalendarSync } from "./external-calendar-store.ts"
import { parseIcsCalendar } from "./ics-calendar.ts"
import { fetchPublicCalendarFeed } from "./public-calendar-feed.ts"
import {
  calendarTokenEncryptionKey,
  openCalendarToken,
} from "./calendar-token-crypto.ts"

export type IcsCalendarConnection =
  Database["public"]["Tables"]["calendar_connections"]["Row"]

type IcsSyncDependencies = {
  fetchFeed: typeof fetchPublicCalendarFeed
  parseFeed: typeof parseIcsCalendar
  applyEvents: typeof applyExternalCalendarSync
}

const defaultDependencies: IcsSyncDependencies = {
  fetchFeed: fetchPublicCalendarFeed,
  parseFeed: parseIcsCalendar,
  applyEvents: applyExternalCalendarSync,
}

const MAX_SYNC_RETRY_DELAY_MS = 6 * 60 * 60 * 1_000

function nextSyncRetryAt(now: Date, priorFailures: number): string {
  const failureCount = Math.max(1, priorFailures + 1)
  const delay = Math.min(
    MAX_SYNC_RETRY_DELAY_MS,
    5 * 60_000 * 2 ** Math.min(failureCount - 1, 6),
  )
  return new Date(now.getTime() + delay).toISOString()
}

export function externalCalendarWindow(now: Date): {
  windowStart: Date
  windowEnd: Date
} {
  if (!Number.isFinite(now.getTime())) {
    throw new TypeError("External calendar sync needs a valid clock.")
  }
  const windowStart = new Date(now)
  const windowEnd = new Date(now)
  windowStart.setUTCFullYear(windowStart.getUTCFullYear() - 1)
  windowEnd.setUTCFullYear(windowEnd.getUTCFullYear() + 2)
  return { windowStart, windowEnd }
}

async function recordIcsSyncFailure(
  client: SupabaseClient<Database>,
  connection: IcsCalendarConnection,
  cause: unknown,
  now: Date,
): Promise<void> {
  const message =
    cause instanceof Error ? cause.message.slice(0, 1_000) : "Calendar sync failed."
  const priorFailures = connection.consecutive_failure_count ?? 0
  await client
    .from("calendar_connections")
    .update({
      last_sync_error: message,
      last_attempted_at: now.toISOString(),
      next_retry_at: nextSyncRetryAt(now, priorFailures),
      consecutive_failure_count: priorFailures + 1,
      updated_at: now.toISOString(),
    })
    .eq("id", connection.id)
    .eq("user_id", connection.user_id)
}

/** Pulls one owner-scoped ICS source and atomically replaces its rolling window. */
export async function syncIcsConnection(
  client: SupabaseClient<Database>,
  connection: IcsCalendarConnection,
  {
    now = new Date(),
    dependencies = defaultDependencies,
  }: {
    now?: Date
    dependencies?: IcsSyncDependencies
  } = {},
): Promise<{ status: "updated" | "not-modified"; eventCount: number }> {
  if (connection.provider !== "ics" || !connection.feed_url) {
    throw new TypeError("ICS sync needs an ICS connection with a feed URL.")
  }

  try {
    const feedUrl = connection.feed_url.startsWith("v1.")
      ? openCalendarToken(
          connection.feed_url,
          calendarTokenEncryptionKey(),
        )
      : connection.feed_url
    const response = await dependencies.fetchFeed({
      feedUrl,
      etag: connection.feed_etag,
      lastModified: connection.feed_last_modified,
    })
    if (response.status === "not-modified") {
      const { error } = await client
        .from("calendar_connections")
        .update({
          last_synced_at: now.toISOString(),
          last_attempted_at: now.toISOString(),
          next_retry_at: "-infinity",
          consecutive_failure_count: 0,
          last_sync_error: null,
          updated_at: now.toISOString(),
        })
        .eq("id", connection.id)
        .eq("user_id", connection.user_id)
      if (error) throw error
      return { status: "not-modified", eventCount: 0 }
    }

    const events = dependencies.parseFeed(
      response.body,
      externalCalendarWindow(now),
    )
    const eventCount = await dependencies.applyEvents(client, {
      ownerId: connection.user_id,
      connectionId: connection.id,
      events,
      replace: true,
    })
    const { error } = await client
      .from("calendar_connections")
      .update({
        feed_etag: response.etag,
        feed_last_modified: response.lastModified,
        last_synced_at: now.toISOString(),
        last_attempted_at: now.toISOString(),
        next_retry_at: "-infinity",
        consecutive_failure_count: 0,
        last_sync_error: null,
        updated_at: now.toISOString(),
      })
      .eq("id", connection.id)
      .eq("user_id", connection.user_id)
    if (error) throw error
    return { status: "updated", eventCount }
  } catch (cause) {
    await recordIcsSyncFailure(client, connection, cause, now)
    throw cause
  }
}
