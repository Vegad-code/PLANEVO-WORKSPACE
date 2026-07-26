import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import {
  restoreCalendarEventUndo,
  restoreCalendarSeriesUndo,
} from "./calendar-undo.ts";

const migrationUrl = new URL(
  "../../../../supabase/migrations/20260726090000_calendar_event_undo.sql",
  import.meta.url,
);
const recurringMigrationUrl = new URL(
  "../../../../supabase/migrations/20260726091000_calendar_recurring_undo.sql",
  import.meta.url,
);

test("restoreCalendarEventUndo delegates one owner-scoped atomic restore", async () => {
  let captured = null;
  const client = {
    async rpc(name, args) {
      captured = { name, args };
      return { data: { id: "event-1", deleted_at: null }, error: null };
    },
  };

  const restored = await restoreCalendarEventUndo(client, "user-1", "event-1");

  assert.equal(restored.id, "event-1");
  assert.deepEqual(captured, {
    name: "restore_calendar_event_undo",
    args: { p_owner_id: "user-1", p_event_id: "event-1" },
  });
});

test("restore migration is invoker-scoped and restores linked task due time", () => {
  assert.equal(existsSync(migrationUrl), true);
  const sql = readFileSync(migrationUrl, "utf8");

  assert.match(sql, /security invoker/i);
  assert.doesNotMatch(sql, /security definer/i);
  assert.match(sql, /set deleted_at = null/i);
  assert.match(sql, /set due_at = v_event\.starts_at/i);
  assert.match(sql, /and user_id = p_owner_id/gi);
  assert.match(sql, /revoke all on function[\s\S]+from public, anon/i);
});

test("restoreCalendarSeriesUndo sends the exact family snapshot", async () => {
  let captured = null;
  const client = {
    async rpc(name, args) {
      captured = { name, args };
      return { data: true, error: null };
    },
  };
  const eventRows = [{ id: "master-1", user_id: "user-1" }];

  await restoreCalendarSeriesUndo(client, "user-1", {
    masterEventId: "master-1",
    guardEventId: "new-master-1",
    newMasterEventId: "new-master-1",
    eventRows,
  });

  assert.deepEqual(captured, {
    name: "restore_calendar_series_undo",
    args: {
      p_owner_id: "user-1",
      p_master_event_id: "master-1",
      p_guard_event_id: "new-master-1",
      p_new_master_event_id: "new-master-1",
      p_event_rows: eventRows,
    },
  });
});

test("recurring restore is owner-scoped, expiring, and soft-retires split rows", () => {
  assert.equal(existsSync(recurringMigrationUrl), true);
  const sql = readFileSync(recurringMigrationUrl, "utf8");

  assert.match(sql, /security invoker/i);
  assert.doesNotMatch(sql, /security definer/i);
  assert.match(sql, /updated_at < now\(\) - interval '8 seconds'/i);
  assert.match(sql, /set deleted_at = coalesce\(event\.deleted_at, now\(\)\)/i);
  assert.match(sql, /jsonb_populate_recordset/i);
  assert.match(sql, /calendar\.user_id = p_owner_id/i);
  assert.match(sql, /revoke all on function[\s\S]+from public, anon/i);
});
