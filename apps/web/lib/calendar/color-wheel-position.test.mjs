import assert from "node:assert/strict"
import test from "node:test"
import {
  COLOR_WHEEL_PANEL_GAP_REM,
  getBelowDockedColorWheelPosition,
  getColorWheelPanelGapPx,
  getColorWheelPosition,
  getColorWheelSizePx,
  getSideDockedColorWheelPosition,
  preferredColorWheelSideForAnchor,
  readColorWheelPanelSize,
} from "./color-wheel-position.ts"

const panel = { left: 0, top: 0, width: 216, height: 280 }
const viewport = { width: 1200, height: 800 }
const gapPx = 12

test("getColorWheelPanelGapPx converts rem using the root font size", () => {
  assert.equal(COLOR_WHEEL_PANEL_GAP_REM, 0.75)
  assert.equal(getColorWheelPanelGapPx(16), 12)
  assert.equal(getColorWheelPanelGapPx(0), 12)
})

test("readColorWheelPanelSize prefers layout size over transformed visual box", () => {
  const panel = {
    offsetWidth: 216,
    offsetHeight: 280,
    getBoundingClientRect() {
      return { width: 209.5, height: 271.6, left: 0, top: 0 }
    },
  }
  assert.deepEqual(readColorWheelPanelSize(panel), {
    left: 0,
    top: 0,
    width: 216,
    height: 280,
  })
  assert.equal(readColorWheelPanelSize(null), null)
})

test("getColorWheelSizePx converts rem using the root font size", () => {
  assert.equal(getColorWheelSizePx(16), 160)
  assert.equal(getColorWheelSizePx(-1), 160)
})

test("getSideDockedColorWheelPosition prefers the roomier side", () => {
  const anchor = {
    left: 100,
    top: 200,
    right: 400,
    bottom: 520,
    width: 300,
    height: 320,
  }
  const position = getSideDockedColorWheelPosition({
    anchor,
    panel,
    viewport,
    gapPx,
  })
  assert.equal(position.placement, "right")
  assert.equal(position.left, 412)
  assert.equal(position.top, 220)
})

test("getSideDockedColorWheelPosition flips left when the right edge overflows", () => {
  const anchor = {
    left: 900,
    top: 200,
    right: 1180,
    bottom: 520,
    width: 280,
    height: 320,
  }
  const position = getSideDockedColorWheelPosition({
    anchor,
    panel,
    viewport,
    gapPx,
  })
  assert.equal(position.placement, "left")
  assert.equal(position.left, 900 - gapPx - panel.width)
})

test("getSideDockedColorWheelPosition prefers left when that side has more space", () => {
  const anchor = {
    left: 700,
    top: 200,
    right: 1000,
    bottom: 520,
    width: 300,
    height: 320,
  }
  const position = getSideDockedColorWheelPosition({
    anchor,
    panel,
    viewport,
    gapPx,
  })
  assert.equal(position.placement, "left")
  assert.equal(position.left, 700 - gapPx - panel.width)
})

test("getBelowDockedColorWheelPosition places the panel under the anchor", () => {
  const anchor = {
    left: 100,
    top: 120,
    right: 400,
    bottom: 400,
    width: 300,
    height: 280,
  }
  const position = getBelowDockedColorWheelPosition({
    anchor,
    panel,
    viewport,
    gapPx,
  })
  assert.equal(position.placement, "below")
  assert.equal(position.top, 412)
  assert.equal(position.left, 142)
})

test("getBelowDockedColorWheelPosition flips above when the bottom overflows", () => {
  const anchor = {
    left: 100,
    top: 520,
    right: 400,
    bottom: 760,
    width: 300,
    height: 240,
  }
  const position = getBelowDockedColorWheelPosition({
    anchor,
    panel,
    viewport,
    gapPx,
  })
  assert.equal(position.placement, "above")
  assert.equal(position.top, 520 - gapPx - panel.height)
})

function panelRectFromPosition(position, size = panel) {
  return {
    left: position.left,
    top: position.top,
    right: position.left + size.width,
    bottom: position.top + size.height,
  }
}

function rectsIntersect(a, b) {
  return !(
    a.right <= b.left ||
    a.left >= b.right ||
    a.bottom <= b.top ||
    a.top >= b.bottom
  )
}

