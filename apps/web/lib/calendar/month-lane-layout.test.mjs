import assert from "node:assert/strict"
import test from "node:test"
import { layoutMonthItems } from "./month-lane-layout.ts"
import { eventToMonthItem, taskDueToMonthItem } from "./month-items.ts"

/** Sunday-first grid of `count` days starting at local midnight on `startKey`. */
function grid(startKey, count = 42) {
  const [year, month, day] = startKey.split("-").map(Number)
  const start = new Date(year, month - 1, day)
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

/** All-day bar occupying [startDay, endDay] inclusive, stored exclusive-end. */
function bar(id, startDay, endDayExclusive, overrides = {}) {
  return eventToMonthItem(
    {
      id,
      calendar_id: "cal-1",
      user_id: "user-1",
      title: id,
      starts_at: new Date(2026, 6, startDay).toISOString(),
      ends_at: new Date(2026, 6, endDayExclusive).toISOString(),
      all_day: true,
      location: null,
      description_json: {},
      task_id: null,
      google_event_id: null,
      source: "planevo",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
      ...overrides,
    },
    "ocean",
  )
}

function timed(id, day, hour) {
  return eventToMonthItem(
    {
      id,
      calendar_id: "cal-1",
      user_id: "user-1",
      title: id,
      starts_at: new Date(2026, 6, day, hour).toISOString(),
      ends_at: new Date(2026, 6, day, hour + 1).toISOString(),
      all_day: false,
      location: null,
      description_json: {},
      task_id: null,
      google_event_id: null,
      source: "planevo",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    },
    "ocean",
  )
}

// June 28 2026 is a Sunday, so this grid covers July 2026 in six rows.
const JULY_GRID = grid("2026-06-28")

test("places a single-week bar with correct span and no continuation", () => {
  // Arrange — July 1-3, which sits inside grid row 0 (Jun 28 - Jul 4).
  const items = [bar("bar-a", 1, 4)]

  // Act
  const { bars, laneCountByWeek } = layoutMonthItems(items, JULY_GRID)

  // Assert
  assert.equal(bars.length, 1)
  assert.equal(bars[0].lane, 0)
  assert.equal(bars[0].weekIndex, 0)
  assert.equal(bars[0].columnStart, 3) // Wednesday July 1
  assert.equal(bars[0].columnSpan, 3) // July 1, 2, 3
  assert.equal(bars[0].isContinuedFromPrevWeek, false)
  assert.equal(bars[0].isContinuedIntoNextWeek, false)
  assert.equal(laneCountByWeek[0], 1)
})

test("gives overlapping bars distinct lanes and reuses a freed lane", () => {
  // Arrange — a and b overlap; c starts after a ends, so it may reuse lane 0.
  const items = [bar("a", 1, 4), bar("b", 2, 5), bar("c", 6, 8)]

  // Act
  const { bars } = layoutMonthItems(items, JULY_GRID)
  const laneOf = (id) => bars.find((segment) => segment.itemId === `event:${id}`).lane

  // Assert
  assert.equal(laneOf("a"), 0)
  assert.equal(laneOf("b"), 1)
  assert.equal(laneOf("c"), 0)
})

test("splits a bar at the week boundary and keeps one lane across both rows", () => {
  // Arrange — July 3 (Fri, row 0) through July 7 (Tue, row 1).
  const items = [bar("crossing", 3, 8)]

  // Act
  const { bars, laneCountByWeek } = layoutMonthItems(items, JULY_GRID)

  // Assert
  assert.equal(bars.length, 2)
  const [first, second] = bars
  assert.equal(first.weekIndex, 0)
  assert.equal(first.columnStart, 5) // Friday
  assert.equal(first.columnSpan, 2) // Fri, Sat
  assert.equal(first.isContinuedFromPrevWeek, false)
  assert.equal(first.isContinuedIntoNextWeek, true)

  assert.equal(second.weekIndex, 1)
  assert.equal(second.columnStart, 0) // Sunday
  assert.equal(second.columnSpan, 3) // Sun, Mon, Tue
  assert.equal(second.isContinuedFromPrevWeek, true)
  assert.equal(second.isContinuedIntoNextWeek, false)

  assert.equal(first.lane, second.lane)
  assert.equal(laneCountByWeek[0], 1)
  assert.equal(laneCountByWeek[1], 1)
})

test("honours caller order instead of re-sorting longer bars first", () => {
  // Arrange — a short bar listed first. react-big-calendar re-partitioned by
  // span before any caller comparator ran, which is why this rebuild exists.
  const items = [bar("short", 1, 3), bar("long", 1, 9)]

  // Act
  const { bars } = layoutMonthItems(items, JULY_GRID)
  const laneOf = (id) => bars.find((segment) => segment.itemId === `event:${id}`).lane

  // Assert
  assert.equal(laneOf("short"), 0)
  assert.equal(laneOf("long"), 1)
})

test("treats an all-day end of midnight as exclusive", () => {
  // Arrange — July 1 through midnight on July 4 is a three-day event.
  const items = [bar("three-day", 1, 4)]

  // Act
  const { bars } = layoutMonthItems(items, JULY_GRID)

  // Assert — spans July 1-3 only, never touching July 4.
  assert.equal(bars[0].columnSpan, 3)
})

test("marks a bar starting before the grid as continued from the previous week", () => {
  // Arrange — June 25 through June 30, starting two days before the grid.
  const items = [
    bar("early", 0, 0, {
      starts_at: new Date(2026, 5, 25).toISOString(),
      ends_at: new Date(2026, 5, 30).toISOString(),
    }),
  ]

  // Act
  const { bars } = layoutMonthItems(items, JULY_GRID)

  // Assert — clipped to the grid's first column but still reads as continuing.
  assert.equal(bars[0].columnStart, 0)
  assert.equal(bars[0].isContinuedFromPrevWeek, true)
})

test("reports zero lanes for weeks without bars", () => {
  // Arrange
  const items = [bar("only-week-zero", 1, 3)]

  // Act
  const { laneCountByWeek } = layoutMonthItems(items, JULY_GRID)

  // Assert
  assert.equal(laneCountByWeek.length, 6)
  assert.equal(laneCountByWeek[0], 1)
  assert.deepEqual(laneCountByWeek.slice(1), [0, 0, 0, 0, 0])
})

test("buckets timed events and task dues by day in caller order", () => {
  // Arrange
  const items = [
    timed("morning", 14, 9),
    timed("evening", 14, 18),
    taskDueToMonthItem({
      taskId: "task-1",
      title: "Ship it",
      dueAt: new Date(2026, 6, 15, 12).toISOString(),
      status: "todo",
    }),
  ]

  // Act
  const { singlesByDay, bars } = layoutMonthItems(items, JULY_GRID)

  // Assert
  assert.equal(bars.length, 0)
  assert.deepEqual(
    singlesByDay.get("2026-07-14").map((item) => item.title),
    ["morning", "evening"],
  )
  assert.equal(singlesByDay.get("2026-07-15").length, 1)
})

test("drops items that fall outside the rendered grid", () => {
  // Arrange — a five-row grid ending July 25; the event lands in August.
  const fiveWeeks = grid("2026-06-28", 35)
  const items = [timed("august", 40, 9), bar("august-bar", 40, 43)]

  // Act
  const { bars, singlesByDay } = layoutMonthItems(items, fiveWeeks)

  // Assert
  assert.equal(bars.length, 0)
  assert.equal(singlesByDay.size, 0)
})

test("returns an empty layout for an empty grid", () => {
  // Arrange / Act
  const layout = layoutMonthItems([bar("a", 1, 3)], [])

  // Assert
  assert.deepEqual(layout.bars, [])
  assert.deepEqual(layout.laneCountByWeek, [])
  assert.equal(layout.singlesByDay.size, 0)
})
