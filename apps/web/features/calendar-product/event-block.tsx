"use client";

import type {
  CalendarColor,
  CalendarEventRow,
} from "@planevo/core/types/calendar";
import { CALENDAR_COLOR_BORDER_CLASS } from "./calendar-color-dot";
import { eventBlockPosition, formatTimeLabel } from "./time-axis";

type EventBlockProps = {
  event: CalendarEventRow;
  color: CalendarColor;
  onSelect?: (event: CalendarEventRow, anchor: HTMLElement) => void;
};

export function EventBlock({ event, color, onSelect }: EventBlockProps) {
  const { topPercent, heightPercent } = eventBlockPosition(
    event.starts_at,
    event.ends_at,
  );
  const start = new Date(event.starts_at);
  const end = new Date(event.ends_at);
  const timeLabel = `${formatTimeLabel(start)} - ${formatTimeLabel(end)}`;

  return (
    <button
      type="button"
      onClick={(clickEvent) => onSelect?.(event, clickEvent.currentTarget)}
      style={{ top: `${topPercent}%`, height: `${heightPercent}%` }}
      className={`calendar-event-glass absolute inset-x-0.5 z-10 flex flex-col overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left outline-none focus-visible:outline focus-visible:outline-offset-1 focus-visible:outline-ink ${CALENDAR_COLOR_BORDER_CLASS[color]}`}
    >
      <span className="truncate text-product-meta text-text-secondary">
        {timeLabel}
      </span>
      <span className="truncate text-product-meta font-medium text-ink">
        {event.title}
      </span>
    </button>
  );
}