test("when neither side fits, docks below/above with zero anchor overlap", () => {
  const tightViewport = { width: 400, height: 700 }
  const anchor = {
    left: 20,
    top: 120,
    right: 380,
    bottom: 400,
    width: 360,
    height: 280,
  }
  const position = getSideDockedColorWheelPosition({
    anchor,
    panel,
    viewport: tightViewport,
    gapPx,
  })
  assert.ok(
    position.placement === "below" || position.placement === "above",
    `expected below/above, got ${position.placement}`,
  )
  assert.equal(
    rectsIntersect(panelRectFromPosition(position), {
      left: anchor.left,
      top: anchor.top,
      right: anchor.right,
      bottom: anchor.bottom,
    }),
    false,
  )
})

test("getColorWheelPosition falls through to below when sides overflow", () => {
  const tightViewport = { width: 400, height: 700 }
  const anchor = {
    left: 20,
    top: 120,
    right: 380,
    bottom: 400,
    width: 360,
    height: 280,
  }
  const position = getColorWheelPosition({
    anchor,
    panel,
    viewport: tightViewport,
    gapPx,
    isNarrow: false,
  })
  assert.equal(position.placement, "below")
  assert.equal(
    rectsIntersect(panelRectFromPosition(position), {
      left: anchor.left,
      top: anchor.top,
      right: anchor.right,
      bottom: anchor.bottom,
    }),
    false,
  )
})

test("getSideDockedColorWheelPosition flips when preferredSide overflows", () => {
  const anchor = {
    left: 900,
    top: 200,
    right: 1180,
    bottom: 520,
    width: 280,
    height: 320,
  }
  const position = getSideDockedColorWheelPosition({
    anchor,
    panel,
    viewport,
    gapPx,
    preferredSide: "right",
  })
  assert.equal(position.placement, "left")
  assert.equal(position.left, 900 - gapPx - panel.width)
})

test("preferredColorWheelSideForAnchor mirrors popover data-placement", () => {
  const fakeLeft = {
    getAttribute(name) {
      return name === "data-placement" ? "left" : null
    },
  }
  const fakeRight = {
    getAttribute() {
      return "right"
    },
  }
  const fakeCentered = {
    getAttribute() {
      return "centered"
    },
  }
  assert.equal(preferredColorWheelSideForAnchor(fakeLeft), "left")
  assert.equal(preferredColorWheelSideForAnchor(fakeRight), "right")
  assert.equal(preferredColorWheelSideForAnchor(fakeCentered), null)
  assert.equal(preferredColorWheelSideForAnchor(null), null)
})

test("getColorWheelPosition uses below docking on narrow viewports", () => {
  const anchor = {
    left: 40,
    top: 80,
    right: 340,
    bottom: 360,
    width: 300,
    height: 280,
  }
  const position = getColorWheelPosition({
    anchor,
    panel,
    viewport: { width: 390, height: 700 },
    gapPx,
    isNarrow: true,
  })
  assert.equal(position.placement, "below")
  assert.ok(position.top >= anchor.bottom)
})

test("getSideDockedColorWheelPosition honors preferredSide over roominess", () => {
  const anchor = {
    left: 500,
    top: 200,
    right: 800,
    bottom: 520,
    width: 300,
    height: 320,
  }
  // Left has more space, but preferredSide right should win when it fits.
  const position = getSideDockedColorWheelPosition({
    anchor,
    panel,
    viewport,
    gapPx,
    preferredSide: "right",
  })
  assert.equal(position.placement, "right")
  assert.equal(position.left, 812)
})

test("getColorWheelPosition keeps side docking on wide viewports", () => {
  const anchor = {
    left: 100,
    top: 200,
    right: 400,
    bottom: 520,
    width: 300,
    height: 320,
  }
  const position = getColorWheelPosition({
    anchor,
    panel,
    viewport,
    gapPx,
    isNarrow: false,
  })
  assert.equal(position.placement, "right")
})

test("getColorWheelPosition can prefer the outer side away from a callout", () => {
  const anchor = {
    left: 400,
    top: 200,
    right: 700,
    bottom: 520,
    width: 300,
    height: 320,
  }
  const position = getColorWheelPosition({
    anchor,
    panel,
    viewport,
    gapPx,
    isNarrow: false,
    preferredSide: "right",
  })
  assert.equal(position.placement, "right")
  assert.equal(position.left, 712)
})
