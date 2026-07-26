import assert from "node:assert/strict"
import test from "node:test"
import { sealCalendarToken } from "./calendar-token-crypto.ts"
import { GoogleSyncTokenExpiredError } from "./google-calendar-api.ts"
import { syncGoogleConnection } from "./google-calendar-sync.ts"

const KEY = Buffer.alloc(32, 7).toString("base64")

function connection(overrides = {}) {
  return {
    id: "connection-1",
    user_id: "owner-1",
    calendar_id: "calendar-1",
    account_id: "account-1",
    provider: "google",
    provider_calendar_id: "primary",
    feed_url: null,
    feed_etag: null,
    feed_last_modified: null,
    sync_token: "expired-token",
    sync_window_end: "2028-07-26T12:00:00.000Z",
    watch_channel_id: null,
    watch_resource_id: null,
    watch_token: null,
    watch_expires_at: null,
    last_synced_at: null,
    last_attempted_at: null,
    next_retry_at: "-infinity",
    consecutive_failure_count: 0,
    last_sync_error: null,
    is_enabled: true,
    metadata_json: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function clientFixture() {
  const updates = []
  const fallbackBatches = []
  const account = {
    id: "account-1",
    user_id: "owner-1",
    provider: "google",
    provider_account_id: "google-user",
    display_name: "owner@example.test",
    access_token_ciphertext: sealCalendarToken("access-token", KEY),
    refresh_token_ciphertext: sealCalendarToken("refresh-token", KEY),
    token_expires_at: "2027-01-01T00:00:00.000Z",
    scopes: [],
    revoked_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  }
  const client = {
    from(table) {
      if (table === "calendar_accounts") {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return { maybeSingle: async () => ({ data: account, error: null }) }
                  },
                }
              },
            }
          },
        }
      }
      if (table === "calendar_connections") {
        return {
          update(value) {
            updates.push(value)
            return {
              eq() {
                return { eq: async () => ({ error: null }) }
              },
            }
          },
        }
      }
      if (table === "calendar_events") {
        return {
          select() {
            return {
              eq() {
                return {
                  in: async (_column, ids) => {
                    fallbackBatches.push(ids)
                    return {
                      data: ids.map((id) => ({
                        external_event_id: id,
                        starts_at: "2026-07-26T09:00:00.000Z",
                        ends_at: "2026-07-26T10:00:00.000Z",
                        all_day: false,
                      })),
                      error: null,
                    }
                  },
                }
              },
            }
          },
        }
      }
      throw new Error(`Unexpected table ${table}`)
    },
  }
  return { client, updates, fallbackBatches }
}

test("an expired sync token triggers one full replacement and saves the new token", async () => {
  // Arrange
  process.env.CALENDAR_TOKEN_ENCRYPTION_KEY = KEY
  const { client, updates } = clientFixture()
  const calls = []
  let applied = null
  const dependencies = {
    listEventsPage: async (input) => {
      calls.push(input)
      if (input.syncToken) throw new GoogleSyncTokenExpiredError()
      return {
        items: [
          {
            id: "event-1",
            summary: "Review",
            start: { dateTime: "2026-07-26T09:00:00Z" },
            end: { dateTime: "2026-07-26T10:00:00Z" },
          },
        ],
        nextPageToken: null,
        nextSyncToken: "next-token",
      }
    },
    refreshAccessToken: async () => {
      throw new Error("refresh should not run")
    },
    applyEvents: async (_client, input) => {
      applied = input
      return 1
    },
    createWatch: async () => {
      throw new Error("watch should not run")
    },
    stopWatch: async () => {},
  }

  // Act
  const result = await syncGoogleConnection(client, connection(), {
    now: new Date("2026-07-26T12:00:00.000Z"),
    dependencies,
  })

  // Assert
  assert.deepEqual(result, { eventCount: 1, fullSync: true })
  assert.equal(calls.length, 2)
  assert.equal(calls[0].syncToken, "expired-token")
  assert.equal(calls[1].syncToken, null)
  assert.equal(calls[1].initialTimeMin, "2025-07-26T12:00:00.000Z")
  assert.equal(calls[1].initialTimeMax, "2028-07-26T12:00:00.000Z")
  assert.equal(applied.replace, true)
  assert.equal(updates.at(-1).sync_token, "next-token")
  assert.equal(updates.at(-1).sync_window_end, "2028-07-26T12:00:00.000Z")
})

