import type {
  CalendarEventRow,
  CalendarViewRow,
  TaskDueChip,
} from "@planevo/core/types/calendar";

type SelectableCalendarView = Pick<
  CalendarViewRow,
  "id" | "is_default" | "position"
>;

type CalendarViewFilter = Pick<
  CalendarViewRow,
  "source_calendar_ids" | "include_task_dues"
>;

export type SavedViewToolbarView = "day" | "week" | "month" | "year";

/** Null is the deliberate built-in Classic fallback, not an empty state. */
export function initialCalendarViewId(
  views: SelectableCalendarView[],
): string | null {
  const ordered = [...views].sort(
    (left, right) =>
      left.position - right.position || left.id.localeCompare(right.id),
  );
  return (
    ordered.find(({ is_default }) => is_default)?.id ?? ordered[0]?.id ?? null
  );
}

export function nextCalendarViewIdAfterDelete(
  views: SelectableCalendarView[],
  deletedViewId: string,
): string | null {
  return initialCalendarViewId(views.filter(({ id }) => id !== deletedViewId));
}

export function toolbarViewForSavedConfig({
  dayCount,
}: {
  dayCount: number | "month" | "year";
}): SavedViewToolbarView {
  if (dayCount === "month" || dayCount === "year") return dayCount;
  return dayCount === 1 ? "day" : "week";
}

/**
 * Saved-view sources are a render filter only. Callers retain the complete
 * event pool for conflict checks, free/busy, and auto-placement.
 */
export function filterCalendarViewContent<
  Event extends Pick<CalendarEventRow, "calendar_id">,
  Due extends TaskDueChip,
>({
  events,
  taskDues,
  view,
}: {
  events: Event[];
  taskDues: Due[];
  view: CalendarViewFilter | null;
}): { events: Event[]; taskDues: Due[] } {
  if (!view) return { events, taskDues };

  const sourceIds = new Set(view.source_calendar_ids);
  return {
    events:
      sourceIds.size === 0
        ? events
        : events.filter(({ calendar_id }) => sourceIds.has(calendar_id)),
    taskDues: view.include_task_dues ? taskDues : [],
  };
}
