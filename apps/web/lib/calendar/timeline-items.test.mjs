import assert from "node:assert/strict";
import test from "node:test";
import {
  eventToTimelineItem,
  localDayWindow,
  sortTimelineItems,
  taskDueToTimelineItem,
  timelineItemsForCalendarDay,
  toTimelineItems,
} from "./timeline-items.ts";

function event(overrides = {}) {
  return {
    id: "event-1",
    calendar_id: "calendar-visible",
    user_id: "user-1",
    title: "Planning",
    starts_at: "2026-07-14T10:00:00.000Z",
    ends_at: "2026-07-14T11:00:00.000Z",
    starts_at_local: null,
    ends_at_local: null,
    timezone: null,
    duration_minutes: 60,
    rrule: null,
    recurrence_end: null,
    parent_event_id: null,
    recurrence_id: null,
    is_exception: false,
    is_cancelled: false,
    deleted_at: null,
    color: null,
    conference_url: null,
    all_day: false,
    location: null,
    description_json: {},
    task_id: null,
    google_event_id: null,
    source: "planevo",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    linked_task: null,
    ...overrides,
  };
}

function task(overrides = {}) {
  return {
    taskId: "task-1",
    title: "Send notes",
    dueAt: "2026-07-14T14:00:00.000Z",
    status: "not_started",
    ...overrides,
  };
}

const calendars = [
  {
    id: "calendar-visible",
    user_id: "user-1",
    name: "Work",
    color: "ocean",
    is_visible: true,
    is_default: true,
    position: 0,
    created_at: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "calendar-hidden",
    user_id: "user-1",
    name: "Hidden",
    color: "brick",
    is_visible: false,
    is_default: false,
    position: 1,
    created_at: "2026-07-01T00:00:00.000Z",
  },
];

const renderedDay = new Date(2026, 6, 14);

test("builds one local day from visible overlapping events and task dues", () => {
  const before = event({
    id: "before",
    starts_at: "2026-07-13T10:00:00.000Z",
    ends_at: "2026-07-13T11:00:00.000Z",
  });
  const spanning = event({
    id: "spanning",
    title: "Spanning",
    starts_at: "2026-07-13T23:00:00.000Z",
    ends_at: "2026-07-14T10:30:00.000Z",
  });
  const hidden = event({
    id: "hidden",
    calendar_id: "calendar-hidden",
  });

  const items = toTimelineItems(
    [before, spanning, hidden],
    [
      task(),
      task({
        taskId: "tomorrow",
        dueAt: "2026-07-15T14:00:00.000Z",
      }),
    ],
    calendars,
    renderedDay,
  );

  assert.deepEqual(
    items.map((item) => item.id),
    ["event:spanning", "task:task-1"],
  );
  assert.equal(items[0].start.getTime(), renderedDay.getTime());
  assert.equal(items[0].end.toISOString(), "2026-07-14T10:30:00.000Z");
});

test("carries event color, task state, read-only, and original row metadata", () => {
  const googleTaskEvent = event({
    id: "ics-task",
    title: "Stale event title",
    source: "ics",
    task_id: "linked-task",
    linked_task: {
      id: "linked-task",
      title: "Current task title",
      status: "done",
      estimateMinutes: 45,
    },
  });

  const item = eventToTimelineItem({
    event: googleTaskEvent,
    calendarColor: "ocean",
    day: renderedDay,
  });

  assert.ok(item);
  assert.equal(item.title, "Current task title");
  assert.equal(item.calendarColor, "ocean");
  assert.equal(item.isReadOnly, true);
  assert.equal(item.isTaskComplete, true);
  assert.equal(item.event, googleTaskEvent);
  assert.equal(item.linkedTask, googleTaskEvent.linked_task);
});

