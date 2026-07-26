import {
  renewGoogleCalendarWatch,
  syncGoogleConnection,
} from "@/lib/calendar/google-calendar-sync"
import { syncIcsConnection } from "@/lib/calendar/ics-calendar-sync"
import { createAdminClient } from "@/utils/supabase/admin"

export const maxDuration = 300

const SYNC_CONCURRENCY = 4
const RUN_BUDGET_MS = 240_000

function nextRetryAt(now: Date, priorFailures: number): string {
  const delay = Math.min(
    6 * 60 * 60 * 1_000,
    5 * 60_000 * 2 ** Math.min(Math.max(0, priorFailures), 6),
  )
  return new Date(now.getTime() + delay).toISOString()
}

function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  return Boolean(
    secret && request.headers.get("authorization") === `Bearer ${secret}`,
  )
}

async function runWithConcurrency<T>({
  items,
  worker,
  deadline,
}: {
  items: T[]
  worker: (item: T) => Promise<void>
  deadline: number
}): Promise<void> {
  let nextIndex = 0
  async function consume(): Promise<void> {
    while (Date.now() < deadline) {
      const index = nextIndex
      nextIndex += 1
      const item = items[index]
      if (item === undefined) return
      await worker(item)
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(SYNC_CONCURRENCY, items.length) },
      () => consume(),
    ),
  )
}

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return Response.json({ ok: false }, { status: 401 })
  }

  const client = createAdminClient()
  const now = new Date()
  const deadline = Date.now() + RUN_BUDGET_MS
  const nowIso = now.toISOString()
  const syncBefore = new Date(now.getTime() - 60 * 60 * 1_000).toISOString()
  const watchBefore = new Date(
    now.getTime() + 2 * 24 * 60 * 60 * 1_000,
  ).toISOString()
  const [{ data: dueSync, error: syncError }, { data: dueWatch, error: watchError }] =
    await Promise.all([
      client
        .from("calendar_connections")
        .select("*")
        .eq("is_enabled", true)
        .or(`last_synced_at.is.null,last_synced_at.lt.${syncBefore}`)
        .lte("next_retry_at", nowIso)
        .order("last_attempted_at", { ascending: true, nullsFirst: true })
        .limit(100),
      client
        .from("calendar_connections")
        .select("*")
        .eq("provider", "google")
        .eq("is_enabled", true)
        .or(`watch_expires_at.is.null,watch_expires_at.lt.${watchBefore}`)
        .lte("next_retry_at", nowIso)
        .order("last_attempted_at", { ascending: true, nullsFirst: true })
        .limit(100),
    ])
  if (syncError) throw syncError
  if (watchError) throw watchError

  let synced = 0
  let renewed = 0
  let failed = 0

  // Renew watches first so a large sync backlog cannot let push channels lapse.
  await runWithConcurrency({
    items: dueWatch ?? [],
    deadline,
    worker: async (connection) => {
      try {
        await renewGoogleCalendarWatch(client, connection, { now })
        renewed += 1
      } catch (cause) {
        failed += 1
        console.error(`[calendar-watch-renewal:${connection.id}]`, cause)
        const priorFailures = connection.consecutive_failure_count ?? 0
        const message =
          cause instanceof Error
            ? cause.message.slice(0, 1_000)
            : "Google watch renewal failed."
        await client
          .from("calendar_connections")
          .update({
            last_sync_error: message,
            last_attempted_at: nowIso,
            next_retry_at: nextRetryAt(now, priorFailures),
            consecutive_failure_count: priorFailures + 1,
            updated_at: nowIso,
          })
          .eq("id", connection.id)
          .eq("user_id", connection.user_id)
      }
    },
  })

  await runWithConcurrency({
    items: dueSync ?? [],
    deadline,
    worker: async (connection) => {
      try {
        if (connection.provider === "ics") {
          await syncIcsConnection(client, connection, { now })
        } else {
          await syncGoogleConnection(client, connection, { now })
        }
        synced += 1
      } catch (cause) {
        failed += 1
        console.error(`[calendar-sync:${connection.id}]`, cause)
      }
    },
  })

  return Response.json({ ok: failed === 0, synced, renewed, failed })
}
