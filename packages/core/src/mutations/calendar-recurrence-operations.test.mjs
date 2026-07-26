import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const migrationUrl = new URL(
  "../../../../supabase/migrations/20260725140000_calendar_recurrence_operations.sql",
  import.meta.url,
);

function migrationSql() {
  assert.equal(existsSync(migrationUrl), true, "recurrence migration is present");
  return readFileSync(migrationUrl, "utf8");
}

test("recurrence exception writes validate the requested owned calendar", () => {
  const sql = migrationSql();

  assert.match(sql, /p_calendar_id uuid/);
  assert.match(
    sql,
    /from public\.calendars\s+where id = p_calendar_id\s+and user_id = p_owner_id/s,
  );
  assert.match(sql, /calendar_id = excluded\.calendar_id/);
});

test("recurrence master reads exclude deleted masters and moved exceptions", () => {
  const sql = migrationSql();

  assert.match(
    sql,
    /from public\.calendar_events exception[\s\S]*?exception\.deleted_at is null/,
  );
  assert.match(
    sql,
    /from public\.calendar_events master[\s\S]*?master\.deleted_at is null/,
  );
});

test("split copies future exceptions before retiring old identities", () => {
  const sql = migrationSql();

  assert.match(sql, /id,\s+calendar_id,\s+user_id,\s+operation_key/s);
  assert.match(sql, /gen_random_uuid\(\),\s+v_new_master\.calendar_id/s);
  assert.match(sql, /gen_random_uuid\(\),\s+child\.title/s);
  assert.match(sql, /v_new_master\.id,\s+mapping\."newRecurrenceId"/s);
  assert.match(sql, /get diagnostics v_copied_count = row_count/);
  assert.match(sql, /set deleted_at = now\(\),\s+updated_at = now\(\)/s);
  assert.match(sql, /get diagnostics v_retired_count = row_count/);
});

test("split duplicates event cross-links and finite RRULEs require an end boundary", () => {
  const sql = migrationSql();

  assert.match(sql, /insert into public\.workspace_links/s);
  assert.match(sql, /on conflict \(workspace_id, resource_type, resource_id\) do nothing/);
  assert.match(sql, /insert into public\.file_links/s);
  assert.match(sql, /join public\.file_sources source/s);
  assert.match(sql, /on conflict \(file_source_id, target_type, target_id\) do nothing/);
  assert.match(sql, /calendar_events_bounded_rrule_end/);
  assert.match(sql, /\(\^\|;\)\(COUNT\|UNTIL\)=/);
  assert.match(sql, /recurrence_end >= starts_at/);
});