test("normalizes non-positive durations without mutating the event", () => {
  const zeroDuration = event({
    starts_at: "2026-07-14T10:00:00.000Z",
    ends_at: "2026-07-14T10:00:00.000Z",
    duration_minutes: 0,
  });
  const snapshot = structuredClone(zeroDuration);

  const item = eventToTimelineItem({
    event: zeroDuration,
    calendarColor: "ocean",
    day: renderedDay,
  });

  assert.ok(item);
  assert.equal(item.durationMinutes, 1);
  assert.equal(item.end.toISOString(), "2026-07-14T10:01:00.000Z");
  assert.deepEqual(zeroDuration, snapshot);
});

test("drops invalid dates and invalid selected days defensively", () => {
  assert.equal(
    eventToTimelineItem({
      event: event({ starts_at: "not-a-date" }),
      calendarColor: "ocean",
      day: renderedDay,
    }),
    null,
  );
  assert.equal(
    taskDueToTimelineItem({
      task: task({ dueAt: "not-a-date" }),
      day: renderedDay,
    }),
    null,
  );
  assert.equal(localDayWindow(new Date("invalid")), null);
  assert.deepEqual(
    toTimelineItems([event()], [task()], calendars, new Date("invalid")),
    [],
  );
});

test("converts task dues with completion and toggle metadata", () => {
  const open = taskDueToTimelineItem({
    task: task(),
    day: renderedDay,
  });
  const completed = taskDueToTimelineItem({
    task: task({ taskId: "done", status: "cancelled" }),
    day: renderedDay,
  });

  assert.ok(open);
  assert.ok(completed);
  assert.equal(open.completed, false);
  assert.deepEqual(open.toggle, {
    taskId: "task-1",
    nextCompleted: true,
  });
  assert.equal(completed.completed, true);
  assert.deepEqual(completed.toggle, {
    taskId: "done",
    nextCompleted: false,
  });
});

test("sorts deterministically without mutating the supplied array", () => {
  const timed = eventToTimelineItem({
    event: event({
      id: "timed",
      title: "Timed",
      starts_at: "2026-07-14T15:00:00.000Z",
      ends_at: "2026-07-14T16:00:00.000Z",
    }),
    calendarColor: "ocean",
    day: renderedDay,
  });
  const allDay = eventToTimelineItem({
    event: event({
      id: "all-day",
      title: "All day",
      all_day: true,
      starts_at: "2026-07-14T00:00:00.000Z",
      ends_at: "2026-07-15T00:00:00.000Z",
    }),
    calendarColor: "ocean",
    day: renderedDay,
  });
  const due = taskDueToTimelineItem({
    task: task(),
    day: renderedDay,
  });

  assert.ok(timed);
  assert.ok(allDay);
  assert.ok(due);
  const items = [due, timed, allDay];
  const originalOrder = items.map((item) => item.id);

  assert.deepEqual(
    sortTimelineItems(items).map((item) => item.id),
    ["event:all-day", "task:task-1", "event:timed"],
  );
  assert.deepEqual(
    items.map((item) => item.id),
    originalOrder,
  );
});

test("can filter adapter items by their original overlap range", () => {
  const spanning = eventToTimelineItem({
    event: event({
      id: "spanning",
      starts_at: "2026-07-13T10:00:00.000Z",
      ends_at: "2026-07-15T10:00:00.000Z",
    }),
    calendarColor: "ocean",
    day: renderedDay,
  });
  const due = taskDueToTimelineItem({
    task: task(),
    day: renderedDay,
  });

  assert.ok(spanning);
  assert.ok(due);
  assert.deepEqual(
    timelineItemsForCalendarDay([due, spanning], renderedDay).map(
      (item) => item.id,
    ),
    ["event:spanning", "task:task-1"],
  );
  assert.deepEqual(
    timelineItemsForCalendarDay([due, spanning], new Date(2026, 6, 15)).map(
      (item) => ({
        id: item.id,
        start: item.start,
      }),
    ),
    [
      {
        id: "event:spanning",
        start: new Date(2026, 6, 15),
      },
    ],
  );
});
