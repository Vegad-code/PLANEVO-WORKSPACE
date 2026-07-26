import assert from "node:assert/strict"
import test from "node:test"
import {
  eventWindowFromIso,
  rangesIntersect,
} from "./calendar-range-intersect.ts"

test("rangesIntersect detects overlapping windows", () => {
  assert.equal(
    rangesIntersect(
      { start: "2026-07-01", end: "2026-07-08" },
      { start: "2026-07-05", end: "2026-07-12" },
    ),
    true,
  )
})

test("rangesIntersect rejects adjacent non-overlapping windows", () => {
  assert.equal(
    rangesIntersect(
      { start: "2026-07-01", end: "2026-07-08" },
      { start: "2026-07-08", end: "2026-07-15" },
    ),
    false,
  )
})

test("rangesIntersect rejects fully disjoint windows", () => {
  assert.equal(
    rangesIntersect(
      { start: "2026-07-01", end: "2026-07-08" },
      { start: "2026-08-01", end: "2026-08-08" },
    ),
    false,
  )
})

test("eventWindowFromIso truncates to calendar days with exclusive end", () => {
  const window = eventWindowFromIso({
    startsAt: "2026-07-14T10:00:00.000Z",
    endsAt: "2026-07-14T11:00:00.000Z",
  })
  assert.equal(window.start, "2026-07-14")
  assert.equal(window.end, "2026-07-15")
})

test("eventWindowFromIso keeps midnight exclusive end on the same day boundary", () => {
  const window = eventWindowFromIso({
    startsAt: "2026-07-14T00:00:00.000Z",
    endsAt: "2026-07-15T00:00:00.000Z",
  })
  assert.equal(window.start, "2026-07-14")
  assert.equal(window.end, "2026-07-15")
})
