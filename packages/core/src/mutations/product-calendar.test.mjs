import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createCalendarEvent,
  scheduleTaskFromDrag,
  updateCalendarVisibility,
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
  });
  assert.equal(event.id, "e1");
  assert.equal(inserted.user_id, "u1");
  assert.equal(inserted.calendar_id, "c1");
  assert.equal(inserted.all_day, false);
  assert.equal(inserted.location, null);
  assert.equal(inserted.task_id, null);
  assert.deepEqual(inserted.description_json, {});
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
  assert.deepEqual(filters.patch, { is_visible: false });
  assert.equal(filters.id, "c1");
  assert.equal(filters.user_id, "u1");
});

test("scheduleTaskFromDrag creates a one-hour event linked to the task", async () => {
  let rpcArgs = null;
  const client = {
    rpc: async (name, args) => {
      assert.equal(name, "schedule_task_idempotent");
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
    title: "Write launch email",
    startsAt: "2026-07-14T09:00:00.000Z",
  });
  assert.equal(event.task_id, "t1");
  assert.equal(rpcArgs.p_owner_id, "u1");
  assert.equal(rpcArgs.p_starts_at, "2026-07-14T09:00:00.000Z");
  assert.equal(rpcArgs.p_ends_at, "2026-07-14T10:00:00.000Z");
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
