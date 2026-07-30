/**
 * GCal-parity create dismiss: an outside pointer that closes the create/edit
 * card must not also open a new create from the same gesture.
 *
 * Classic failure mode: popover dismisses on pointerdown → slot-select /
 * drag-select on the same pointerup/mouseup opens create again. Arm on outside
 * dismiss; ignore slot/draft selecting while armed; clear after the gesture's
 * mouseup/selectSlot turn (not on pointerup alone — RBC often selects on mouseup).
 */

export type CreateGestureSuppressState = {
  armed: boolean
}

export function initialCreateGestureSuppressState(): CreateGestureSuppressState {
  return { armed: false }
}

/** Outside pointer dismissed an open panel — suppress create until gesture ends. */
export function armCreateGestureSuppress(
  state: CreateGestureSuppressState,
): CreateGestureSuppressState {
  return { armed: true }
}

export function clearCreateGestureSuppress(
  state: CreateGestureSuppressState,
): CreateGestureSuppressState {
  return { armed: false }
}

/**
 * Whether a slot-select or draft-selecting update should open/paint create.
 * Does not clear the arm — clear on gesture end so both selecting and selectSlot
 * in one drag are suppressed.
 */
export function allowCreateFromPointerGesture(input: {
  suppress: CreateGestureSuppressState
}): boolean {
  return !input.suppress.armed
}

/** True when an outside pointer should arm suppress (panel is open). */
export function shouldArmSuppressOnOutsidePointer(input: {
  panelOpen: boolean
}): boolean {
  return input.panelOpen
}

/**
 * Clear suppress after the dismiss gesture fully finishes.
 *
 * Must outlive `pointerup`: react-big-calendar's selectSlot is often wired to
 * `mouseup`, which the browser fires after `pointerup` in the same gesture.
 * A bare clear on pointerup (or a microtask) would disarm before selectSlot and
 * recreate the event. `setTimeout(0)` runs after that mouseup turn.
 *
 * Returns an abort that removes listeners + cancels the pending timeout.
 */
export function scheduleCreateGestureSuppressClear(input: {
  onClear: () => void
}): () => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let settled = false

  const settle = () => {
    if (settled) return
    settled = true
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
      timeoutId = null
    }
    window.removeEventListener("pointerup", onPointerEnd, true)
    window.removeEventListener("pointercancel", onPointerEnd, true)
    input.onClear()
  }

  const onPointerEnd = () => {
    if (timeoutId !== null) return
    timeoutId = window.setTimeout(settle, 0)
  }

  window.addEventListener("pointerup", onPointerEnd, true)
  window.addEventListener("pointercancel", onPointerEnd, true)

  return settle
}
