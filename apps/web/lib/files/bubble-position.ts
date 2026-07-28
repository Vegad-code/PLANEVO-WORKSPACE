/**
 * Places the selection-anchored formatting toolbar inside its editor container.
 *
 * All inputs are container-relative pixels (caller subtracts the host's bounding rect), so this
 * stays pure and testable. Returns `null` when the geometry cannot be trusted — a caller that
 * gets `null` should keep the toolbar hidden rather than render it somewhere wrong.
 */

export type BubblePlacement = {
  left: number;
  top: number;
  /** "above" is the default; "below" means it flipped because the selection sat near the top. */
  side: "above" | "below";
};

/** Gap between the toolbar and the selection edge, and the minimum inset from the container. */
export const BUBBLE_OFFSET = 12;
export const BUBBLE_MARGIN = 8;

export function placeBubble({
  selectionLeft,
  selectionRight,
  selectionTop,
  selectionBottom,
  toolbarWidth,
  toolbarHeight,
  containerWidth,
  containerHeight,
}: {
  selectionLeft: number;
  selectionRight: number;
  selectionTop: number;
  selectionBottom: number;
  toolbarWidth: number;
  toolbarHeight: number;
  containerWidth: number;
  containerHeight: number;
}): BubblePlacement | null {
  // Before first paint the toolbar measures 0×0 and every position would be wrong.
  if (toolbarWidth <= 0 || toolbarHeight <= 0) return null;
  if (containerWidth <= 0 || containerHeight <= 0) return null;
  if (
    !Number.isFinite(selectionLeft) ||
    !Number.isFinite(selectionRight) ||
    !Number.isFinite(selectionTop) ||
    !Number.isFinite(selectionBottom)
  ) {
    return null;
  }

  const above = selectionTop - toolbarHeight - BUBBLE_OFFSET;
  const below = selectionBottom + BUBBLE_OFFSET;
  // Flip under the selection when there is not enough room over it, but only if flipping
  // actually helps — in a container too short for either, stay above and let it clamp.
  const flip = above < BUBBLE_MARGIN && below + toolbarHeight <= containerHeight;
  const side: BubblePlacement["side"] = flip ? "below" : "above";

  const midpoint = (selectionLeft + selectionRight) / 2;
  const maxLeft = containerWidth - toolbarWidth - BUBBLE_MARGIN;
  const left = clamp(midpoint - toolbarWidth / 2, BUBBLE_MARGIN, maxLeft);
  const maxTop = containerHeight - toolbarHeight - BUBBLE_MARGIN;
  const top = clamp(side === "below" ? below : above, BUBBLE_MARGIN, maxTop);

  return { left, top, side };
}

/**
 * When the container is narrower than the toolbar, `max` falls below `min`; pin to `min` so the
 * toolbar stays reachable from the left edge instead of jumping off the other side.
 */
function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}
