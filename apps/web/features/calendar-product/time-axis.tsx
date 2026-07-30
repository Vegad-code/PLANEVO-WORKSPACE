import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  DEFAULT_SCROLL_HOUR,
  eventBlockPosition,
  hoursIntoDayWindow,
  MIN_EVENT_BLOCK_HEIGHT_PERCENT,
  percentOffsetForTime,
  VISIBLE_HOURS,
  type EventBlockPosition,
} from "@/lib/calendar/event-block-position";

export {
  DAY_END_HOUR,
  DAY_START_HOUR,
  DEFAULT_SCROLL_HOUR,
  eventBlockPosition,
  hoursIntoDayWindow,
  MIN_EVENT_BLOCK_HEIGHT_PERCENT,
  percentOffsetForTime,
  VISIBLE_HOURS,
  type EventBlockPosition,
};

/**
 * Minimum row heights (rem). Rows are `flex-1` so they stretch to fill a tall
 * pane (no gap); on a short pane they hold this minimum and the grid scrolls,
 * bottoming out exactly at midnight (no void below 11 PM).
 */
export const HOUR_MIN_REM = 4.5;
/** One GCal snap slot (15 min) — hour group stays HOUR_MIN_REM. */
export const SLOT_MIN_REM = HOUR_MIN_REM / 4;

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
