import assert from "node:assert/strict";
import { test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import {
  loadCalendars,
  loadCalendarView,
  loadCalendarWeek,
} from "./product-calendar.ts";

const WEEK = {
  start: new Date("2026-07-13T00:00:00.000Z"),
  end: new Date("2026-07-20T00:00:00.000Z"),
};

const CALENDAR_ROWS = [
  {
    id: "c1",
    user_id: "u1",
    name: "Work",
    color: "slate",
    is_visible: true,
    is_default: true,
    position: 0,
    created_at: "",
  },
  {
    id: "c2",
    user_id: "u1",
    name: "Personal",
    color: "meadow",
    is_visible: false,
    is_default: false,
    position: 1,
    created_at: "",
  },
];

function fluentQuery({ rows, table, queryIndex, calls }) {
  const query = {
    select(...args) {
      calls.push({ table, queryIndex, method: "select", args });
      return query;
    },
    eq(...args) {
      calls.push({ table, queryIndex, method: "eq", args });
      return query;
    },
    is(...args) {
      calls.push({ table, queryIndex, method: "is", args });
      return query;
    },
    not(...args) {
      calls.push({ table, queryIndex, method: "not", args });
      return query;
    },
    gte(...args) {
      calls.push({ table, queryIndex, method: "gte", args });
      return query;
    },
    gt(...args) {
      calls.push({ table, queryIndex, method: "gt", args });
      return query;
    },
    lt(...args) {
      calls.push({ table, queryIndex, method: "lt", args });
      return query;
    },
    in(...args) {
      calls.push({ table, queryIndex, method: "in", args });
      return query;
    },
    or(...args) {
      calls.push({ table, queryIndex, method: "or", args });
      return query;
    },
    order(...args) {
      calls.push({ table, queryIndex, method: "order", args });
      return Promise.resolve({ data: rows, error: null });
    },
    maybeSingle() {
      calls.push({ table, queryIndex, method: "maybeSingle", args: [] });
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    },
    then(resolve, reject) {
      return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    },
  };
  return query;
}

function calendarClient({
  eventQueries = [],
  recurringMasters = [],
  taskRows = [],
  calendarViewRows = [],
  calendarConnectionRows = [],
  workspaceLinks = {},
} = {}) {
  const calls = [];
  const queryCounts = new Map();
  const client = {
    calls,
    rpc(name, args) {
      calls.push({
        table: "rpc",
        queryIndex: 0,
        method: name,
        args: [args],
      });
      return Promise.resolve({ data: recurringMasters, error: null });
    },
    from(table) {
      const queryIndex = queryCounts.get(table) ?? 0;
      queryCounts.set(table, queryIndex + 1);

      let rows;
      if (table === "calendars") rows = CALENDAR_ROWS;
      else if (table === "calendar_connections") rows = calendarConnectionRows;
      else if (table === "calendar_views") rows = calendarViewRows;
      else if (table === "calendar_events") {
        rows = eventQueries[queryIndex] ?? [];
      } else if (table === "tasks") rows = taskRows;
      else if (table === "workspace_links") {
        rows = workspaceLinks[queryIndex] ?? [];
      } else {
        throw new Error(`unexpected table ${table}`);
      }

      return fluentQuery({ rows, table, queryIndex, calls });
    },
  };
  return client;
}

function event(overrides = {}) {
  return {
    id: "e1",
    calendar_id: "c1",
    user_id: "u1",
    operation_key: null,
    title: "Standup",
    starts_at: "2026-07-14T09:00:00.000Z",
    ends_at: "2026-07-14T09:30:00.000Z",
    starts_at_local: null,
    ends_at_local: null,
    timezone: null,
    duration_minutes: null,
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
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function callsFor(client, table, queryIndex) {
  return client.calls.filter(
    (call) => call.table === table && call.queryIndex === queryIndex,
  );
}

function hasCall(calls, method, ...args) {
  return calls.some(
    (call) =>
      call.method === method &&
      isDeepStrictEqual(call.args, args),
  );
}

test("loadCalendars returns user calendars ordered by position", async () => {
  const client = calendarClient({
    calendarConnectionRows: [
      {
        id: "connection-1",
        calendar_id: "c1",
        provider: "ics",
        last_synced_at: "2026-07-26T12:00:00.000Z",
        last_sync_error: null,
        is_enabled: true,
      },
    ],
  });
  const result = await loadCalendars(client, "u1");

  assert.equal(result.length, 2);
  assert.equal(result[0].name, "Work");
  assert.equal(result[1].is_visible, false);
  assert.equal(result[0].connection.provider, "ics");
  assert.equal(result[1].connection, null);
  assert.equal(
    hasCall(callsFor(client, "calendars", 0), "order", "position", {
      ascending: true,
    }),
    true,
  );
});

test("loadCalendarView scopes the embedded lens to both view id and owner", async () => {
  const view = {
    id: "view-1",
    user_id: "u1",
    name: "My flow",
    preset: "flow",
    config: {},
    source_calendar_ids: ["c1", "deleted-calendar"],
    include_task_dues: true,
    is_default: false,
    position: 1,
    created_at: "",
    updated_at: "",
  };
  const client = calendarClient({ calendarViewRows: [view] });

  const result = await loadCalendarView(client, "u1", "view-1");
  const viewCalls = callsFor(client, "calendar_views", 0);

  assert.equal(hasCall(viewCalls, "eq", "id", "view-1"), true);
  assert.equal(hasCall(viewCalls, "eq", "user_id", "u1"), true);
  assert.deepEqual(result, {
    ...view,
    source_calendar_ids: ["c1"],
  });
});

test("loadCalendarView returns nothing for a missing or foreign saved view", async () => {
  const client = calendarClient({ calendarViewRows: [] });

  const result = await loadCalendarView(client, "u1", "foreign-view");

  assert.equal(result, null);
  assert.equal(
    hasCall(
      callsFor(client, "calendar_views", 0),
      "eq",
      "user_id",
      "u1",
    ),
    true,
  );
});

test("loads live standalone events and task due chips in the requested range", async () => {
  const standalone = event();
  const dueTasks = [
    {
      id: "t1",
      title: "Ship report",
      due_at: "2026-07-15T00:00:00.000Z",
      status: "not_started",
    },
  ];
  const client = calendarClient({
    eventQueries: [[standalone]],
    taskRows: dueTasks,
  });

  const result = await loadCalendarWeek(client, "u1", WEEK);
  const eventCalls = callsFor(client, "calendar_events", 0);

  assert.deepEqual(result.events, [standalone]);
  assert.deepEqual(result.recurringMasters, []);
  assert.deepEqual(result.recurrenceExceptions, []);
  assert.deepEqual(result.linkedTasks, []);
  assert.equal(hasCall(eventCalls, "is", "deleted_at", null), true);
  assert.equal(hasCall(eventCalls, "is", "parent_event_id", null), true);
  assert.equal(hasCall(eventCalls, "is", "rrule", null), true);
  assert.equal(
    hasCall(eventCalls, "gte", "starts_at", WEEK.start.toISOString()),
    true,
  );
  assert.equal(
    hasCall(eventCalls, "lt", "starts_at", WEEK.end.toISOString()),
    true,
  );
  assert.deepEqual(result.taskDues, [
    {
      taskId: "t1",
      title: "Ship report",
      dueAt: "2026-07-15T00:00:00.000Z",
      status: "not_started",
    },
  ]);
});

test("loads current task state for task-backed event cards even when the due date is outside the window", async () => {
  const linkedEvent = event({ task_id: "task-1" });
  const linkedTask = {
    id: "task-1",
    title: "Ship report",
    status: "done",
    description_json: { estimateMinutes: 90 },
  };
  const client = calendarClient({
    eventQueries: [[linkedEvent]],
    taskRows: [linkedTask],
  });

  const result = await loadCalendarWeek(client, "u1", WEEK);
  const linkedTaskCalls = callsFor(client, "tasks", 0);

  assert.deepEqual(result.linkedTasks, [linkedTask]);
  assert.equal(
    hasCall(linkedTaskCalls, "select", "id,title,status,description_json"),
    true,
  );
  assert.equal(hasCall(linkedTaskCalls, "in", "id", ["task-1"]), true);
})

test("keeps a master returned for a moved-in override even when its natural series is outside the window", async () => {
  const master = event({
    id: "master-1",
    starts_at: "2026-08-04T09:00:00.000Z",
    ends_at: "2026-08-04T10:00:00.000Z",
    rrule: "FREQ=WEEKLY;BYDAY=TU",
    recurrence_end: "2026-07-01T09:00:00.000Z",
    duration_minutes: 60,
  });
  const exception = event({
    id: "exception-1",
    parent_event_id: master.id,
    recurrence_id: "2026-07-14T09:00:00.000Z",
    is_exception: true,
  });
  const client = calendarClient({
    eventQueries: [[], [exception]],
    recurringMasters: [master],
  });

  const result = await loadCalendarWeek(client, "u1", WEEK);
  const masterCalls = callsFor(client, "rpc", 0);
  const exceptionCalls = callsFor(client, "calendar_events", 1);

  assert.deepEqual(result.events, []);
  assert.deepEqual(result.recurringMasters, [master]);
  assert.deepEqual(result.recurrenceExceptions, [exception]);
  assert.equal(
    hasCall(masterCalls, "list_calendar_recurrence_masters", {
      p_owner_id: "u1",
      p_window_start: WEEK.start.toISOString(),
      p_window_end: WEEK.end.toISOString(),
      p_overlaps: false,
      p_workspace_event_ids: null,
    }),
    true,
  );
  assert.equal(hasCall(exceptionCalls, "is", "deleted_at", null), true);
  assert.equal(
    hasCall(exceptionCalls, "in", "parent_event_id", [master.id]),
    true,
  );
  const exceptionOr = exceptionCalls.find((call) => call.method === "or");
  assert.match(exceptionOr?.args[0] ?? "", /recurrence_id\.gte\./);
  assert.match(exceptionOr?.args[0] ?? "", /is_cancelled\.eq\.false/);
});

test("workspace scope filters standalone rows and masters through workspace links", async () => {
  const client = calendarClient({
    eventQueries: [[]],
    workspaceLinks: {
      0: [{ resource_id: "linked-event" }],
      1: [],
    },
  });

  const result = await loadCalendarWeek(client, "u1", {
    ...WEEK,
    workspaceId: "w1",
  });

  assert.equal(
    hasCall(
      callsFor(client, "calendar_events", 0),
      "in",
      "id",
      ["linked-event"],
    ),
    true,
  );
  assert.equal(
    hasCall(
      callsFor(client, "rpc", 0),
      "list_calendar_recurrence_masters",
      {
        p_owner_id: "u1",
        p_window_start: WEEK.start.toISOString(),
        p_window_end: WEEK.end.toISOString(),
        p_overlaps: false,
        p_workspace_event_ids: ["linked-event"],
      },
    ),
    true,
  );
  assert.deepEqual(result.taskDues, []);
  assert.equal(
    client.calls.some((call) => call.table === "tasks"),
    false,
  );
});

test("overlap mode queries standalone events that span into the range", async () => {
  const range = {
    start: new Date("2026-07-01T00:00:00.000Z"),
    end: new Date("2026-07-08T00:00:00.000Z"),
  };
  const client = calendarClient({ eventQueries: [[]] });

  await loadCalendarWeek(client, "u1", {
    ...range,
    eventRange: "overlaps",
  });
  const eventCalls = callsFor(client, "calendar_events", 0);

  assert.equal(
    hasCall(eventCalls, "lt", "starts_at", range.end.toISOString()),
    true,
  );
  assert.equal(
    hasCall(eventCalls, "gt", "ends_at", range.start.toISOString()),
    true,
  );
  assert.equal(
    eventCalls.some((call) => call.method === "gte"),
    false,
  );
});
