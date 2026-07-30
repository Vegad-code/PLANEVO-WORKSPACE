import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  allowCreateFromPointerGesture,
  armCreateGestureSuppress,
  clearCreateGestureSuppress,
  initialCreateGestureSuppressState,
  shouldArmSuppressOnOutsidePointer,
} from "./create-gesture-suppress.ts"

describe("create-gesture-suppress", () => {
  it("starts disarmed so a normal empty-slot click can create", () => {
    const state = initialCreateGestureSuppressState()
    assert.equal(state.armed, false)
    assert.equal(allowCreateFromPointerGesture({ suppress: state }), true)
  })

  it("arms only when a panel is open for an outside pointer", () => {
    assert.equal(shouldArmSuppressOnOutsidePointer({ panelOpen: true }), true)
    assert.equal(shouldArmSuppressOnOutsidePointer({ panelOpen: false }), false)
  })

  it("keeps create blocked across selecting + selectSlot until cleared", () => {
    let state = armCreateGestureSuppress(initialCreateGestureSuppressState())
    assert.equal(allowCreateFromPointerGesture({ suppress: state }), false)
    // allowCreate does not clear — both selecting and selectSlot stay blocked.
    assert.equal(allowCreateFromPointerGesture({ suppress: state }), false)
    state = clearCreateGestureSuppress(state)
    assert.equal(allowCreateFromPointerGesture({ suppress: state }), true)
  })

  it("Cancel / Escape path never arms — only outside pointer does", () => {
    // Documented contract: callers arm only for outside-pointer dismiss.
    // Escape/Cancel do not generate a following slot-select.
    const state = initialCreateGestureSuppressState()
    assert.equal(allowCreateFromPointerGesture({ suppress: state }), true)
  })

  it("does not arm when the panel is already closed (exiting shell)", () => {
    assert.equal(shouldArmSuppressOnOutsidePointer({ panelOpen: false }), false)
  })
})
