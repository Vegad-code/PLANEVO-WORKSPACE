/**
 * Side-docked placement for the calendar custom-color wheel.
 *
 * Prefer a horizontal side of the event card (or trigger fallback) so the
 * wheel never covers title/time fields. Flip when the preferred side overflows;
 * on narrow viewports, dock below instead of overlapping the card.
 */

export const COLOR_WHEEL_VIEWPORT_MARGIN_PX = 12
export const COLOR_WHEEL_PANEL_GAP_REM = 0.75
export const COLOR_WHEEL_SIZE_REM = 10
export const COLOR_WHEEL_NARROW_MAX_WIDTH_PX = 767

type Rectangle = Pick<DOMRect, "left" | "top" | "width" | "height">

export type ColorWheelPlacement = "left" | "right" | "below" | "above"

export type ColorWheelPosition = {
  top: number
  left: number
  placement: ColorWheelPlacement
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

export function getColorWheelPanelGapPx(remPx: number): number {
  if (!Number.isFinite(remPx) || remPx <= 0) return 12
  return COLOR_WHEEL_PANEL_GAP_REM * remPx
}

export function getColorWheelSizePx(remPx: number): number {
  if (!Number.isFinite(remPx) || remPx <= 0) return 160
  return COLOR_WHEEL_SIZE_REM * remPx
}

/**
 * Layout box for dock math. Prefer offsetWidth/Height so enter-animation
 * transforms (scale) cannot shrink the measured size and collapse the gap
 * once the animation settles — getBoundingClientRect includes transforms.
 */
export function readColorWheelPanelSize(
  panel: HTMLElement | null,
): Rectangle | null {
  if (!panel) return null
  const width = panel.offsetWidth
  const height = panel.offsetHeight
  if (width > 0 && height > 0) {
    return { left: 0, top: 0, width, height }
  }
  const rect = panel.getBoundingClientRect()
  if (!(rect.width > 0 && rect.height > 0)) return null
  return { left: 0, top: 0, width: rect.width, height: rect.height }
}

function verticallyCenter({
  anchor,
  panelHeight,
  viewportHeight,
  margin,
}: {
  anchor: Pick<DOMRect, "top" | "height">
  panelHeight: number
  viewportHeight: number
  margin: number
}): number {
  const maxTop = Math.max(margin, viewportHeight - panelHeight - margin)
  const top = anchor.top + anchor.height / 2 - panelHeight / 2
  return clamp(top, margin, maxTop)
}

/** Prefer the side with more free space; flip when that side overflows. */
export function getSideDockedColorWheelPosition({
  anchor,
  panel,
  viewport,
  gapPx,
  preferredSide,
}: {
  anchor: Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">
  panel: Rectangle
  viewport: { width: number; height: number }
  gapPx: number
  /** When set, wins over auto roominess (used to avoid the event callout beak). */
  preferredSide?: "left" | "right" | null
}): ColorWheelPosition {
  const margin = COLOR_WHEEL_VIEWPORT_MARGIN_PX
  const gap = Number.isFinite(gapPx) && gapPx >= 0 ? gapPx : 12

  const rightLeft = anchor.right + gap
  const leftLeft = anchor.left - gap - panel.width
  const rightFits = rightLeft + panel.width <= viewport.width - margin
  const leftFits = leftLeft >= margin

  // Neither side clears the viewport — dock below/above so we never cover the card.
  if (!rightFits && !leftFits) {
    return getBelowDockedColorWheelPosition({
      anchor,
      panel,
      viewport,
      gapPx: gap,
    })
  }

  const spaceRight = viewport.width - margin - anchor.right
  const spaceLeft = anchor.left - margin
  const preferRight =
    preferredSide === "right"
      ? true
      : preferredSide === "left"
        ? false
        : spaceRight >= spaceLeft

  let left = preferRight ? rightLeft : leftLeft
  let placement: ColorWheelPlacement = preferRight ? "right" : "left"

  if (preferRight && !rightFits && leftFits) {
    left = leftLeft
    placement = "left"
  } else if (!preferRight && !leftFits && rightFits) {
    left = rightLeft
    placement = "right"
  }

  return {
    top: verticallyCenter({
      anchor,
      panelHeight: panel.height,
      viewportHeight: viewport.height,
      margin,
    }),
    left,
    placement,
  }
}

/** Narrow / side-fail: dock below the card; flip above when the bottom overflows. */
export function getBelowDockedColorWheelPosition({
  anchor,
  panel,
  viewport,
  gapPx,
}: {
  anchor: Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">
  panel: Rectangle
  viewport: { width: number; height: number }
  gapPx: number
}): ColorWheelPosition {
  const margin = COLOR_WHEEL_VIEWPORT_MARGIN_PX
  const gap = Number.isFinite(gapPx) && gapPx >= 0 ? gapPx : 12
  const maxLeft = Math.max(margin, viewport.width - panel.width - margin)

  const belowTop = anchor.bottom + gap
  const aboveTop = anchor.top - gap - panel.height
  const belowFits = belowTop + panel.height <= viewport.height - margin
  const aboveFits = aboveTop >= margin

  let top: number
  let placement: ColorWheelPlacement

  if (belowFits) {
    top = belowTop
    placement = "below"
  } else if (aboveFits) {
    top = aboveTop
    placement = "above"
  } else {
    // Neither fully fits — still clear the anchor (allow viewport overflow)
    // rather than clamping into the card.
    const spaceBelow = viewport.height - margin - anchor.bottom
    const spaceAbove = anchor.top - margin
    if (spaceBelow >= spaceAbove) {
      top = belowTop
      placement = "below"
    } else {
      top = aboveTop
      placement = "above"
    }
  }

  return {
    top,
    left: clamp(
      anchor.left + anchor.width / 2 - panel.width / 2,
      margin,
      maxLeft,
    ),
    placement,
  }
}

export function getColorWheelPosition({
  anchor,
  panel,
  viewport,
  gapPx,
  isNarrow,
  preferredSide = null,
}: {
  anchor: Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">
  panel: Rectangle
  viewport: { width: number; height: number }
  gapPx: number
  isNarrow: boolean
  preferredSide?: "left" | "right" | null
}): ColorWheelPosition {
  if (isNarrow) {
    return getBelowDockedColorWheelPosition({
      anchor,
      panel,
      viewport,
      gapPx,
    })
  }
  return getSideDockedColorWheelPosition({
    anchor,
    panel,
    viewport,
    gapPx,
    preferredSide,
  })
}

/**
 * Event popovers put their callout beak on the side facing the grid event.
 * Prefer docking the color wheel on the opposite (outer) side.
 */
export function preferredColorWheelSideForAnchor(
  anchor: HTMLElement | null,
): "left" | "right" | null {
  if (!anchor) return null
  const placement = anchor.getAttribute("data-placement")
  if (placement === "right") return "right"
  if (placement === "left") return "left"
  return null
}

/**
 * Prefer the event popover / explicit anchor so the wheel docks beside the
 * card chrome — not an inset `.event-card-surface` that would overlap the shell.
 */
export function resolveColorWheelAnchorElement(
  trigger: HTMLElement | null,
): HTMLElement | null {
  if (!trigger) return null
  const card = trigger.closest<HTMLElement>(
    "[data-event-detail-popover], [data-color-wheel-anchor], [role='dialog']",
  )
  return card ?? trigger
}
