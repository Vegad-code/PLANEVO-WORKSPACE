import assert from "node:assert/strict"
import { test } from "node:test"
import {
  readCalendarSkeletonEvents,
  rememberCalendarSkeletonEvents,
  resolveCalendarSkeletonEvents,
  sanitizeCalendarSkeletonEvents,
  skeletonEventsFromDisplay,
  skeletonRangeKey,
} from "./calendar-skeleton-event-memory.ts"

const memory = new Map()

function installSessionStorage() {
  memory.clear()
  globalThis.sessionStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, String(value))
    },
    removeItem: (key) => {
      memory.delete(key)
    },
  }
  globalThis.window = globalThis
}

test("remembered skeleton events round-trip for the same view and day", () => {
  installSessionStorage()

  rememberCalendarSkeletonEvents({
    view: "week",
    anchor: new Date(2026, 6, 29),
    events: [
      {
        id: "evt-1",
        starts_at: "2026-07-29T15:00:00.000Z",
        ends_at: "2026-07-29T16:00:00.000Z",
        all_day: false,
      },
    ],
  })

  const same = readCalendarSkeletonEvents({
    view: "week",
    anchor: new Date(2026, 6, 29),
  })
  assert.equal(same.length, 1)
  assert.equal(same[0]?.id, "evt-1")

  const otherDay = readCalendarSkeletonEvents({
    view: "week",
    anchor: new Date(2026, 7, 5),
  })
  assert.equal(otherDay.length, 0)
})

test("week skeleton memory matches another day in the same week", () => {
  installSessionStorage()
  rememberCalendarSkeletonEvents({
    view: "week",
    anchor: new Date(2026, 6, 29),
    events: [
      {
        id: "evt-1",
        starts_at: "2026-07-29T15:00:00.000Z",
        ends_at: "2026-07-29T16:00:00.000Z",
        all_day: false,
      },
    ],
  })

  const sameWeek = readCalendarSkeletonEvents({
    view: "week",
    anchor: new Date(2026, 6, 31), // Thu in same Sun-start week as Jul 29
  })
  assert.equal(sameWeek.length, 1)
})

test("month skeleton memory matches another day in the same month grid", () => {
  installSessionStorage()
  rememberCalendarSkeletonEvents({
    view: "month",
    anchor: new Date(2026, 6, 2),
    events: [
      {
        id: "evt-month",
        starts_at: "2026-07-10T10:00:00",
        ends_at: "2026-07-10T11:00:00",
        all_day: false,
      },
    ],
  })

  const sameMonth = readCalendarSkeletonEvents({
    view: "month",
    anchor: new Date(2026, 6, 28),
  })
  assert.equal(sameMonth.length, 1)

  const otherMonth = readCalendarSkeletonEvents({
    view: "month",
    anchor: new Date(2026, 7, 1),
  })
  assert.equal(otherMonth.length, 0)
})

test("view mismatch returns no remembered skeleton events", () => {
  installSessionStorage()
  rememberCalendarSkeletonEvents({
    view: "week",
    anchor: new Date(2026, 6, 29),
    events: [
      {
        id: "evt-1",
        starts_at: "2026-07-29T15:00:00.000Z",
        ends_at: "2026-07-29T16:00:00.000Z",
        all_day: false,
      },
    ],
  })

  const monthView = readCalendarSkeletonEvents({
    view: "month",
    anchor: new Date(2026, 6, 29),
  })
  assert.equal(monthView.length, 0)
})

test("multi-range memory keeps both weeks after navigating", () => {
  installSessionStorage()
  rememberCalendarSkeletonEvents({
    view: "week",
    anchor: new Date(2026, 6, 29),
    events: [
      {
        id: "week-a",
        starts_at: "2026-07-29T15:00:00",
        ends_at: "2026-07-29T16:00:00",
        all_day: false,
      },
    ],
  })
  rememberCalendarSkeletonEvents({
    view: "week",
    anchor: new Date(2026, 7, 5),
    events: [
      {
        id: "week-b",
        starts_at: "2026-08-05T10:00:00",
        ends_at: "2026-08-05T11:00:00",
        all_day: false,
      },
    ],
  })

  assert.equal(
    readCalendarSkeletonEvents({
      view: "week",
      anchor: new Date(2026, 6, 29),
    })[0]?.id,
    "week-a",
  )
  assert.equal(
    readCalendarSkeletonEvents({
      view: "week",
      anchor: new Date(2026, 7, 5),
    })[0]?.id,
    "week-b",
  )
})

