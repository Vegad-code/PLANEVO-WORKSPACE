import assert from "node:assert/strict"
import test from "node:test"
import { normalizeSlotAnchorRect } from "./normalize-slot-anchor-rect.ts"

if (typeof globalThis.DOMRect === "undefined") {
  globalThis.DOMRect = class DOMRect {
    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x
      this.y = y
      this.width = width
      this.height = height
      this.left = x
      this.top = y
      this.right = x + width
      this.bottom = y + height
    }
  }
}

test("normalizeSlotAnchorRect derives width/height from right/bottom", () => {
  const rect = normalizeSlotAnchorRect({
    top: 304,
    left: 734,
    right: 734,
    bottom: 349,
  })
  assert.equal(rect.width, 1)
  assert.equal(rect.height, 45)
  assert.equal(Number.isNaN(rect.top), false)
  assert.equal(Number.isNaN(rect.left), false)
})

test("normalizeSlotAnchorRect keeps explicit width/height", () => {
  const rect = normalizeSlotAnchorRect({
    top: 100,
    left: 200,
    width: 80,
    height: 40,
  })
  assert.equal(rect.width, 80)
  assert.equal(rect.height, 40)
})
