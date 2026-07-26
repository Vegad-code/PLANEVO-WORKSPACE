/** Full-day window like Google Calendar: 12 AM through 11 PM (24 hours). */
export const DAY_START_HOUR = 0;
export const DAY_END_HOUR = 24;

/** Fallback scroll target (hour) when today isn't in the visible range. */
export const DEFAULT_SCROLL_HOUR = 8;

/**
 * Minimum row heights (rem). Rows are `flex-1` so they stretch to fill a tall
 * pane (no gap); on a short pane they hold this minimum and the grid scrolls,
 * bottoming out exactly at midnight (no void below 11 PM).
 */
export const HOUR_MIN_REM = 4.5;
export const SLOT_MIN_REM = HOUR_MIN_REM / 2;

export const VISIBLE_HOURS = DAY_END_HOUR - DAY_START_HOUR;

export function formatHourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  if (hour === 24) return "12 AM";
  return `${hour - 12} PM`;
}

export function formatTimeLabel(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export { formatNowIndicatorTime } from "@/lib/calendar/format-now-indicator-time";

export { formatCompactMonthTime } from "@/lib/calendar/format-compact-month-time";

/** Hours from the start of the day window, clamped to [0, VISIBLE_HOURS]. */
export function hoursIntoDayWindow(date: Date): number {
  const hoursIntoWindow =
    date.getHours() + date.getMinutes() / 60 - DAY_START_HOUR;
  return Math.min(Math.max(hoursIntoWindow, 0), VISIBLE_HOURS);
}

/** Percent offset from the top of the grid for a moment within the day. */
export function percentOffsetForTime(date: Date): number {
  return (hoursIntoDayWindow(date) / VISIBLE_HOURS) * 100;
}

export type EventBlockPosition = { topPercent: number; heightPercent: number };

/** Absolute block geometry for an event, as % of the full-day grid. */
export function eventBlockPosition(
  startsAt: string,
  endsAt: string,
): EventBlockPosition {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const topPercent = percentOffsetForTime(start);
  const bottomPercent = percentOffsetForTime(end);
  // Events shorter than 30 minutes still get a readable block (~half hour).
  const minHeightPercent = (0.5 / VISIBLE_HOURS) * 100;
  const heightPercent = Math.max(bottomPercent - topPercent, minHeightPercent);
  return { topPercent, heightPercent };
}

export function TimeAxis({ className }: { className?: string }) {
  const hours = Array.from(
    { length: VISIBLE_HOURS },
    (_, index) => DAY_START_HOUR + index,
  )

  return (
    <div
      aria-hidden="true"
      className={`flex min-h-full shrink-0 flex-col border-r border-border bg-surface-raised pl-2 pr-1 ${className ?? "w-20"}`}
    >
      {hours.map((hour) => (
        <div
          key={hour}
          style={{ minHeight: `${HOUR_MIN_REM}rem` }}
          className="relative flex-1"
        >
          <span className="absolute top-1 right-2 leading-none text-product-meta font-normal tabular-nums text-text-muted">
            {formatHourLabel(hour)}
          </span>
        </div>
      ))}
    </div>
  )
}
