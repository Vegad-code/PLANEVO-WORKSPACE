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

/** Inclusive Monday start / exclusive next-Monday end for the anchor's week. */
export function weekRange(anchor: Date): { start: Date; end: Date } {
  const start = new Date(anchor);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

/** "YYYY-Www" label for the week containing `anchor` (e.g. "2026-W29"). */
export function weekParam(anchor: Date): string {
  const { start } = weekRange(anchor);
  const year = start.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const week = Math.ceil(
    ((start.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7,
  );
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Parses "YYYY-Www" into the Monday of that week; null when malformed. */
export function parseWeekParam(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  // The Monday nearest `(week - 1) * 7` days into the year is either the
  // target week's Monday or one week early, depending on Jan 1's weekday —
  // check against weekParam and correct.
  const monday = weekRange(new Date(year, 0, 1 + (week - 1) * 7)).start;
  if (weekParam(monday) === value) return monday;
  const corrected = addWeeks(monday, 1);
  return weekParam(corrected) === value ? corrected : null;
}

export function addWeeks(anchor: Date, offset: number): Date {
  const result = new Date(anchor);
  result.setDate(result.getDate() + offset * 7);
  return result;
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
