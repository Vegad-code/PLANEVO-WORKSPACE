/**
 * Fractional ordering for records, pages, properties, and views. Positions are
 * `double precision`; a new position is the midpoint between its neighbours, so
 * a reorder rewrites one row instead of the whole list.
 *
 * dnd-kit id-namespacing convention for this repo (multiple DndContexts coexist,
 * so ids must not collide across contexts):
 *   - `col:{id}`  — board/table column droppables and header reorder
 *   - `sort:{id}` — sort-editor draggable rows
 *   - `page:{id}` — sidebar page tree nodes
 *   - board card ids are bare (the record id, no prefix)
 */

/** Midpoint between two neighbours. null = that end of the list is open. */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 0;
  if (after === null) return before! + 1; // append
  if (before === null) return after - 1; // prepend
  return (before + after) / 2; // midpoint
}

/** True when the gap between neighbours is too small to split cleanly. */
export function needsRebalance(before: number | null, after: number | null): boolean {
  if (before === null || after === null) return false;
  return Math.abs(after - before) < 1e-6;
}

/** Evenly spaced positions 1..count for a full sibling rewrite. */
export function rebalanced(count: number): number[] {
  const result: number[] = [];
  for (let i = 1; i <= count; i += 1) result.push(i);
  return result;
}
