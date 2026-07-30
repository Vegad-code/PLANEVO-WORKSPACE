import assert from "node:assert/strict"
import { test } from "node:test"
import { MIN_EVENT_BLOCK_HEIGHT_PERCENT } from "./event-block-position.ts"
import { planCalendarGridSkeletonLayout } from "./calendar-grid-skeleton-layout.ts"

function event({
  id = "evt-1",
  starts,
  ends,
  allDay = false,
}) {
  return {
    id,
    starts_at: starts,
    ends_at: ends,
    all_day: allDay,
  }
}

function emptyLayout() {
  return {
    timed: [],
    allDay: [],
    monthBars: [],
    monthSingles: [],
    monthRowCount: 0,
    laneCountByWeek: [],
  }
}

test("empty events produce no invented skeleton plots", () => {
  const layout = planCalendarGridSkeletonLayout({
    view: "week",
    anchor: new Date(2026, 6, 29),
    events: [],
  })
  assert.deepEqual(layout, emptyLayout())
})

test("week timed skeletons sit on the event's weekday and hour band", () => {
  const layout = planCalendarGridSkeletonLayout({
    view: "week",
    anchor: new Date(2026, 6, 29),
    events: [
      event({
        starts: "2026-07-29T15:00:00",
        ends: "2026-07-29T16:00:00",
      }),
    ],
  })
  assert.equal(layout.timed.length, 1)
  assert.equal(layout.timed[0]?.column, 3)
  assert.ok(
    Math.abs((layout.timed[0]?.topPercent ?? 0) - (15 / 24) * 100) < 0.01,
  )
  assert.ok(
    Math.abs((layout.timed[0]?.heightPercent ?? 0) - (1 / 24) * 100) < 0.01,
  )
  assert.equal(layout.allDay.length, 0)
})

test("day view ignores events on other local days", () => {
  const layout = planCalendarGridSkeletonLayout({
    view: "day",
    anchor: new Date(2026, 6, 29),
    events: [
      event({
        id: "other-day",
        starts: "2026-07-28T10:00:00",
        ends: "2026-07-28T11:00:00",
      }),
      event({
        id: "today",
        starts: "2026-07-29T09:00:00",
        ends: "2026-07-29T09:30:00",
      }),
    ],
  })
  assert.equal(layout.timed.length, 1)
  assert.equal(layout.timed[0]?.key.startsWith("today:"), true)
  assert.equal(layout.timed[0]?.column, 0)
  assert.ok(
    (layout.timed[0]?.heightPercent ?? 0) >= MIN_EVENT_BLOCK_HEIGHT_PERCENT,
  )
})

test("month skeletons land in the grid cell for each event day", () => {
  const layout = planCalendarGridSkeletonLayout({
    view: "month",
    anchor: new Date(2026, 6, 15),
    events: [
      event({
        id: "a",
        starts: "2026-07-01T10:00:00",
        ends: "2026-07-01T11:00:00",
      }),
      event({
        id: "b",
        starts: "2026-07-01T12:00:00",
        ends: "2026-07-01T13:00:00",
      }),
    ],
  })
  assert.equal(layout.monthSingles.length, 2)
  assert.equal(
    layout.monthSingles[0]?.cellIndex,
    layout.monthSingles[1]?.cellIndex,
  )
  assert.equal(layout.monthSingles[0]?.stackIndex, 0)
  assert.equal(layout.monthSingles[1]?.stackIndex, 1)
  assert.ok(layout.monthRowCount >= 5)
})

test("events outside the visible week are omitted", () => {
  const layout = planCalendarGridSkeletonLayout({
    view: "week",
    anchor: new Date(2026, 6, 29),
    events: [
      event({
        id: "next-week",
        starts: "2026-08-05T10:00:00",
        ends: "2026-08-05T11:00:00",
      }),
    ],
  })
  assert.deepEqual(layout, emptyLayout())
})

test("all-day events become all-day skeleton chips, not timed bars", () => {
  const layout = planCalendarGridSkeletonLayout({
    view: "week",
    anchor: new Date(2026, 6, 29),
    events: [
      event({
        starts: "2026-07-29T00:00:00",
        ends: "2026-07-30T00:00:00",
        allDay: true,
      }),
    ],
  })
  assert.equal(layout.timed.length, 0)
  assert.equal(layout.allDay.length, 1)
  assert.equal(layout.allDay[0]?.columnStart, 3)
  assert.equal(layout.allDay[0]?.columnSpan, 1)
})

test("multi-day all-day events span columns in week view", () => {
  const layout = planCalendarGridSkeletonLayout({
    view: "week",
    anchor: new Date(2026, 6, 26),
    events: [
      event({
        id: "trip",
        starts: "2026-07-27T00:00:00",
        ends: "2026-07-30T00:00:00",
        allDay: true,
      }),
    ],
  })
  assert.equal(layout.allDay.length, 1)
  assert.equal(layout.allDay[0]?.columnStart, 1)
  assert.equal(layout.allDay[0]?.columnSpan, 3)
})

test("google all-day events use authored local days in week skeleton", () => {
  const layout = planCalendarGridSkeletonLayout({
    view: "week",
    anchor: new Date(2026, 6, 27),
    events: [
      {
        id: "gcal",
        starts_at: "2026-07-27T00:00:00.000Z",
        ends_at: "2026-07-28T00:00:00.000Z",
        all_day: true,
        source: "google",
      },
    ],
  })
  assert.equal(layout.allDay.length, 1)
  assert.equal(layout.allDay[0]?.columnStart, 1)
  assert.equal(layout.allDay[0]?.columnSpan, 1)
})

test("overlapping timed events get horizontal lanes", () => {
  const layout = planCalendarGridSkeletonLayout({
    view: "day",
    anchor: new Date(2026, 6, 29),
    events: [
      event({
        id: "a",
        starts: "2026-07-29T10:00:00",
        ends: "2026-07-29T11:00:00",
      }),
      event({
        id: "b",
        starts: "2026-07-29T10:30:00",
        ends: "2026-07-29T11:30:00",
      }),
    ],
  })
  assert.equal(layout.timed.length, 2)
  assert.equal(layout.timed[0]?.width, 0.5)
  assert.equal(layout.timed[1]?.width, 0.5)
  assert.notEqual(layout.timed[0]?.left, layout.timed[1]?.left)
})


test("preserves title and color craft fields on timed and month skeletons", () => {
  const week = planCalendarGridSkeletonLayout({
    view: "week",
    anchor: new Date(2026, 6, 29),
    events: [
      {
        id: "craft",
        starts_at: "2026-07-29T15:00:00",
        ends_at: "2026-07-29T16:00:00",
        all_day: false,
        title: "Standup call",
        color: "grape",
      },
    ],
  })
  assert.equal(week.timed[0]?.title, "Standup call")
  assert.equal(week.timed[0]?.color, "grape")

  const month = planCalendarGridSkeletonLayout({
    view: "month",
    anchor: new Date(2026, 6, 15),
    events: [
      {
        id: "chip",
        starts_at: "2026-07-01T10:00:00",
        ends_at: "2026-07-01T11:00:00",
        all_day: false,
        title: "Design review",
        color: "sky",
      },
    ],
  })
  assert.equal(month.monthSingles[0]?.title, "Design review")
  assert.equal(month.monthSingles[0]?.color, "sky")
})
