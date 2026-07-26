import type { ViewConfig } from "./view-config.ts";
import { localDayWindow } from "./timeline-items.ts";

export const TIMELINE_SLOT_MINUTES = 30;
const TIMELINE_SLOT_MS = TIMELINE_SLOT_MINUTES * 60_000;

export type TimelineAxis = {
  start: Date;
  end: Date;
};

export type TimelineAxisItem =
  | { kind: "task"; start: Date; end: Date }
  | { kind: "event"; allDay: boolean; start: Date; end: Date };

export function timelineAxis({
  day,
  items,
  mode,
}: {
  day: Date;
  items: TimelineAxisItem[];
  mode: ViewConfig["timeAxis"]["mode"];
}): TimelineAxis | null {
  const dayWindow = localDayWindow(day);
  if (!dayWindow) return null;

  const timedItems = items.filter(
    (item) => item.kind === "task" || !item.allDay,
  );
  if (
    mode === "fixed-24h" ||
    mode === "none" ||
    timedItems.length === 0
  ) {
    return dayWindow;
  }

  const firstStart = Math.min(
    ...timedItems.map((item) => item.start.getTime()),
  );
  const lastEnd = Math.max(
    ...timedItems.map((item) =>
      Math.max(item.end.getTime(), item.start.getTime() + TIMELINE_SLOT_MS),
    ),
  );
  const padding = mode === "cropped-working-hours" ? TIMELINE_SLOT_MS : 0;
  const start = Math.max(dayWindow.start.getTime(), firstStart - padding);
  const end = Math.min(dayWindow.end.getTime(), lastEnd + padding);

  return {
    start: new Date(start),
    end: new Date(Math.max(end, start + TIMELINE_SLOT_MS)),
  };
}

export function timelineAxisSlots(
  axis: TimelineAxis,
): Array<{ start: Date; end: Date }> {
  const slots: Array<{ start: Date; end: Date }> = [];
  for (
    let slotStart = axis.start.getTime();
    slotStart < axis.end.getTime();
    slotStart += TIMELINE_SLOT_MS
  ) {
    slots.push({
      start: new Date(slotStart),
      end: new Date(
        Math.min(slotStart + TIMELINE_SLOT_MS, axis.end.getTime()),
      ),
    });
  }
  return slots;
}
