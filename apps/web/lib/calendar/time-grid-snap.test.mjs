import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  TIME_GRID_CLICK_CREATE_MINUTES,
  TIME_GRID_SLOTS_PER_HOUR,
  TIME_GRID_SNAP_MINUTES,
  ceilMinutesToTimeGridSnap,
  isOnTimeGridSnap,
  normalizeTimeGridCreateRange,
  snapDateUpToTimeGrid,
} from "./time-grid-snap.ts"

describe("time-grid snap constants (GCal parity)", () => {
  it("uses a fixed 15-minute step with four slots per hour", () => {
    assert.equal(TIME_GRID_SNAP_MINUTES, 15)
    assert.equal(TIME_GRID_SLOTS_PER_HOUR, 4)
    assert.equal(TIME_GRID_SLOTS_PER_HOUR * TIME_GRID_SNAP_MINUTES, 60)
  })
})

describe("ceilMinutesToTimeGridSnap", () => {
  it("keeps exact :00 / :15 / :30 / :45 boundaries", () => {
    assert.equal(ceilMinutesToTimeGridSnap({ minutes: 0 }), 0)
    assert.equal(ceilMinutesToTimeGridSnap({ minutes: 15 }), 15)
    assert.equal(ceilMinutesToTimeGridSnap({ minutes: 30 }), 30)
    assert.equal(ceilMinutesToTimeGridSnap({ minutes: 45 }), 45)
  })

  it("rounds up into the next quarter so drag lands like GCal", () => {
    assert.equal(ceilMinutesToTimeGridSnap({ minutes: 1 }), 15)
    assert.equal(ceilMinutesToTimeGridSnap({ minutes: 14 }), 15)
    assert.equal(ceilMinutesToTimeGridSnap({ minutes: 16 }), 30)
    assert.equal(ceilMinutesToTimeGridSnap({ minutes: 29 }), 30)
    assert.equal(ceilMinutesToTimeGridSnap({ minutes: 31 }), 45)
    assert.equal(ceilMinutesToTimeGridSnap({ minutes: 44 }), 45)
    assert.equal(ceilMinutesToTimeGridSnap({ minutes: 46 }), 60)
  })

  it("returns null for unusable snap sizes instead of inventing a grid", () => {
    assert.equal(ceilMinutesToTimeGridSnap({ minutes: 10, snapMinutes: 0 }), null)
    assert.equal(
      ceilMinutesToTimeGridSnap({ minutes: 10, snapMinutes: -15 }),
      null,
    )
    assert.equal(
      ceilMinutesToTimeGridSnap({ minutes: Number.NaN }),
      null,
    )
  })
})

describe("snapDateUpToTimeGrid", () => {
  it("clears seconds and snaps local wall time onto the 15-minute grid", () => {
    const snapped = snapDateUpToTimeGrid({
      date: new Date(2026, 6, 24, 14, 17, 42),
    })
    assert.ok(snapped)
    assert.equal(snapped.getHours(), 14)
    assert.equal(snapped.getMinutes(), 30)
    assert.equal(snapped.getSeconds(), 0)
    assert.equal(snapped.getMilliseconds(), 0)
  })

  it("rolls past the hour when ceil lands on 60", () => {
    const snapped = snapDateUpToTimeGrid({
      date: new Date(2026, 6, 24, 14, 46, 0),
    })
    assert.ok(snapped)
    assert.equal(snapped.getHours(), 15)
    assert.equal(snapped.getMinutes(), 0)
  })

  it("keeps an exact :45 on the grid instead of jumping a half hour", () => {
    const snapped = snapDateUpToTimeGrid({
      date: new Date(2026, 6, 24, 14, 45, 0),
    })
    assert.ok(snapped)
    assert.equal(snapped.getHours(), 14)
    assert.equal(snapped.getMinutes(), 45)
  })

  it("does not mutate the input Date", () => {
    const input = new Date(2026, 6, 24, 9, 7, 30)
    const before = input.getTime()
    snapDateUpToTimeGrid({ date: input })
    assert.equal(input.getTime(), before)
  })

  it("returns null for an invalid Date", () => {
    assert.equal(snapDateUpToTimeGrid({ date: new Date(Number.NaN) }), null)
  })
})

describe("isOnTimeGridSnap", () => {
  it("accepts only :00 / :15 / :30 / :45 with zero seconds", () => {
    assert.equal(
      isOnTimeGridSnap({ date: new Date(2026, 6, 24, 10, 0, 0) }),
      true,
    )
    assert.equal(
      isOnTimeGridSnap({ date: new Date(2026, 6, 24, 10, 15, 0) }),
      true,
    )
    assert.equal(
      isOnTimeGridSnap({ date: new Date(2026, 6, 24, 10, 30, 0) }),
      true,
    )
    assert.equal(
      isOnTimeGridSnap({ date: new Date(2026, 6, 24, 10, 45, 0) }),
      true,
    )
    assert.equal(
      isOnTimeGridSnap({ date: new Date(2026, 6, 24, 10, 20, 0) }),
      false,
    )
    assert.equal(
      isOnTimeGridSnap({ date: new Date(2026, 6, 24, 10, 15, 1) }),
      false,
    )
  })
})

describe("normalizeTimeGridCreateRange", () => {
  it("expands a one-step click to GCal's default 30-minute block", () => {
    const start = new Date(2026, 6, 24, 10, 15, 0)
    const end = new Date(2026, 6, 24, 10, 30, 0)
    const range = normalizeTimeGridCreateRange({
      start,
      end,
      action: "click",
    })
    assert.ok(range)
    assert.equal(range.start.getTime(), start.getTime())
    assert.equal(range.end.getMinutes(), 45)
    assert.equal(
      (range.end.getTime() - range.start.getTime()) / 60_000,
      TIME_GRID_CLICK_CREATE_MINUTES,
    )
  })

  it("keeps a drag-select range instead of forcing the click default", () => {
    const start = new Date(2026, 6, 24, 10, 0, 0)
    const end = new Date(2026, 6, 24, 10, 15, 0)
    const range = normalizeTimeGridCreateRange({
      start,
      end,
      action: "select",
    })
    assert.ok(range)
    assert.equal(range.end.getTime(), end.getTime())
  })

  it("returns null for inverted or invalid ranges", () => {
    assert.equal(
      normalizeTimeGridCreateRange({
        start: new Date(2026, 6, 24, 10, 30, 0),
        end: new Date(2026, 6, 24, 10, 15, 0),
        action: "click",
      }),
      null,
    )
  })
})
