import assert from "node:assert/strict"
import test from "node:test"
import {
  NOW_INDICATOR_BADGE_HEIGHT_PX,
  shouldFlipNowIndicatorBadge,
} from "./now-indicator-badge-flip.ts"

test("shouldFlipNowIndicatorBadge flips when the line is within badge clearance of the top", () => {
  const containerHeightPx = 2400
  const thresholdPercent =
    (NOW_INDICATOR_BADGE_HEIGHT_PX / containerHeightPx) * 100

  assert.equal(
    shouldFlipNowIndicatorBadge({
      percentTop: thresholdPercent - 0.01,
      containerHeightPx,
    }),
    true,
  )
  assert.equal(
    shouldFlipNowIndicatorBadge({
      percentTop: thresholdPercent + 0.01,
      containerHeightPx,
    }),
    false,
  )
})

test("shouldFlipNowIndicatorBadge flips at 12:10 AM on a typical grid", () => {
  const percentTop = ((10 / 60) / 24) * 100
  assert.equal(
    shouldFlipNowIndicatorBadge({
      percentTop,
      containerHeightPx: 1200,
    }),
    true,
  )
})
