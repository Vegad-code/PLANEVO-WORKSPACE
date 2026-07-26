import assert from "node:assert/strict"
import test from "node:test"
import { syncIcsConnection } from "./ics-calendar-sync.ts"

function connection(overrides = {}) {
  return {
    id: "connection-1",
    user_id: "owner-1",
    calendar_id: "calendar-1",
    account_id: null,
    provider: "ics",
    provider_calendar_id: null,
    feed_url: "https://calendar.example.test/feed.ics",
    feed_etag: '"old"',
    feed_last_modified: null,
    sync_token: null,
    watch_channel_id: null,
    watch_resource_id: null,
    watch_token: null,
    watch_expires_at: null,
    last_synced_at: null,
    last_sync_error: null,
    is_enabled: true,
    metadata_json: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function updateClient() {
  const updates = []
  const client = {
    from(table) {
      assert.equal(table, "calendar_connections")
      return {
        update(value) {
          updates.push(value)
          return {
            eq() {
              return {
                eq: async () => ({ error: null }),
              }
            },
          }
        },
      }
    },
  }
  return { client, updates }
}

test("an updated feed is parsed in a bounded window and atomically replaced", async () => {
  // Arrange
  const { client, updates } = updateClient()
  const parsedEvents = [{ externalEventId: "event-1" }]
  let applied = null

  // Act
  const result = await syncIcsConnection(client, connection(), {
    now: new Date("2026-07-26T12:00:00.000Z"),
    dependencies: {
      fetchFeed: async () => ({
        status: "updated",
        body: "BEGIN:VCALENDAR",
        etag: '"new"',
        lastModified: "Sun, 26 Jul 2026 12:00:00 GMT",
      }),
      parseFeed: (_source, window) => {
        assert.equal(window.windowStart.toISOString(), "2025-07-26T12:00:00.000Z")
        assert.equal(window.windowEnd.toISOString(), "2028-07-26T12:00:00.000Z")
        return parsedEvents
      },
      applyEvents: async (_client, input) => {
        applied = input
        return 1
      },
    },
  })

  // Assert
  assert.deepEqual(result, { status: "updated", eventCount: 1 })
  assert.equal(applied.replace, true)
  assert.equal(applied.events, parsedEvents)
  assert.equal(updates.at(-1).feed_etag, '"new"')
  assert.equal(updates.at(-1).last_sync_error, null)
})

test("a conditional 304 advances sync health without replacing events", async () => {
  // Arrange
  const { client, updates } = updateClient()
  let applied = false

  // Act
  const result = await syncIcsConnection(client, connection(), {
    now: new Date("2026-07-26T12:00:00.000Z"),
    dependencies: {
      fetchFeed: async () => ({ status: "not-modified" }),
      parseFeed: () => [],
      applyEvents: async () => {
        applied = true
        return 0
      },
    },
  })

  // Assert
  assert.deepEqual(result, { status: "not-modified", eventCount: 0 })
  assert.equal(applied, false)
  assert.equal(updates.at(-1).last_synced_at, "2026-07-26T12:00:00.000Z")
})

test("feed failures are recorded while the original error remains observable", async () => {
  // Arrange
  const { client, updates } = updateClient()

  // Act / Assert
  await assert.rejects(
    syncIcsConnection(client, connection(), {
      dependencies: {
        fetchFeed: async () => {
          throw new Error("Feed denied")
        },
        parseFeed: () => [],
        applyEvents: async () => 0,
      },
    }),
    /Feed denied/,
  )
  assert.equal(updates.at(-1).last_sync_error, "Feed denied")
})
