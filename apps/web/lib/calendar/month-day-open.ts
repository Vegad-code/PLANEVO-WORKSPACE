/** Explicit Month entry points that both transition into Calendar Day view. */
export function openMonthDayFromAgenda(
  date: Date,
  onOpenDay: (date: Date) => void,
): void {
  onOpenDay(date)
}

/** Month grid date number — GCal opens Day view on single click. */
export function openMonthDayFromCell(
  date: Date,
  onOpenDay: (date: Date) => void,
): void {
  onOpenDay(date)
}
