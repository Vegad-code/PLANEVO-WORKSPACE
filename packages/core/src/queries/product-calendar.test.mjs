import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCalendars, loadCalendarWeek } from "./product-calendar.ts";

const WEEK = {
  start: new Date(2026, 6, 13),
  end: new Date(2026, 6, 20),
};

const CALENDAR_ROWS = [
  { id: "c1", user_id: "u1", name: "Work", color: "slate", is_visible: true, position: 0, created_at: "" },
  { id: "c2", user_id: "u1", name: "Personal", color: "meadow", is_visible: false, position: 1, created_at: "" },
];

function calendarsTable(rows) {
  return {
    select: () => ({
      eq: () => ({
        order: async () => ({ data: rows, error: null }),
      }),
    }),
  };
}

test("loadCalendars returns user calendars ordered by position", async () => {
  const client = { from: () => calendarsTable(CALENDAR_ROWS) };
  const result = await loadCalendars(client, "u1");
  assert.equal(result.length, 2);
  assert.equal(result[0].name, "Work");
  assert.equal(result[1].is_visible, false);
});

test("loadCalendarWeek returns calendars, events in range, and task due chips", async () => {
  const events = [
    { id: "e1", calendar_id: "c1", user_id: "u1", title: "Standup",
      starts_at: "2026-07-14T09:00:00.000Z", ends_at: "2026-07-14T09:30:00.000Z",
      all_day: false, location: null, description_json: {}, task_id: null,
      google_event_id: null, source: "planevo", created_at: "", updated_at: "" },
  ];
  const dueTasks = [
    { id: "t1", title: "Ship report", due_at: "2026-07-15T00:00:00.000Z", status: "not_started" },
  ];
  let eventRange = {};
  const client = {
    from(table) {
      if (table === "calendars") return calendarsTable(CALENDAR_ROWS);
      if (table === "calendar_events") {
        return {
          select: () => ({
            eq: () => ({
              gte: (_col, gteVal) => ({
                lt: (_col2, ltVal) => {
                  eventRange = { gte: gteVal, lt: ltVal };
                  return { order: async () => ({ data: events, error: null }) };
                },
              }),
            }),
          }),
        };
      }
      if (table === "tasks") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lt: () => ({ order: async () => ({ data: dueTasks, error: null }) }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  const result = await loadCalendarWeek(client, "u1", WEEK);
  assert.equal(result.calendars.length, 2);
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].title, "Standup");
  assert.equal(eventRange.gte, WEEK.start.toISOString());
  assert.equal(eventRange.lt, WEEK.end.toISOString());
  assert.deepEqual(result.taskDues, [
    { taskId: "t1", title: "Ship report", dueAt: "2026-07-15T00:00:00.000Z", status: "not_started" },
  ]);
});

test("loadCalendarWeek workspace scope filters events and tasks via workspace_links", async () => {
  const linkIdsByType = { calendar_event: [{ resource_id: "e1" }], task: [] };
  let eventInIds = null;
  let tasksQueried = false;
  const client = {
    from(table) {
      if (table === "calendars") return calendarsTable(CALENDAR_ROWS);
      if (table === "workspace_links") {
        return {
          select: () => ({
            eq: () => ({
              eq: (_col, resourceType) =>
                Promise.resolve({ data: linkIdsByType[resourceType], error: null }),
            }),
          }),
        };
      }
      if (table === "calendar_events") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lt: () => ({
                  in: (_col, ids) => {
                    eventInIds = ids;
                    return { order: async () => ({ data: [], error: null }) };
                  },
                }),
              }),
            }),
          }),
        };
      }
      if (table === "tasks") {
        tasksQueried = true;
        throw new Error("tasks should not be queried when no linked task ids");
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  const result = await loadCalendarWeek(client, "u1", { ...WEEK, workspaceId: "w1" });
  assert.deepEqual(eventInIds, ["e1"]);
  assert.equal(tasksQueried, false);
  assert.deepEqual(result.taskDues, []);
});

test("loadCalendarWeek overlap mode queries events that span into range", async () => {
  const events = [
    {
      id: "e-span",
      calendar_id: "c1",
      user_id: "u1",
      title: "Spans in",
      starts_at: "2026-06-28T09:00:00.000Z",
      ends_at: "2026-07-02T09:00:00.000Z",
      all_day: false,
      location: null,
      description_json: {},
      task_id: null,
      google_event_id: null,
      source: "planevo",
      created_at: "",
      updated_at: "",
    },
  ];
  const range = {
    start: new Date(2026, 6, 1),
    end: new Date(2026, 6, 8),
  };
  const filters = {};
  const client = {
    from(table) {
      if (table === "calendars") return calendarsTable(CALENDAR_ROWS);
      if (table === "calendar_events") {
        return {
          select: () => ({
            eq: () => ({
              lt: (_col, ltVal) => {
                filters.startsLt = ltVal;
                return {
                  gt: (_col2, gtVal) => {
                    filters.endsGt = gtVal;
                    return { order: async () => ({ data: events, error: null }) };
                  },
                };
              },
              gte: (_col, gteVal) => ({
                lt: (_col2, ltVal) => {
                  filters.startsGte = gteVal;
                  filters.startsLtLegacy = ltVal;
                  return { order: async () => ({ data: [], error: null }) };
                },
              }),
            }),
          }),
        };
      }
      if (table === "tasks") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lt: () => ({ order: async () => ({ data: [], error: null }) }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  await loadCalendarWeek(client, "u1", { ...range, eventRange: "overlaps" });
  assert.equal(filters.startsLt, range.end.toISOString());
  assert.equal(filters.endsGt, range.start.toISOString());
  assert.equal(filters.startsGte, undefined);
});
