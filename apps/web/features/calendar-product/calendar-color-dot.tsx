import type { CalendarColor } from "@planevo/core/types/calendar";

/* Static class maps so Tailwind sees every literal (no template class names). */

export const CALENDAR_COLOR_DOT_CLASS: Record<CalendarColor, string> = {
  slate: "bg-slate",
  marigold: "bg-marigold",
  meadow: "bg-meadow",
  brick: "bg-brick",
  ocean: "bg-ocean",
};

export const CALENDAR_COLOR_BLOCK_CLASS: Record<CalendarColor, string> = {
  slate: "bg-slate-tint",
  marigold: "bg-marigold-tint",
  meadow: "bg-meadow-tint",
  brick: "bg-brick-tint",
  ocean: "bg-ocean-tint",
};

export const CALENDAR_EVENT_BLOCK_CLASS: Record<CalendarColor, string> = {
  slate: "calendar-event-block--slate",
  marigold: "calendar-event-block--marigold",
  meadow: "calendar-event-block--meadow",
  brick: "calendar-event-block--brick",
  ocean: "calendar-event-block--ocean",
};

export const CALENDAR_COLOR_BORDER_CLASS: Record<CalendarColor, string> = {
  slate: "border-slate",
  marigold: "border-marigold",
  meadow: "border-meadow",
  brick: "border-brick",
  ocean: "border-ocean",
};

export function CalendarColorDot({ color }: { color: CalendarColor }) {
  return (
    <span
      aria-hidden="true"
      className={`size-2.5 shrink-0 rounded-full ${CALENDAR_COLOR_DOT_CLASS[color]}`}
    />
  );
}
