import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  completeTaskLinkedEvent,
  linkTaskToEvent,
  moveTaskLinkedEvent,
  setTaskStatusWithLinkedEvents,
  unscheduleTaskLinkedEvent,
} from "./task-calendar-roundtrip.ts";

const migrationUrl = new URL(
  "../../../../supabase/migrations/20260726072714_task_calendar_roundtrip.sql",
  import.meta.url,
);

function migrationSql() {
  assert.equal(existsSync(migrationUrl), true, "task/calendar migration is present");
  return readFileSync(migrationUrl, "utf8");
}

test("moveTaskLinkedEvent delegates one atomic due-date mutation", async () => {
  let captured = null;
  const client = {
    async rpc(name, args) {
      captured = { name, args };
      return { data: { id: "event-1" }, error: null };
    },
  };

  const event = await moveTaskLinkedEvent(client, "user-1", {
    eventId: "event-1",
    startsAt: "2026-07-27T16:00:00.000Z",
    endsAt: "2026-07-27T17:30:00.000Z",
  });

  assert.equal(event.id, "event-1");
  assert.deepEqual(captured, {
    name: "move_task_linked_event",
    args: {
      p_owner_id: "user-1",
      p_event_id: "event-1",
      p_starts_at: "2026-07-27T16:00:00.000Z",
      p_ends_at: "2026-07-27T17:30:00.000Z",
    },
  });
});

test("task completion helpers return task status with live linked event state", async () => {
  const response = {
    task: { id: "task-1", status: "done" },
    linkedEvents: [
      {
        eventId: "event-1",
        calendarId: "calendar-1",
        startsAt: "2026-07-27T16:00:00.000Z",
        endsAt: "2026-07-27T17:00:00.000Z",
        deletedAt: null,
      },
    ],
  };
  const calls = [];
  const client = {
    async rpc(name, args) {
      calls.push({ name, args });
      return { data: response, error: null };
    },
  };

  const fromEvent = await completeTaskLinkedEvent(client, "user-1", "event-1");
  const fromTask = await setTaskStatusWithLinkedEvents(client, "user-1", {
    taskId: "task-1",
    status: "not_started",
  });

  assert.deepEqual(fromEvent, response);
  assert.deepEqual(fromTask, response);
  assert.deepEqual(calls, [
    {
      name: "complete_task_linked_event",
      args: { p_owner_id: "user-1", p_event_id: "event-1" },
    },
    {
      name: "set_task_status_with_linked_events",
      args: {
        p_owner_id: "user-1",
        p_task_id: "task-1",
        p_status: "not_started",
      },
    },
  ]);
});

test("task completion helpers reject malformed RPC state", async () => {
  const client = {
    async rpc() {
      return { data: { task: { id: "task-1", status: "mystery" } }, error: null };
    },
  };

  await assert.rejects(
    completeTaskLinkedEvent(client, "user-1", "event-1"),
    /Invalid task\/calendar mutation response/,
  );
});

test("unscheduleTaskLinkedEvent preserves the task while soft-deleting its block", async () => {
  let captured = null;
  const client = {
    async rpc(name, args) {
      captured = { name, args };
      return { data: { id: "event-1", deleted_at: "2026-07-27T18:00:00.000Z" }, error: null };
    },
  };

  const event = await unscheduleTaskLinkedEvent(client, "user-1", "event-1");

  assert.equal(event.id, "event-1");
  assert.deepEqual(captured, {
    name: "unschedule_task_linked_event",
    args: { p_owner_id: "user-1", p_event_id: "event-1" },
  });
});

test("linkTaskToEvent delegates one atomic link and due-date mutation", async () => {
  let captured = null;
  const client = {
    async rpc(name, args) {
      captured = { name, args };
      return { data: { id: "event-1", task_id: "task-1" }, error: null };
    },
  };

  const event = await linkTaskToEvent(client, "user-1", {
    eventId: "event-1",
    taskId: "task-1",
  });

  assert.equal(event.task_id, "task-1");
  assert.deepEqual(captured, {
    name: "link_task_to_event",
    args: {
      p_owner_id: "user-1",
      p_event_id: "event-1",
      p_task_id: "task-1",
    },
  });
});

test("task/calendar migration keeps ownership, one-off links, and explicit deletion choices", () => {
  const sql = migrationSql();

  assert.match(sql, /calendar_events_task_link_one_off/);
  assert.match(sql, /validate constraint calendar_events_task_link_one_off/);
  assert.match(sql, /create unique index calendar_events_live_task_link_idx/);
  assert.match(sql, /on delete restrict/);
  assert.match(sql, /rrule is null\s+and parent_event_id is null\s+and recurrence_id is null/s);
  assert.match(sql, /create or replace function public\.move_task_linked_event/s);
  assert.match(sql, /set due_at = p_starts_at/s);
  assert.match(sql, /create or replace function public\.complete_task_linked_event/s);
  assert.match(sql, /set status = 'done'/);
  assert.match(sql, /create or replace function public\.unschedule_task_linked_event/s);
  assert.match(sql, /create or replace function public\.link_task_to_event/s);
  assert.match(sql, /v_event\.task_id is distinct from p_task_id/);
  assert.match(sql, /p_linked_event_action is null/);
  assert.match(sql, /'deleted_with_task'/);
  assert.match(sql, /set task_id = null,\s+deleted_at = coalesce/s);
  assert.match(sql, /starts_at_local = case/);
  assert.match(sql, /set deleted_at = now\(\),\s+updated_at = now\(\)/s);
  assert.match(sql, /drop function if exists public\.delete_task_cascade\(uuid, uuid\)/);
  assert.match(sql, /p_linked_event_action text/);
  assert.match(sql, /'delete_linked_block', 'keep_linked_block'/);
  assert.match(sql, /'kept_after_task_delete'/);
  assert.doesNotMatch(sql, /security definer/i);
  assert.match(sql, /security invoker/g);
});
