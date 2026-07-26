import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database, Json } from "@planevo/core/types/database.types"
import type { ExternalCalendarEvent } from "./ics-calendar.ts"

function externalEventPayload(events: ExternalCalendarEvent[]): Json[] {
  if (events.length > 5_000) {
    throw new RangeError("External sync is limited to 5,000 events per pass.")
  }

  const ids = new Set<string>()
  return events.map((event) => {
    const externalEventId = event.externalEventId.trim()
    if (!externalEventId) {
      throw new TypeError("Every external event needs an id.")
    }
    if (ids.has(externalEventId)) {
      throw new RangeError(`Duplicate external event id "${externalEventId}".`)
    }
    ids.add(externalEventId)

    const startsAt = new Date(event.startsAt)
    const endsAt = new Date(event.endsAt)
    if (
      !Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) ||
      endsAt <= startsAt
    ) {
      throw new RangeError(
        `External event "${externalEventId}" must end after it starts.`,
      )
    }

    return {
      external_event_id: externalEventId,
      title: event.title.trim() || "Untitled event",
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      all_day: event.allDay,
      location: event.location,
      description: event.description,
      etag: event.etag,
      external_updated_at: event.updatedAt,
      cancelled: event.cancelled,
    } satisfies Json
  })
}

export async function applyExternalCalendarSync(
  client: SupabaseClient<Database>,
  {
    ownerId,
    connectionId,
    events,
    replace,
  }: {
    ownerId: string
    connectionId: string
    events: ExternalCalendarEvent[]
    replace: boolean
  },
): Promise<number> {
  const { data, error } = await client.rpc("apply_external_calendar_sync", {
    p_owner_id: ownerId,
    p_connection_id: connectionId,
    p_events: externalEventPayload(events),
    p_replace: replace,
  })
  if (error) throw error
  if (typeof data !== "number" || !Number.isInteger(data) || data < 0) {
    throw new Error("Database returned an invalid sync count.")
  }
  return data
}
