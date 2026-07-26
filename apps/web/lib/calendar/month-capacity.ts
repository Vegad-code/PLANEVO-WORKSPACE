/**
 * Capacity arithmetic for the month grid, kept pure so it can be tested without
 * a DOM. `use-month-capacity` supplies the measured height and the raw token
 * strings; everything else happens here.
 */

/**
 * Converts a CSS length token to pixels.
 *
 * `getComputedStyle().getPropertyValue()` returns custom properties *as
 * authored* — "1.5rem", not "24px" — because custom properties are substituted
 * before they are resolved. Parsing one as a bare number silently yields 1.5,
 * which is why this conversion is explicit. Only `px` and `rem` are supported,
 * which is all the month tokens use; anything else returns null so the caller
 * can fall back rather than compute a nonsense capacity.
 */
export function cssLengthToPixels(
  value: string,
  rootFontSizePx: number,
): number | null {
  const trimmed = value.trim()
  const numeric = Number.parseFloat(trimmed)
  if (!Number.isFinite(numeric)) return null
  if (trimmed.endsWith("rem")) return numeric * rootFontSizePx
  if (trimmed.endsWith("px")) return numeric
  // A unitless zero is the one bare number CSS allows for a length.
  if (numeric === 0) return 0
  return null
}

export type MonthCapacityInput = {
  bodyHeightPx: number
  rowCount: number
  dateHeaderPx: number
  cellPaddingPx: number
  itemRowPx: number
}

/**
 * How many item rows fit in one day cell.
 *
 * Rows are `1fr` tracks, so dividing the measured body height by the row count
 * gives the true per-row height for the month actually rendered — no per-week
 * measurement and no dummy row. Returns null when the inputs cannot produce a
 * meaningful answer, so the caller keeps its current value instead of
 * collapsing the grid.
 */
export function resolveMonthCapacity({
  bodyHeightPx,
  rowCount,
  dateHeaderPx,
  cellPaddingPx,
  itemRowPx,
}: MonthCapacityInput): number | null {
  if (rowCount <= 0 || bodyHeightPx <= 0 || itemRowPx <= 0) return null

  const rowHeight = bodyHeightPx / rowCount
  const usable = rowHeight - dateHeaderPx - cellPaddingPx * 2
  return Math.max(Math.floor(usable / itemRowPx), 1)
}
