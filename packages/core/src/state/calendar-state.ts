/** Local-timezone YYYY-MM-DD key for a date. */
export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parses "YYYY-MM" into the first of that month; null when malformed. */
export function parseMonthParam(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
}

export function monthParam(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function addMonths(month: Date, offset: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + offset, 1);
}

/** The 42-cell (6-week) grid shown for a month, starting on Sunday. */
export function calendarDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

/** Inclusive start / exclusive end covering every cell of the month grid. */
export function calendarRange(month: Date): { start: Date; end: Date } {
  const days = calendarDays(month);
  const start = days[0]!;
  const end = new Date(days[days.length - 1]!);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function groupByDay<T extends { date: string }>(items: T[]): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const item of items) {
    const parsed = new Date(item.date);
    if (Number.isNaN(parsed.getTime())) continue;
    const key = dateKey(parsed);
    result.set(key, [...(result.get(key) ?? []), item]);
  }
  return result;
}
