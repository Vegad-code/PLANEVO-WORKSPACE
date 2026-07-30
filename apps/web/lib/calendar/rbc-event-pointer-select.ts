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
 * Press that may become an event select on pointerup. Must live in a React ref
 * — never a `let` closed over by a useEffect that depends on render-time props.
 *
 * Classic failure (GCal create→existing-event): create popover dismisses on
 * pointerdown → parent re-render → effect teardown drops local `pending` →
 * pointerup never calls onEventSelect. Effect cleanup must not clear this.
 */
export type PendingRbcEventSelect = RbcEventPointerDown & {
  anchor: HTMLElement | null
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
  // `Element` is browser-only; guard so Node unit tests can pass null targets.
  if (typeof Element === "undefined" || !(target instanceof Element)) return null
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

/** Capture a candidate select; null means clear any prior pending. */
export function capturePendingRbcEventSelect(input: {
  target: EventTarget | null
  clientX: number
  clientY: number
}): PendingRbcEventSelect | null {
  const read = readRbcEventPointerDown(input)
  if (!read) return null
  const eventRoot =
    typeof Element !== "undefined" && input.target instanceof Element
      ? input.target.closest(".rbc-event")
      : null
  return {
    ...read,
    anchor: eventRoot instanceof HTMLElement ? eventRoot : null,
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

/**
 * Consume pending on pointerup. Always clears caller-held pending (assign null
 * after calling). Null = no select (drag, or no prior down).
 */
export function consumePendingRbcEventSelect(input: {
  pending: PendingRbcEventSelect | null
  clientX: number
  clientY: number
}): { eventId: string; anchor: HTMLElement | null } | null {
  const eventId = resolveRbcEventPointerSelect({
    pointerDown: input.pending,
    clientX: input.clientX,
    clientY: input.clientY,
  })
  if (!eventId || !input.pending) return null
  return { eventId, anchor: input.pending.anchor }
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
