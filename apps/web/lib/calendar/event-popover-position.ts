export const EVENT_POPOVER_WIDTH_REM = 21
export const EVENT_POPOVER_VIEWPORT_MARGIN_PX = 12
export const EVENT_POPOVER_ANCHOR_GAP_PX = 12
export const EVENT_POPOVER_MOBILE_MAX_WIDTH_PX = 767
export const EVENT_POPOVER_ARROW_EDGE_PADDING_PX = 12

type Rectangle = Pick<DOMRect, "left" | "top" | "width" | "height">

export type EventPopoverPlacement = "left" | "right" | "centered"

export type EventPopoverPosition = {
  top: number
  left: number
  centered: boolean
  placement: EventPopoverPlacement
  arrowOffsetY: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

export function getEventPopoverPanelWidthPx(remPx: number): number {
  return EVENT_POPOVER_WIDTH_REM * remPx
}

function getArrowOffsetY(
  anchor: Pick<DOMRect, "top" | "bottom" | "height">,
  panelTop: number,
  panelHeight: number,
): number {
  const anchorCenterY = anchor.top + anchor.height / 2
  const maxOffset = Math.max(
    EVENT_POPOVER_ARROW_EDGE_PADDING_PX,
    panelHeight - EVENT_POPOVER_ARROW_EDGE_PADDING_PX,
  )
  return clamp(
    anchorCenterY - panelTop,
    EVENT_POPOVER_ARROW_EDGE_PADDING_PX,
    maxOffset,
  )
}

/** Centered floating card for narrow viewports. */
export function getCenteredEventPopoverPosition({
  panel,
  viewport,
}: {
  panel: Rectangle
  viewport: { width: number; height: number }
}): EventPopoverPosition {
  return {
    top: clamp(
      (viewport.height - panel.height) / 2,
      EVENT_POPOVER_VIEWPORT_MARGIN_PX,
      Math.max(
        EVENT_POPOVER_VIEWPORT_MARGIN_PX,
        viewport.height - panel.height - EVENT_POPOVER_VIEWPORT_MARGIN_PX,
      ),
    ),
    left: clamp(
      (viewport.width - panel.width) / 2,
      EVENT_POPOVER_VIEWPORT_MARGIN_PX,
      Math.max(
        EVENT_POPOVER_VIEWPORT_MARGIN_PX,
        viewport.width - panel.width - EVENT_POPOVER_VIEWPORT_MARGIN_PX,
      ),
    ),
    centered: true,
    placement: "centered",
    arrowOffsetY: 0,
  }
}

/** Prefer right of anchor; flip left / shift up when overflowing. */
export function getAnchoredEventPopoverPosition({
  anchor,
  panel,
  viewport,
}: {
  anchor: Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">
  panel: Rectangle
  viewport: { width: number; height: number }
}): EventPopoverPosition {
  const margin = EVENT_POPOVER_VIEWPORT_MARGIN_PX
  const gap = EVENT_POPOVER_ANCHOR_GAP_PX
  const maxTop = Math.max(margin, viewport.height - panel.height - margin)
  const maxLeft = Math.max(margin, viewport.width - panel.width - margin)

  const rightLeft = anchor.right + gap
  const leftLeft = anchor.left - gap - panel.width
  const rightFits = rightLeft + panel.width <= viewport.width - margin
  const leftFits = leftLeft >= margin

  let left = rightLeft
  let placement: EventPopoverPlacement = "right"

  if (!rightFits && leftFits) {
    left = leftLeft
    placement = "left"
  } else if (!rightFits && !leftFits) {
    left = clamp(
      anchor.left + anchor.width / 2 - panel.width / 2,
      margin,
      maxLeft,
    )
    const panelCenter = left + panel.width / 2
    const anchorCenter = anchor.left + anchor.width / 2
    placement = panelCenter < anchorCenter ? "left" : "right"
  }

  let top = anchor.top + anchor.height / 2 - panel.height / 2
  if (top < margin) {
    top = margin
  } else if (top + panel.height > viewport.height - margin) {
    top = viewport.height - margin - panel.height
  }
  top = clamp(top, margin, maxTop)

  return {
    top,
    left,
    centered: false,
    placement,
    arrowOffsetY: getArrowOffsetY(anchor, top, panel.height),
  }
}

export function getEventPopoverPosition({
  anchorRect,
  panel,
  viewport,
  isNarrow,
}: {
  anchorRect: DOMRect
  panel: Rectangle
  viewport: { width: number; height: number }
  isNarrow: boolean
}): EventPopoverPosition {
  if (isNarrow) {
    return getCenteredEventPopoverPosition({ panel, viewport })
  }
  return getAnchoredEventPopoverPosition({
    anchor: anchorRect,
    panel,
    viewport,
  })
}

/** Fallback anchor when opening via keyboard shortcut. */
export function centeredAnchorRectFromElement(element: HTMLElement): DOMRect {
  const rect = element.getBoundingClientRect()
  const width = Math.min(160, rect.width * 0.3)
  const height = 48
  return new DOMRect(
    rect.left + rect.width / 2 - width / 2,
    rect.top + rect.height / 2 - height / 2,
    width,
    height,
  )
}
