import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  scheduleTaskFromDrag,
  softDeleteCalendarEvent,
  splitCalendarEventSeries,
  truncateCalendarEventSeries,
  updateCalendarEvent,
  updateCalendarVisibility,
  upsertCalendarEventException,
} from "./product-calendar.ts";

test("createCalendarEvent inserts an owned row with defaults applied", async () => {
  let inserted = null;
  const client = {
    from: (table) => {
      assert.equal(table, "calendar_events");
      return {
        insert: (row) => {
          inserted = row;
          return {
            select: () => ({
              single: async () => ({ data: { ...row, id: "e1" }, error: null }),
            }),
          };
        },
      };
    },
  };
  const event = await createCalendarEvent(client, "u1", {
    calendarId: "c1",
    title: "Design review",
    startsAt: "2026-07-14T13:00:00.000Z",
    endsAt: "2026-07-14T14:00:00.000Z",
    startsAtLocal: "2026-07-14T09:00:00",
    endsAtLocal: "2026-07-14T10:00:00",
    timezone: "America/New_York",
    durationMinutes: 60,
    rrule: "FREQ=WEEKLY;BYDAY=TU",
    recurrenceEnd: "2026-08-01T13:00:00.001Z",
  });
  assert.equal(event.id, "e1");
  assert.equal(inserted.user_id, "u1");
  assert.equal(inserted.calendar_id, "c1");
  assert.equal(inserted.all_day, false);
  assert.equal(inserted.location, null);
  assert.equal(inserted.task_id, null);
  assert.equal(inserted.starts_at_local, "2026-07-14T09:00:00");
  assert.equal(inserted.ends_at_local, "2026-07-14T10:00:00");
  assert.equal(inserted.timezone, "America/New_York");
  assert.equal(inserted.duration_minutes, 60);
  assert.equal(inserted.rrule, "FREQ=WEEKLY;BYDAY=TU");
  assert.equal(inserted.recurrence_end, "2026-08-01T13:00:00.001Z");
  assert.deepEqual(inserted.description_json, {});
});

test("updateCalendarEvent patches authored recurrence fields behind ownership filters", async () => {
  let updated = null;
  const filters = {};
  const result = { id: "event-1" };
  const chain = {
    eq(column, value) {
      filters[column] = value;
      return chain;
    },
    is(column, value) {
      filters[column] = value;
      return chain;
    },
    select() {
      return chain;
    },
    async maybeSingle() {
      return { data: result, error: null };
    },
  };
  const client = {
    from(table) {
      assert.equal(table, "calendar_events");
      return {
        update(patch) {
          updated = patch;
          return chain;
        },
      };
    },
  };

  await updateCalendarEvent(client, "user-1", "event-1", {
    startsAt: "2026-07-21T13:00:00.000Z",
    endsAt: "2026-07-21T14:00:00.000Z",
    startsAtLocal: "2026-07-21T09:00:00",
    endsAtLocal: "2026-07-21T10:00:00",
    timezone: "America/New_York",
    durationMinutes: 60,
    rrule: "FREQ=WEEKLY;BYDAY=TU",
    recurrenceEnd: "2026-08-01T13:00:00.001Z",
  });

  assert.equal(filters.id, "event-1");
  assert.equal(filters.user_id, "user-1");
  assert.equal(filters.deleted_at, null);
  assert.equal(updated.starts_at_local, "2026-07-21T09:00:00");
  assert.equal(updated.ends_at_local, "2026-07-21T10:00:00");
  assert.equal(updated.timezone, "America/New_York");
  assert.equal(updated.duration_minutes, 60);
  assert.equal(updated.rrule, "FREQ=WEEKLY;BYDAY=TU");
  assert.equal(updated.recurrence_end, "2026-08-01T13:00:00.001Z");
});

function calendarEventUpdateClient() {
  const calls = [];
  const chain = {
    eq(...args) {
      calls.push({ method: "eq", args });
      return chain;
    },
    is(...args) {
      calls.push({ method: "is", args });
      return chain;
    },
    select(...args) {
      calls.push({ method: "select", args });
      return chain;
    },
    async maybeSingle() {
      return { data: { id: "event-1" }, error: null };
    },
  };
  return {
    calls,
    client: {
      from(table) {
        assert.equal(table, "calendar_events");
        return {
          update(patch) {
            calls.push({ method: "update", args: [patch] });
            return chain;
          },
          delete() {
            assert.fail("calendar event deletion must never issue a hard delete");
          },
        };
      },
    },
  };
}

