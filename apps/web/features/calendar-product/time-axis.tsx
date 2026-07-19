/** Visible day window (design spec: 6am–10pm, configurable constants). */
export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 22;

/** One hour of grid height, in rem (h-14). Slot cells are half this (h-7). */
export const HOUR_HEIGHT_REM = 3.5;

export const VISIBLE_HOURS = DAY_END_HOUR - DAY_START_HOUR;
export const GRID_HEIGHT_REM = VISIBLE_HOURS * HOUR_HEIGHT_REM;

export function formatHourLabel(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

export function formatTimeLabel(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Rem offset from the top of the grid for a moment within the day window. */
export function remOffsetForTime(date: Date): number {
  const hoursIntoWindow =
    date.getHours() + date.getMinutes() / 60 - DAY_START_HOUR;
  const clamped = Math.min(Math.max(hoursIntoWindow, 0), VISIBLE_HOURS);
  return clamped * HOUR_HEIGHT_REM;
}

export type EventBlockPosition = { topRem: number; heightRem: number };

/** Absolute block geometry for an event, clamped to the visible window. */
export function eventBlockPosition(
  startsAt: string,
  endsAt: string,
): EventBlockPosition {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const topRem = remOffsetForTime(start);
  const bottomRem = remOffsetForTime(end);
  // Events shorter than 30 minutes still get a readable block.
  const heightRem = Math.max(bottomRem - topRem, HOUR_HEIGHT_REM / 2);
  return { topRem, heightRem };
}

export function TimeAxis() {
  const hours = Array.from(
    { length: VISIBLE_HOURS },
    (_, index) => DAY_START_HOUR + index,
  );

  return (
    <div aria-hidden="true" className="flex w-14 shrink-0 flex-col">
      {hours.map((hour) => (
        <div
          key={hour}
          style={{ height: `${HOUR_HEIGHT_REM}rem` }}
          className="relative"
        >
          <span className="absolute -top-2 right-2 text-product-meta text-text-muted">
            {formatHourLabel(hour)}
          </span>
        </div>
      ))}
    </div>
  );
}
