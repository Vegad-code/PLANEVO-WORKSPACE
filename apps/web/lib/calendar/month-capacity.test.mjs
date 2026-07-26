import assert from "node:assert/strict"
import test from "node:test"
import { cssLengthToPixels, resolveMonthCapacity } from "./month-capacity.ts"

test("converts rem tokens using the root font size", () => {
  // Arrange / Act / Assert — getComputedStyle hands back custom properties as
  // authored, so "1.5rem" must be converted rather than parsed as 1.5.
  assert.equal(cssLengthToPixels("1.5rem", 16), 24)
  assert.equal(cssLengthToPixels("1.25rem", 16), 20)
  assert.equal(cssLengthToPixels("1rem", 20), 20)
})

test("passes pixel tokens through and tolerates whitespace", () => {
  // Arrange / Act / Assert
  assert.equal(cssLengthToPixels("2px", 16), 2)
  assert.equal(cssLengthToPixels("  24px  ", 16), 24)
  assert.equal(cssLengthToPixels("0", 16), 0)
})

test("returns null for units it cannot resolve", () => {
  // Arrange / Act / Assert — a wrong number here would silently inflate
  // capacity, so an unknown unit must fail loudly rather than guess.
  assert.equal(cssLengthToPixels("2em", 16), null)
  assert.equal(cssLengthToPixels("calc(1rem + 2px)", 16), null)
  assert.equal(cssLengthToPixels("", 16), null)
  assert.equal(cssLengthToPixels("auto", 16), null)
})

test("derives capacity from the measured row height", () => {
  // Arrange — six 140px rows, a 24px date header, and 8px padding each side.
  const capacity = resolveMonthCapacity({
    bodyHeightPx: 840,
    rowCount: 6,
    dateHeaderPx: 24,
    cellPaddingPx: 8,
    itemRowPx: 20,
  })

  // Assert — (140 - 24 - 16) / 20 = 5.
  assert.equal(capacity, 5)
})

test("gives a five-week month more room than a six-week one", () => {
  // Arrange — the same viewport split across fewer `1fr` tracks.
  const sixWeeks = resolveMonthCapacity({
    bodyHeightPx: 840,
    rowCount: 6,
    dateHeaderPx: 24,
    cellPaddingPx: 8,
    itemRowPx: 20,
  })
  const fiveWeeks = resolveMonthCapacity({
    bodyHeightPx: 840,
    rowCount: 5,
    dateHeaderPx: 24,
    cellPaddingPx: 8,
    itemRowPx: 20,
  })

  // Assert
  assert.equal(sixWeeks, 5)
  assert.equal(fiveWeeks, 6)
})

test("never reports a capacity below one", () => {
  // Arrange — a frame too short for even a single row.
  const capacity = resolveMonthCapacity({
    bodyHeightPx: 200,
    rowCount: 6,
    dateHeaderPx: 24,
    cellPaddingPx: 8,
    itemRowPx: 20,
  })

  // Assert
  assert.equal(capacity, 1)
})

test("returns null when the inputs cannot yield an answer", () => {
  // Arrange / Act / Assert — the caller keeps its previous capacity instead of
  // collapsing the grid on an unmeasured or detached container.
  const base = {
    bodyHeightPx: 840,
    rowCount: 6,
    dateHeaderPx: 24,
    cellPaddingPx: 8,
    itemRowPx: 20,
  }
  assert.equal(resolveMonthCapacity({ ...base, bodyHeightPx: 0 }), null)
  assert.equal(resolveMonthCapacity({ ...base, rowCount: 0 }), null)
  assert.equal(resolveMonthCapacity({ ...base, itemRowPx: 0 }), null)
})