test("calendar event deletion only marks a live owned row as deleted", async () => {
  for (const remove of [softDeleteCalendarEvent, deleteCalendarEvent]) {
    const { client, calls } = calendarEventUpdateClient();

    await remove(client, "user-1", "event-1");

    const patch = calls.find(({ method }) => method === "update")?.args[0];
    assert.match(patch.deleted_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(patch.updated_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(
      calls.some(
        ({ method, args }) =>
          method === "eq" && args[0] === "id" && args[1] === "event-1",
      ),
      true,
    );
    assert.equal(
      calls.some(
        ({ method, args }) =>
          method === "eq" && args[0] === "user_id" && args[1] === "user-1",
      ),
      true,
    );
    assert.equal(
      calls.some(
        ({ method, args }) =>
          method === "is" && args[0] === "deleted_at" && args[1] === null,
      ),
      true,
    );
  }
});

test("upsertCalendarEventException sends persisted master identity separately from occurrence identity", async () => {
  let rpcArgs = null;
  const client = {
    async rpc(name, args) {
      assert.equal(name, "upsert_calendar_event_exception");
      rpcArgs = args;
      return { data: { id: "exception-1" }, error: null };
    },
  };

  const result = await upsertCalendarEventException(client, "user-1", {
    operationKey: "operation-1",
    masterEventId: "master-1",
    calendarId: "calendar-2",
    recurrenceId: "2026-07-14T13:00:00.000Z",
    isCancelled: false,
    title: "Moved planning",
    startsAt: "2026-07-14T14:00:00.000Z",
    endsAt: "2026-07-14T15:00:00.000Z",
    startsAtLocal: "2026-07-14T10:00:00",
    endsAtLocal: "2026-07-14T11:00:00",
    timezone: "America/New_York",
    durationMinutes: 60,
    allDay: false,
    location: null,
    description: {},
    color: null,
    conferenceUrl: null,
  });

  assert.equal(result.id, "exception-1");
  assert.equal(rpcArgs.p_master_event_id, "master-1");
  assert.equal(rpcArgs.p_calendar_id, "calendar-2");
  assert.equal(rpcArgs.p_recurrence_id, "2026-07-14T13:00:00.000Z");
  assert.equal(rpcArgs.p_starts_at, "2026-07-14T14:00:00.000Z");
});

test("truncateCalendarEventSeries sends an exclusive cutoff to one atomic RPC", async () => {
  let rpcArgs = null;
  const client = {
    async rpc(name, args) {
      assert.equal(name, "truncate_calendar_event_series");
      rpcArgs = args;
      return { data: { id: "master-1" }, error: null };
    },
  };

  await truncateCalendarEventSeries(client, "user-1", {
    masterEventId: "master-1",
    recurrenceId: "2026-07-14T13:00:00.000Z",
  });

  assert.deepEqual(rpcArgs, {
    p_owner_id: "user-1",
    p_master_event_id: "master-1",
    p_recurrence_id: "2026-07-14T13:00:00.000Z",
  });
});

test("splitCalendarEventSeries sends the new master and exception mapping atomically", async () => {
  let rpcArgs = null;
  const client = {
    async rpc(name, args) {
      assert.equal(name, "split_calendar_event_series");
      rpcArgs = args;
      return {
        data: { oldMasterId: "master-1", newMasterId: "master-2" },
        error: null,
      };
    },
  };

  const result = await splitCalendarEventSeries(client, "user-1", {
    operationKey: "operation-1",
    masterEventId: "master-1",
    splitRecurrenceId: "2026-07-14T13:00:00.000Z",
    calendarId: "calendar-1",
    title: "Planning",
    startsAt: "2026-07-14T14:00:00.000Z",
    endsAt: "2026-07-14T15:00:00.000Z",
    startsAtLocal: "2026-07-14T10:00:00",
    endsAtLocal: "2026-07-14T11:00:00",
    timezone: "America/New_York",
    durationMinutes: 60,
    rrule: "FREQ=WEEKLY;BYDAY=TU",
    recurrenceEnd: null,
    allDay: false,
    location: null,
    description: {},
    color: null,
    conferenceUrl: null,
    exceptionRecurrenceIdMap: [
      {
        oldRecurrenceId: "2026-07-21T13:00:00.000Z",
        newRecurrenceId: "2026-07-21T14:00:00.000Z",
      },
    ],
  });

  assert.deepEqual(result, {
    oldMasterId: "master-1",
    newMasterId: "master-2",
  });
  assert.equal(rpcArgs.p_master_event_id, "master-1");
  assert.equal(rpcArgs.p_new_starts_at, "2026-07-14T14:00:00.000Z");
  assert.deepEqual(rpcArgs.p_exception_recurrence_id_map, [
    {
      oldRecurrenceId: "2026-07-21T13:00:00.000Z",
      newRecurrenceId: "2026-07-21T14:00:00.000Z",
    },
  ]);
});

test("updateCalendarVisibility scopes by calendar id and user id", async () => {
  const filters = {};
  const client = {
    from: (table) => {
      assert.equal(table, "calendars");
      return {
        update: (patch) => {
          filters.patch = patch;
          return {
            eq: (col, val) => {
              filters[col] = val;
              return {
                eq: async (col2, val2) => {
                  filters[col2] = val2;
                  return { error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  await updateCalendarVisibility(client, "u1", "c1", false);
  assert.deepEqual(filters.patch, { is_included_in_main: false });
  assert.equal(filters.id, "c1");
  assert.equal(filters.user_id, "u1");
});

test("scheduleTaskFromDrag creates a one-hour event linked to the task", async () => {
  let rpcArgs = null;
  const client = {
    rpc: async (name, args) => {
      assert.equal(name, "schedule_task_in_calendar_idempotent");
      rpcArgs = args;
      return {
        data: { id: "e1", task_id: args.p_task_id, starts_at: args.p_starts_at },
        error: null,
      };
    },
  };
  const event = await scheduleTaskFromDrag(client, "u1", {
    operationKey: "op-1",
    taskId: "t1",
    calendarId: "c1",
    title: "Write launch email",
    startsAt: "2026-07-14T09:00:00.000Z",
  });
  assert.equal(event.task_id, "t1");
  assert.equal(rpcArgs.p_owner_id, "u1");
  assert.equal(rpcArgs.p_calendar_id, "c1");
  assert.equal(rpcArgs.p_starts_at, "2026-07-14T09:00:00.000Z");
  assert.equal(rpcArgs.p_ends_at, "2026-07-14T10:00:00.000Z");
});

test("scheduleTaskFromDrag honors the task estimate", async () => {
  let captured = null;
  const client = {
    async rpc(name, args) {
      assert.equal(name, "schedule_task_in_calendar_idempotent");
      captured = args;
      return {
        data: { id: "e1", task_id: args.p_task_id, ends_at: args.p_ends_at },
        error: null,
      };
    },
  };

  await scheduleTaskFromDrag(client, "u1", {
    operationKey: "op-1",
    taskId: "t1",
    calendarId: "c1",
    title: "Deep work",
    startsAt: "2026-07-14T13:00:00.000Z",
    durationMinutes: 90,
  });

  assert.equal(captured.p_ends_at, "2026-07-14T14:30:00.000Z");
});

test("scheduleTaskFromDrag rejects invalid task estimates", async () => {
  await assert.rejects(
    scheduleTaskFromDrag({}, "u1", {
      operationKey: "op-1",
      taskId: "t1",
      calendarId: "c1",
      title: "Deep work",
      startsAt: "2026-07-14T13:00:00.000Z",
      durationMinutes: 0,
    }),
    /Invalid task duration/,
  );
});

test("scheduleTaskFromDrag rejects malformed drop times", async () => {
  await assert.rejects(
    () =>
      scheduleTaskFromDrag({}, "u1", {
        operationKey: "op-1",
        taskId: "t1",
        title: "x",
        startsAt: "not-a-date",
      }),
    /Invalid drop time/,
  );
});
