/** RBC Selection emits page-space bounds without width/height — normalize for fixed UI. */
export function normalizeSlotAnchorRect(source: {
  top: number
  left: number
  right?: number
  bottom?: number
  width?: number
  height?: number
}): DOMRect {
  const width =
    typeof source.width === "number" && Number.isFinite(source.width)
      ? Math.max(1, source.width)
      : typeof source.right === "number"
        ? Math.max(1, source.right - source.left)
        : 1
  const height =
    typeof source.height === "number" && Number.isFinite(source.height)
      ? Math.max(1, source.height)
      : typeof source.bottom === "number"
        ? Math.max(1, source.bottom - source.top)
        : 40

  const left = source.left - (typeof window !== "undefined" ? window.scrollX : 0)
  const top = source.top - (typeof window !== "undefined" ? window.scrollY : 0)

  return new DOMRect(left, top, width, height)
}
