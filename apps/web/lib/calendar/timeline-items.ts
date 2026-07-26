import type {
  CalendarColor,
  CalendarDisplayEvent,
  CalendarEventRow,
  CalendarLinkedTask,
  CalendarRow,
  TaskDueChip,
} from "@planevo/core/types/calendar";
import { isLinkedTaskComplete } from "./task-linked-events.ts";
import { calendarEventDisplayRange } from "./calendar-event-display-range.ts";

const MINIMUM_EVENT_DURATION_MS = 60_000;

export type TimelineEventItem = {
  kind: "event";
  id: string;
  title: string;
  start: Date;
  end: Date;
  originalStart: Date;
  originalEnd: Date;
  durationMinutes: number;
  eventId: string;
  calendarId: string;
  calendarColor: CalendarColor;
  source: CalendarEventRow["source"];
  isReadOnly: boolean;
  allDay: boolean;
  linkedTask: CalendarLinkedTask | null;
  isTaskComplete: boolean;
  event: CalendarDisplayEvent;
};

export type TimelineTaskItem = {
  kind: "task";
  id: string;
  title: string;
  start: Date;
  end: Date;
  durationMinutes: 0;
  taskId: string;
  dueAt: Date;
  completed: boolean;
  toggle: {
    taskId: string;
    nextCompleted: boolean;
  };
  task: TaskDueChip;
};

export type TimelineItem = TimelineEventItem | TimelineTaskItem;

export type LocalDayWindow = {
  start: Date;
  end: Date;
};

function isValidDate(date: Date): boolean {
  return Number.isFinite(date.getTime());
}

function isCompletedTaskStatus(status: string): boolean {
  return status === "done" || status === "cancelled";
}

/**
 * Local calendar days are not always 24 hours at DST boundaries. Date calendar
 * arithmetic preserves the user's wall-clock day instead of assuming 86,400s.
 */
export function localDayWindow(day: Date): LocalDayWindow | null {
  if (!isValidDate(day)) return null;

  const start = new Date(day);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

function normalizedEventRange(
  event: Pick<
    CalendarEventRow,
    "starts_at" | "ends_at" | "all_day" | "source"
  >,
): { start: Date; end: Date } | null {
  const displayRange = calendarEventDisplayRange(event);
  if (!displayRange) return null;
  const { start, end: parsedEnd } = displayRange;

  const end =
    parsedEnd.getTime() > start.getTime()
      ? parsedEnd
      : new Date(start.getTime() + MINIMUM_EVENT_DURATION_MS);

  return { start, end };
}

export function eventToTimelineItem({
  event,
  calendarColor,
  day,
}: {
  event: CalendarDisplayEvent;
  calendarColor: CalendarColor;
  day: Date;
}): TimelineEventItem | null {
  const window = localDayWindow(day);
  const range = normalizedEventRange(event);
  if (!window || !range) return null;
  if (range.start >= window.end || range.end <= window.start) return null;

  const start = new Date(
    Math.max(range.start.getTime(), window.start.getTime()),
  );
  const end = new Date(Math.min(range.end.getTime(), window.end.getTime()));

  return {
    kind: "event",
    id: `event:${event.id}`,
    title: event.linked_task?.title ?? event.title,
    start,
    end,
    originalStart: range.start,
    originalEnd: range.end,
    durationMinutes: Math.max(
      (end.getTime() - start.getTime()) / MINIMUM_EVENT_DURATION_MS,
      0,
    ),
    eventId: event.id,
    calendarId: event.calendar_id,
    calendarColor,
    source: event.source,
    isReadOnly: event.source !== "planevo",
    allDay: event.all_day,
    linkedTask: event.linked_task,
    isTaskComplete: isLinkedTaskComplete(event.linked_task),
    event,
  };
}

export function taskDueToTimelineItem({
  task,
  day,
}: {
  task: TaskDueChip;
  day: Date;
}): TimelineTaskItem | null {
  const window = localDayWindow(day);
  const dueAt = new Date(task.dueAt);
  if (
    !window ||
    !isValidDate(dueAt) ||
    dueAt < window.start ||
    dueAt >= window.end
  ) {
    return null;
  }

  const completed = isCompletedTaskStatus(task.status);

  return {
    kind: "task",
    id: `task:${task.taskId}`,
    title: task.title,
    start: dueAt,
    end: dueAt,
    durationMinutes: 0,
    taskId: task.taskId,
    dueAt,
    completed,
    toggle: {
      taskId: task.taskId,
      nextCompleted: !completed,
    },
    task,
  };
}

function timelineSortGroup(item: TimelineItem): number {
  if (item.kind === "event" && item.allDay) return 0;
  return 1;
}

function timelineTieBreakGroup(item: TimelineItem): number {
  if (item.kind === "event") return 0;
  return item.completed ? 2 : 1;
}

/** Stable visual order: all-day events, then chronological timed content. */
export function sortTimelineItems(items: TimelineItem[]): TimelineItem[] {
  return [...items].sort((left, right) => {
    const groupDelta = timelineSortGroup(left) - timelineSortGroup(right);
    if (groupDelta !== 0) return groupDelta;

    const startDelta = left.start.getTime() - right.start.getTime();
    if (startDelta !== 0) return startDelta;

    const tieBreakDelta =
      timelineTieBreakGroup(left) - timelineTieBreakGroup(right);
    if (tieBreakDelta !== 0) return tieBreakDelta;

    const endDelta = left.end.getTime() - right.end.getTime();
    if (endDelta !== 0) return endDelta;

    return (
      left.title.localeCompare(right.title) || left.id.localeCompare(right.id)
    );
  });
}

/**
 * Narrows a renderer-agnostic pool to one local day without mutating the
 * upstream query payloads. Event ranges are clipped to the rendered day.
 */
export function toTimelineItems(
  events: CalendarDisplayEvent[],
  taskDues: TaskDueChip[],
  calendars: CalendarRow[],
  day: Date,
): TimelineItem[] {
  if (!localDayWindow(day)) return [];

  const visibleCalendars = new Map(
    calendars
      .filter((calendar) => calendar.is_visible)
      .map((calendar) => [calendar.id, calendar.color] as const),
  );

  const eventItems = events.flatMap((event) => {
    const calendarColor = visibleCalendars.get(event.calendar_id);
    if (!calendarColor) return [];

    const item = eventToTimelineItem({ event, calendarColor, day });
    return item ? [item] : [];
  });

  const taskItems = taskDues.flatMap((task) => {
    const item = taskDueToTimelineItem({ task, day });
    return item ? [item] : [];
  });

  return sortTimelineItems([...eventItems, ...taskItems]);
}

/** Re-filter an existing adapter result when the selected local day changes. */
export function timelineItemsForCalendarDay(
  items: TimelineItem[],
  day: Date,
): TimelineItem[] {
  return sortTimelineItems(
    items.flatMap((item) => {
      const next =
        item.kind === "event"
          ? eventToTimelineItem({
              event: item.event,
              calendarColor: item.calendarColor,
              day,
            })
          : taskDueToTimelineItem({ task: item.task, day });
      return next ? [next] : [];
    }),
  );
}