test("cancelled-event fallbacks are loaded in bounded query batches", async () => {
  process.env.CALENDAR_TOKEN_ENCRYPTION_KEY = KEY
  const { client, fallbackBatches } = clientFixture()
  const cancelledEvents = Array.from({ length: 201 }, (_, index) => ({
    id: `event-${index}`,
    status: "cancelled",
  }))
  let applied = null
  const dependencies = {
    listEventsPage: async () => ({
      items: cancelledEvents,
      nextPageToken: null,
      nextSyncToken: "next-token",
    }),
    refreshAccessToken: async () => {
      throw new Error("refresh should not run")
    },
    applyEvents: async (_client, input) => {
      applied = input
      return input.events.length
    },
    createWatch: async () => {
      throw new Error("watch should not run")
    },
    stopWatch: async () => {},
  }

  const result = await syncGoogleConnection(client, connection(), {
    now: new Date("2026-07-26T12:00:00.000Z"),
    dependencies,
  })

  assert.deepEqual(fallbackBatches.map((batch) => batch.length), [100, 100, 1])
  assert.equal(applied.events.length, 201)
  assert.equal(applied.events.every((event) => event.cancelled), true)
  assert.deepEqual(result, { eventCount: 201, fullSync: false })
})

test("cancelled events with empty time objects use their persisted range", async () => {
  process.env.CALENDAR_TOKEN_ENCRYPTION_KEY = KEY
  const { client, fallbackBatches } = clientFixture()
  let applied = null
  const dependencies = {
    listEventsPage: async () => ({
      items: [
        {
          id: "cancelled-with-empty-times",
          status: "cancelled",
          start: {},
          end: {},
        },
      ],
      nextPageToken: null,
      nextSyncToken: "next-token",
    }),
    refreshAccessToken: async () => {
      throw new Error("refresh should not run")
    },
    applyEvents: async (_client, input) => {
      applied = input
      return input.events.length
    },
    createWatch: async () => {
      throw new Error("watch should not run")
    },
    stopWatch: async () => {},
  }

  const result = await syncGoogleConnection(client, connection(), {
    now: new Date("2026-07-26T12:00:00.000Z"),
    dependencies,
  })

  assert.deepEqual(fallbackBatches, [["cancelled-with-empty-times"]])
  assert.equal(applied.events.length, 1)
  assert.equal(applied.events[0].cancelled, true)
  assert.deepEqual(result, { eventCount: 1, fullSync: false })
})

test("repeated Google event page tokens fail instead of looping", async () => {
  process.env.CALENDAR_TOKEN_ENCRYPTION_KEY = KEY
  const { client } = clientFixture()
  let calls = 0
  const dependencies = {
    listEventsPage: async () => {
      calls += 1
      return {
        items: [],
        nextPageToken: "repeated",
        nextSyncToken: null,
      }
    },
    refreshAccessToken: async () => {
      throw new Error("refresh should not run")
    },
    applyEvents: async () => {
      throw new Error("events should not be applied")
    },
    createWatch: async () => {
      throw new Error("watch should not run")
    },
    stopWatch: async () => {},
  }

  await assert.rejects(
    syncGoogleConnection(client, connection(), {
      now: new Date("2026-07-26T12:00:00.000Z"),
      dependencies,
    }),
    /repeated an event-list page token/,
  )
  assert.equal(calls, 2)
})

test("a closing sync horizon triggers a bounded full rebaseline", async () => {
  process.env.CALENDAR_TOKEN_ENCRYPTION_KEY = KEY
  const { client } = clientFixture()
  const calls = []
  let applied = null
  const dependencies = {
    listEventsPage: async (input) => {
      calls.push(input)
      return {
        items: [],
        nextPageToken: null,
        nextSyncToken: "rebased-token",
      }
    },
    refreshAccessToken: async () => {
      throw new Error("refresh should not run")
    },
    applyEvents: async (_client, input) => {
      applied = input
      return 0
    },
    createWatch: async () => {
      throw new Error("watch should not run")
    },
    stopWatch: async () => {},
  }

  const result = await syncGoogleConnection(
    client,
    connection({ sync_window_end: "2027-01-01T00:00:00.000Z" }),
    {
      now: new Date("2026-07-26T12:00:00.000Z"),
      dependencies,
    },
  )

  assert.equal(calls[0].syncToken, null)
  assert.equal(calls[0].initialTimeMax, "2028-07-26T12:00:00.000Z")
  assert.equal(applied.replace, true)
  assert.deepEqual(result, { eventCount: 0, fullSync: true })
})
