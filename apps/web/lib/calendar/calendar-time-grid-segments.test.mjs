import assert from "node:assert/strict"
import { test } from "node:test"
import {
  allDaySpanForEvent,
  timedSegmentsForEvent,
  timeGridColumns,
} from "./calendar-time-grid-segments.ts"

test("week columns cover seven local days from Sunday", () => {
  const columns = timeGridColumns({
    view: "week",
    anchor: new Date(2026, 6, 29),
  })
  assert.equal(columns.length, 7)
  assert.equal(columns[3]?.index, 3)
})

test("timed segments split at midnight across columns", () => {
  const columns = timeGridColumns({
    view: "week",
    anchor: new Date(2026, 6, 26),
  })
  const segments = timedSegmentsForEvent({
    eventId: "late",
    start: new Date(2026, 6, 28, 23, 0),
    end: new Date(2026, 6, 29, 1, 0),
    columns,
  })
  assert.equal(segments.length, 2)
  assert.equal(segments[0]?.column, 2)
  assert.equal(segments[1]?.column, 3)
})

test("all-day span covers inclusive local days", () => {
  const columns = timeGridColumns({
    view: "week",
    anchor: new Date(2026, 6, 26),
  })
  const span = allDaySpanForEvent({
    eventId: "trip",
    start: new Date(2026, 6, 27),
    end: new Date(2026, 6, 30),
    columns,
  })
  assert.deepEqual(span, {
    eventId: "trip",
    columnStart: 1,
    columnEnd: 3,
  })
})
