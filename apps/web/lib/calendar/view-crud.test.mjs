import assert from "node:assert/strict";
import test from "node:test";
import {
  filterCalendarViewContent,
  initialCalendarViewId,
  nextCalendarViewIdAfterDelete,
  toolbarViewForSavedConfig,
} from "./view-crud.ts";

const event = (id, calendarId) => ({ id, calendar_id: calendarId });
const due = (taskId) => ({ taskId });
const view = (overrides = {}) => ({
  id: "view-1",
  is_default: false,
  position: 0,
  source_calendar_ids: [],
  include_task_dues: true,
  ...overrides,
});

test("a user with no saved views stays on the built-in Classic fallback", () => {
  assert.equal(initialCalendarViewId([]), null);
});

test("the default saved view wins over position and creation order", () => {
  assert.equal(
    initialCalendarViewId([
      view({ id: "first", position: 0 }),
      view({ id: "default", position: 10, is_default: true }),
    ]),
    "default",
  );
});

test("a saved view filters drawn events without touching the complete event pool", () => {
  const allEvents = [
    event("work", "calendar-work"),
    event("home", "calendar-home"),
  ];
  const result = filterCalendarViewContent({
    events: allEvents,
    taskDues: [due("task-1")],
    view: view({ source_calendar_ids: ["calendar-work"] }),
  });

  assert.deepEqual(
    result.events.map(({ id }) => id),
    ["work"],
  );
  assert.equal(result.taskDues.length, 1);
  assert.equal(allEvents.length, 2);
});

test("empty source overrides retain every event and task dues can be hidden", () => {
  const allEvents = [
    event("work", "calendar-work"),
    event("home", "calendar-home"),
  ];
  const result = filterCalendarViewContent({
    events: allEvents,
    taskDues: [due("task-1")],
    view: view({ include_task_dues: false }),
  });

  assert.equal(result.events, allEvents);
  assert.deepEqual(result.taskDues, []);
});

test("deleting the active view selects the default survivor then the first survivor", () => {
  const views = [
    view({ id: "active", position: 0 }),
    view({ id: "other", position: 1 }),
    view({ id: "default", position: 2, is_default: true }),
  ];

  assert.equal(nextCalendarViewIdAfterDelete(views, "active"), "default");
  assert.equal(
    nextCalendarViewIdAfterDelete(
      views.map((candidate) => ({ ...candidate, is_default: false })),
      "active",
    ),
    "other",
  );
  assert.equal(nextCalendarViewIdAfterDelete([views[0]], "active"), null);
});

test("saved view day counts choose the matching navigation range", () => {
  assert.equal(toolbarViewForSavedConfig({ dayCount: 1 }), "day");
  assert.equal(toolbarViewForSavedConfig({ dayCount: 5 }), "week");
  assert.equal(toolbarViewForSavedConfig({ dayCount: "month" }), "month");
  assert.equal(toolbarViewForSavedConfig({ dayCount: "year" }), "year");
});
