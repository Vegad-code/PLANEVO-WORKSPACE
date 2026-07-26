import assert from "node:assert/strict"
import test from "node:test"
import { computeDayOverflow, planWeekLanes } from "./month-overflow.ts"

/** Stand-in items; the overflow logic only counts and slices them. */
function singles(count) {
  return Array.from({ length: count }, (_, index) => ({
    kind: "event",
    id: `item-${index}`,
    title: `Item ${index}`,
  }))
}

function day({
  visibleLaneCount = 0,
  hiddenBarCount = 0,
  singleCount = 0,
  capacity = 3,
}) {
  return computeDayOverflow({
    visibleLaneCount,
    hiddenBarCount,
    singlesForDay: singles(singleCount),
    capacity,
  })
}

test("reserves every lane when the week has room", () => {
  // Arrange / Act
  const plan = planWeekLanes({
    laneCountForWeek: 2,
    dayItemCounts: [0, 2, 3, 0, 1, 0, 0],
    capacity: 4,
  })

  // Assert
  assert.equal(plan.visibleLaneCount, 2)
})

test("gives up one lane week-wide when a day cannot fit its items", () => {
  // Arrange — Wednesday needs six rows in a four-row cell.
  const plan = planWeekLanes({
    laneCountForWeek: 4,
    dayItemCounts: [0, 0, 6, 0, 0, 0, 0],
    capacity: 4,
  })

  // Assert — three lanes, leaving Wednesday a row for its trigger.
  assert.equal(plan.visibleLaneCount, 3)
})

test("keeps lane geometry identical across the week", () => {
  // Arrange — three lanes, capacity three, and only Wednesday overflowing.
  // Deciding per cell would keep all three lanes on the quiet days and drop one
  // on Wednesday, tearing a hole through any bar spanning the week.
  const plan = planWeekLanes({
    laneCountForWeek: 3,
    dayItemCounts: [3, 3, 9, 3, 3, 3, 3],
    capacity: 3,
  })

  // Assert — one lane given up for the whole row, not just for Wednesday.
  assert.equal(plan.visibleLaneCount, 2)
})

test("shows a quiet day's items even when its neighbour overflows", () => {
  // Arrange — the week gave up a lane for a busy Wednesday. A cell with one
  // event and nothing hidden must still show that event, not "+1 more".
  const quiet = day({ visibleLaneCount: 0, singleCount: 1, capacity: 1 })

  // Assert
  assert.equal(quiet.hasOverflow, false)
  assert.equal(quiet.visibleSingles.length, 1)
})

test("does not charge a day for a bar that does not cover it", () => {
  // Arrange — the hidden lane belongs to a bar spanning other columns only.
  const uncovered = day({
    visibleLaneCount: 1,
    hiddenBarCount: 0,
    singleCount: 1,
    capacity: 3,
  })

  // Assert
  assert.equal(uncovered.hasOverflow, false)
  assert.equal(uncovered.visibleSingles.length, 1)
})

test("counts a hidden bar that does cover the day", () => {
  // Arrange — the regression guard for react-big-calendar #2658, where an
  // overflowing multi-day bar vanished without being counted.
  const covered = day({
    visibleLaneCount: 1,
    hiddenBarCount: 2,
    singleCount: 1,
    capacity: 3,
  })

  // Assert — 2 bars plus the single that no longer fits.
  assert.equal(covered.hasOverflow, true)
  assert.equal(covered.visibleSingles.length, 1)
  assert.equal(covered.overflowCount, 2)
})

test("shows everything when items exactly fill the cell", () => {
  // Arrange — 1 lane + 2 singles == capacity 3, so no trigger row is needed.
  const exact = day({ visibleLaneCount: 1, singleCount: 2, capacity: 3 })

  // Assert
  assert.equal(exact.hasOverflow, false)
  assert.equal(exact.visibleSingles.length, 2)
})

test("reserves one row for the trigger once items do not fit", () => {
  // Arrange — 1 lane + 4 singles in a 3-row cell.
  const busy = day({ visibleLaneCount: 1, singleCount: 4, capacity: 3 })

  // Assert — one single visible, the trigger takes the third row.
  assert.equal(busy.visibleSingles.length, 1)
  assert.equal(busy.overflowCount, 3)
})

test("counts everything when lanes consume the whole cell", () => {
  // Arrange
  const packed = day({
    visibleLaneCount: 1,
    hiddenBarCount: 1,
    singleCount: 3,
    capacity: 1,
  })

  // Assert
  assert.equal(packed.visibleSingles.length, 0)
  assert.equal(packed.overflowCount, 4)
})

test("survives a degenerate zero capacity", () => {
  // Arrange
  const plan = planWeekLanes({
    laneCountForWeek: 1,
    dayItemCounts: [3],
    capacity: 0,
  })
  const result = day({
    visibleLaneCount: plan.visibleLaneCount,
    hiddenBarCount: 1,
    singleCount: 2,
    capacity: 0,
  })

  // Assert
  assert.equal(plan.visibleLaneCount, 0)
  assert.equal(result.overflowCount, 3)
})

test("reports no overflow for an empty day", () => {
  // Arrange / Act / Assert
  assert.equal(day({ capacity: 3 }).hasOverflow, false)
})
