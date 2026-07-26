import assert from "node:assert/strict"
import test from "node:test"
import { applyExternalCalendarSync } from "./external-calendar-store.ts"

function clientReturning(result) {
  const calls = []
  return {
    calls,
    rpc(name, args) {
      calls.push({ name, args })
      return Promise.resolve(result)
    },
  }
}

const event = {
  externalEventId: "provider-event-1",
  title: "Read-only meeting",
  startsAt: "2026-07-26T10:00:00.000Z",
  endsAt: "2026-07-26T11:00:00.000Z",
  allDay: false,
  location: null,
  description: "Agenda",
  etag: '"etag-1"',
  updatedAt: "2026-07-26T09:00:00.000Z",
  cancelled: false,
}

test("external event application delegates one atomic owner-scoped RPC", async () => {
  const client = clientReturning({ data: 1, error: null })

  const count = await applyExternalCalendarSync(client, {
    ownerId: "owner-1",
    connectionId: "connection-1",
    events: [event],
    replace: true,
  })

  assert.equal(count, 1)
  assert.deepEqual(client.calls, [
    {
      name: "apply_external_calendar_sync",
      args: {
        p_owner_id: "owner-1",
        p_connection_id: "connection-1",
        p_events: [
          {
            external_event_id: "provider-event-1",
            title: "Read-only meeting",
            starts_at: "2026-07-26T10:00:00.000Z",
            ends_at: "2026-07-26T11:00:00.000Z",
            all_day: false,
            location: null,
            description: "Agenda",
            etag: '"etag-1"',
            external_updated_at: "2026-07-26T09:00:00.000Z",
            cancelled: false,
          },
        ],
        p_replace: true,
      },
    },
  ])
})

test("duplicates and malformed external events fail before the database", async () => {
  const client = clientReturning({ data: 0, error: null })

  await assert.rejects(
    applyExternalCalendarSync(client, {
      ownerId: "owner-1",
      connectionId: "connection-1",
      events: [event, event],
      replace: false,
    }),
    /duplicate/i,
  )
  await assert.rejects(
    applyExternalCalendarSync(client, {
      ownerId: "owner-1",
      connectionId: "connection-1",
      events: [{ ...event, endsAt: event.startsAt }],
      replace: false,
    }),
    /end after/i,
  )
  assert.equal(client.calls.length, 0)
})

test("database errors and malformed counts remain observable", async () => {
  await assert.rejects(
    applyExternalCalendarSync(
      clientReturning({ data: null, error: new Error("write failed") }),
      {
        ownerId: "owner-1",
        connectionId: "connection-1",
        events: [],
        replace: false,
      },
    ),
    /write failed/,
  )
  await assert.rejects(
    applyExternalCalendarSync(
      clientReturning({ data: "one", error: null }),
      {
        ownerId: "owner-1",
        connectionId: "connection-1",
        events: [],
        replace: false,
      },
    ),
    /invalid sync count/,
  )
})
