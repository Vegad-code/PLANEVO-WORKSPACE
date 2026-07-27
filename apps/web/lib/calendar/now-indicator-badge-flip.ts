/** Approximate rendered height of the now-badge pill (px). */
export const NOW_INDICATOR_BADGE_HEIGHT_PX = 20

/**
 * When the now line sits within one badge height of the grid top, the default
 * above-line placement clips into the day header — flip below the line instead.
 */
export function shouldFlipNowIndicatorBadge({
  percentTop,
  containerHeightPx,
  badgeHeightPx = NOW_INDICATOR_BADGE_HEIGHT_PX,
}: {
  percentTop: number
  containerHeightPx: number
  badgeHeightPx?: number
}): boolean {
  if (containerHeightPx <= 0 || badgeHeightPx <= 0) return false
  const topPx = (percentTop / 100) * containerHeightPx
  return topPx < badgeHeightPx
}
