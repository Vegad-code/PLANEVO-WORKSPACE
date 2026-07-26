import assert from "node:assert/strict"
import test from "node:test"
import {
  getAnchoredEventPopoverPosition,
  getCenteredEventPopoverPosition,
  getEventPopoverPosition,
} from "./event-popover-position.ts"

const panel = { left: 0, top: 0, width: 288, height: 280 }
const viewport = { width: 1200, height: 800 }

test("getAnchoredEventPopoverPosition places popover to the right of anchor", () => {
  const anchor = { left: 100, top: 200, right: 180, bottom: 240, width: 80, height: 40 }
  const position = getAnchoredEventPopoverPosition({ anchor, panel, viewport })
  assert.equal(position.left, 192)
  assert.equal(position.top, 80)
  assert.equal(position.centered, false)
  assert.equal(position.placement, "right")
  assert.equal(position.arrowOffsetY, 140)
})

test("getAnchoredEventPopoverPosition flips left when overflowing right edge", () => {
  const anchor = {
    left: 1000,
    top: 200,
    right: 1100,
    bottom: 240,
    width: 100,
    height: 40,
  }
  const position = getAnchoredEventPopoverPosition({ anchor, panel, viewport })
  assert.ok(position.left < anchor.left)
  assert.equal(position.placement, "left")
  assert.equal(position.arrowOffsetY, 140)
})

test("getCenteredEventPopoverPosition centers within viewport", () => {
  const position = getCenteredEventPopoverPosition({ panel, viewport })
  assert.equal(position.top, 260)
  assert.equal(position.left, 456)
  assert.equal(position.centered, true)
  assert.equal(position.placement, "centered")
  assert.equal(position.arrowOffsetY, 0)
})

test("getEventPopoverPosition uses centered layout on narrow viewports", () => {
  const anchorRect = { left: 100, top: 200, right: 180, bottom: 240, width: 80, height: 40 }
  const position = getEventPopoverPosition({
    anchorRect,
    panel,
    viewport: { width: 390, height: 700 },
    isNarrow: true,
  })
  assert.equal(position.centered, true)
  assert.equal(position.placement, "centered")
  assert.equal(position.arrowOffsetY, 0)
  assert.equal(position.left, 51)
})
