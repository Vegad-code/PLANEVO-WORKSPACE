/**
 * Shared calendar view + range helpers, usable on the server (loader) and the
 * client (grid). The visible range drives which events the server loads, so the
 * range here must match what react-big-calendar renders for each view.
 * Weeks are Sunday-start to mirror Google Calendar.
 */

export type CalendarView = "day" | "week" | "month" | "year";

const VIEWS = new Set<CalendarView>(["day", "week", "month", "year"]);

export function parseCalendarView(value?: string): CalendarView {
  return value && VIEWS.has(value as CalendarView)
    ? (value as CalendarView)
    : "week";
}

export function parseCalendarDate(value?: string): Date {
  if (!value) return new Date();
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/** `YYYY-MM-DD` in local time — the `?date=` URL param. */
export function dateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfWeekSunday(date: Date): Date {
  const start = startOfDay(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

/** The event window the server must load for a given view + anchor date. */
export function calendarRange(
  view: CalendarView,
  date: Date,
): { start: Date; end: Date } {
  if (view === "day") {
    const start = startOfDay(date);
    return { start, end: addDays(start, 1) };
  }
  if (view === "year") {
    const start = new Date(date.getFullYear(), 0, 1);
    const end = new Date(date.getFullYear() + 1, 0, 1);
    return { start, end };
  }
  if (view === "month") {
    const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const start = startOfWeekSunday(firstOfMonth);
    // Month grid is always 6 weeks incl. leading/trailing days.
    return { start, end: addDays(start, 42) };
  }
  const start = startOfWeekSunday(date);
  return { start, end: addDays(start, 7) };
}
