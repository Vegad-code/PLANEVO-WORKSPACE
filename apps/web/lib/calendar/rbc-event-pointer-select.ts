import { DRAFT_CREATE_EVENT_ID } from "./rbc-event-adapter.ts"

/** Match dnd-kit month chips — movement beyond this is a drag, not a click. */
export const RBC_EVENT_CLICK_MAX_DISTANCE_PX = 8

const RESIZE_HANDLE_SELECTOR =
  ".rbc-addons-dnd-resize-ns-anchor, .rbc-addons-dnd-resize-ew-anchor"

export type RbcEventPointerDown = {
  eventId: string
  clientX: number
  clientY: number
}

/**
 * RBC DnD begins a move on mousedown and remounts the event node before
 * mouseup, so the browser never fires `click` / `onSelectEvent`. Resolve a
 * click from the pointer pair instead when movement stays within threshold.
 */
export function readRbcEventPointerDown(input: {
  target: EventTarget | null
  clientX: number
  clientY: number
}): RbcEventPointerDown | null {
  const { target } = input
  if (!(target instanceof Element)) return null
  if (target.closest(RESIZE_HANDLE_SELECTOR)) return null

  const eventRoot = target.closest(".rbc-event")
  if (!(eventRoot instanceof HTMLElement)) return null
  if (eventRoot.classList.contains("planevo-rbc-event--draft")) return null

  const idCarrier = eventRoot.matches("[data-event-id]")
    ? eventRoot
    : eventRoot.querySelector("[data-event-id]")
  const eventId = idCarrier?.getAttribute("data-event-id")
  if (!eventId || eventId === DRAFT_CREATE_EVENT_ID) return null

  return {
    eventId,
    clientX: input.clientX,
    clientY: input.clientY,
  }
}

export function resolveRbcEventPointerSelect(input: {
  pointerDown: RbcEventPointerDown | null
  clientX: number
  clientY: number
  maxDistancePx?: number
}): string | null {
  if (!input.pointerDown) return null
  const maxDistance = input.maxDistancePx ?? RBC_EVENT_CLICK_MAX_DISTANCE_PX
  const distance = Math.hypot(
    input.clientX - input.pointerDown.clientX,
    input.clientY - input.pointerDown.clientY,
  )
  if (distance > maxDistance) return null
  return input.pointerDown.eventId
}

/** Prefer a live node after DnD remount; fall back to the press-time anchor. */
export function findRbcEventAnchorElement(input: {
  root: ParentNode
  eventId: string
  fallback: HTMLElement | null
}): HTMLElement | null {
  const escaped =
    typeof CSS !== "undefined" && typeof CSS.escape === "function"
      ? CSS.escape(input.eventId)
      : input.eventId.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
  const live = input.root
    .querySelector(`[data-event-id="${escaped}"]`)
    ?.closest(".rbc-event")
  if (live instanceof HTMLElement) return live
  return input.fallback?.isConnected ? input.fallback : null
}