test("remembering an empty settled range clears stale ghosts for that range", () => {
  installSessionStorage()
  rememberCalendarSkeletonEvents({
    view: "week",
    anchor: new Date(2026, 6, 29),
    events: [
      {
        id: "ghost",
        starts_at: "2026-07-29T15:00:00",
        ends_at: "2026-07-29T16:00:00",
        all_day: false,
      },
    ],
  })
  rememberCalendarSkeletonEvents({
    view: "week",
    anchor: new Date(2026, 6, 29),
    events: [],
  })
  assert.deepEqual(
    readCalendarSkeletonEvents({
      view: "week",
      anchor: new Date(2026, 6, 29),
    }),
    [],
  )
})

test("sanitize drops malformed and NaN-dated skeleton events", () => {
  const cleaned = sanitizeCalendarSkeletonEvents([
    {
      id: "ok",
      starts_at: "2026-07-29T15:00:00",
      ends_at: "2026-07-29T16:00:00",
      all_day: false,
    },
    {
      id: "bad-date",
      starts_at: "not-a-date",
      ends_at: "2026-07-29T16:00:00",
      all_day: false,
    },
    {
      id: 12,
      starts_at: "2026-07-29T15:00:00",
      ends_at: "2026-07-29T16:00:00",
      all_day: false,
    },
  ])
  assert.equal(cleaned.length, 1)
  assert.equal(cleaned[0]?.id, "ok")
})

test("sanitize preserves provider source for all-day geometry", () => {
  const cleaned = sanitizeCalendarSkeletonEvents([
    {
      id: "gcal",
      starts_at: "2026-07-27T00:00:00.000Z",
      ends_at: "2026-07-28T00:00:00.000Z",
      all_day: true,
      source: "google",
    },
  ])
  assert.equal(cleaned.length, 1)
  assert.equal(cleaned[0]?.source, "google")
})

test("resolve prefers live events over remembered range", () => {
  installSessionStorage()
  rememberCalendarSkeletonEvents({
    view: "week",
    anchor: new Date(2026, 6, 29),
    events: [
      {
        id: "remembered",
        starts_at: "2026-07-29T15:00:00",
        ends_at: "2026-07-29T16:00:00",
        all_day: false,
      },
    ],
  })

  const resolved = resolveCalendarSkeletonEvents({
    view: "week",
    anchor: new Date(2026, 6, 29),
    liveEvents: [
      {
        id: "live",
        starts_at: "2026-07-29T09:00:00",
        ends_at: "2026-07-29T10:00:00",
        all_day: false,
      },
    ],
  })
  assert.equal(resolved.length, 1)
  assert.equal(resolved[0]?.id, "live")
})

test("resolve falls back to memory when live list is empty", () => {
  installSessionStorage()
  rememberCalendarSkeletonEvents({
    view: "day",
    anchor: new Date(2026, 6, 29),
    events: [
      {
        id: "remembered",
        starts_at: "2026-07-29T15:00:00",
        ends_at: "2026-07-29T16:00:00",
        all_day: false,
      },
    ],
  })

  const resolved = resolveCalendarSkeletonEvents({
    view: "day",
    anchor: new Date(2026, 6, 29),
    liveEvents: [],
  })
  assert.equal(resolved[0]?.id, "remembered")
})

test("skeletonEventsFromDisplay maps title and calendar color", () => {
  const mapped = skeletonEventsFromDisplay({
    events: [
      {
        id: "evt-1",
        calendar_id: "cal-work",
        title: "Standup",
        starts_at: "2026-07-29T15:00:00",
        ends_at: "2026-07-29T15:30:00",
        all_day: false,
        source: "planevo",
        color: null,
      },
    ],
    calendars: [{ id: "cal-work", color: "blueberry" }],
  })
  assert.equal(mapped.length, 1)
  assert.equal(mapped[0]?.title, "Standup")
  assert.equal(mapped[0]?.color, "blueberry")
})

test("skeletonRangeKey matches calendar visible bounds", () => {
  const week = skeletonRangeKey({
    view: "week",
    anchor: new Date(2026, 6, 29),
  })
  assert.equal(week.rangeStart, "2026-07-26")
  assert.equal(week.rangeEnd, "2026-08-02")

  const day = skeletonRangeKey({
    view: "day",
    anchor: new Date(2026, 6, 29),
  })
  assert.equal(day.rangeStart, "2026-07-29")
  assert.equal(day.rangeEnd, "2026-07-30")
})
