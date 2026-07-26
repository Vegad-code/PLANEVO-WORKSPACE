import type { SlotInfo } from "react-big-calendar"
import { DRAFT_CREATE_EVENT_ID } from "@/lib/calendar/rbc-event-adapter"
import { centeredAnchorRectFromElement } from "@/lib/calendar/event-popover-position"
import { normalizeSlotAnchorRect } from "@/lib/calendar/normalize-slot-anchor-rect"

export { normalizeSlotAnchorRect }

type SlotInfoWithBounds = SlotInfo & {
  bounds?: {
    top: number
    left: number
    right?: number
    bottom?: number
    width?: number
    height?: number
    x?: number
    y?: number
  }
  box?: {
    x: number
    y: number
    clientX?: number
    clientY?: number
    width?: number
    height?: number
  }
}

export function slotInfoToAnchorRect(
  slotInfo: SlotInfo,
  fallbackElement: HTMLElement | null,
): DOMRect {
  const extended = slotInfo as SlotInfoWithBounds

  if (extended.bounds) {
    return normalizeSlotAnchorRect(extended.bounds)
  }

  if (extended.box) {
    const { x, y, clientX, clientY, width = 1, height = 40 } = extended.box
    const left = typeof clientX === "number" ? clientX : x - window.scrollX
    const top = typeof clientY === "number" ? clientY : y - window.scrollY
    return new DOMRect(left, top, Math.max(1, width), Math.max(1, height))
  }

  if (fallbackElement) {
    return centeredAnchorRectFromElement(fallbackElement)
  }

  return new DOMRect(
    window.innerWidth / 2 - 80,
    window.innerHeight / 2 - 24,
    160,
    48,
  )
}

export function elementToAnchorRect(element: HTMLElement): DOMRect {
  return element.getBoundingClientRect()
}

export function draftCreateCardAnchorRect(
  root: HTMLElement | null,
): DOMRect | null {
  if (!root) return null
  // Prefer data-event-id; fall back to the class eventPropGetter always paints
  // (DnD's eventWrapper nest does not forward unknown props to the DOM node).
  const draftCard =
    root.querySelector<HTMLElement>(
      `[data-event-id="${DRAFT_CREATE_EVENT_ID}"]`,
    ) ?? root.querySelector<HTMLElement>(".planevo-rbc-event--draft")
  if (!draftCard) return null
  const eventRoot = draftCard.closest<HTMLElement>(".rbc-event") ?? draftCard
  return elementToAnchorRect(eventRoot)
}
