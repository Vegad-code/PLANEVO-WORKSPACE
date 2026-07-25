type Rectangle = Pick<DOMRect, "left" | "bottom" | "width" | "height">

type Viewport = {
  width: number
  height: number
}

const VIEWPORT_MARGIN = 16

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

/** Keep the rendered desktop agenda fully inside the current viewport. */
export function getMonthDayAgendaPosition({
  anchor,
  panel,
  viewport,
}: {
  anchor: Pick<DOMRect, "left" | "bottom"> | null
  panel: Rectangle
  viewport: Viewport
}): { top: number; left: number } {
  const maxTop = Math.max(VIEWPORT_MARGIN, viewport.height - panel.height - VIEWPORT_MARGIN)
  const maxLeft = Math.max(VIEWPORT_MARGIN, viewport.width - panel.width - VIEWPORT_MARGIN)

  return {
    top: clamp(
      (anchor?.bottom ?? VIEWPORT_MARGIN) + (anchor ? VIEWPORT_MARGIN : 0),
      VIEWPORT_MARGIN,
      maxTop,
    ),
    left: clamp(anchor?.left ?? VIEWPORT_MARGIN, VIEWPORT_MARGIN, maxLeft),
  }
}
