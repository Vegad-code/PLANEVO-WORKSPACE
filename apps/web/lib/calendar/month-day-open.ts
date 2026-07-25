/** Explicit Month entry points that both transition into Calendar Day view. */
export function openMonthDayFromAgenda(
  date: Date,
  onOpenDay: (date: Date) => void,
): void {
  onOpenDay(date)
}

export function openMonthDayFromCell(
  date: Date,
  onOpenDay: (date: Date) => void,
): void {
  onOpenDay(date)
}
