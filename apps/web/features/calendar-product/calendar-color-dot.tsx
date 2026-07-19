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

export function CalendarColorDot({ color }: { color: CalendarColor }) {
  return (
    <span
      aria-hidden="true"
      className={`size-2.5 shrink-0 rounded-full ${CALENDAR_COLOR_DOT_CLASS[color]}`}
    />
  );
}
