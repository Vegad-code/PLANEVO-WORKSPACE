import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const MIGRATION_URL = new URL(
  "../../../../supabase/migrations/20260718160000_phase2_final_integrity.sql",
  import.meta.url,
);

test("final integrity migration is additive and hardens every polymorphic endpoint", () => {
  assert.equal(existsSync(MIGRATION_URL), true);
  const sql = readFileSync(MIGRATION_URL, "utf8").toLowerCase();
  assert.match(sql, /drop policy if exists calendar_events_owner/);
  assert.match(sql, /calendar_events_both_endpoints/);
  assert.match(sql, /c\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /t\.user_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /workspace_links_both_endpoints/);
  assert.match(sql, /created_by = \(select auth\.uid\(\)\)/);
  assert.match(sql, /resource_type = 'file'[\s\S]*file_sources/);
  assert.match(sql, /file_links_both_endpoints/);
  assert.match(sql, /target_type = 'calendar_event'[\s\S]*calendar_events/);
});

test("final integrity migration canonicalizes file ownership and operation keys", () => {
  const sql = readFileSync(MIGRATION_URL, "utf8").toLowerCase();
  assert.match(sql, /update public\.file_sources[\s\S]*set user_id = created_by/);
  assert.match(sql, /alter column user_id set not null/);
  assert.match(sql, /check \(user_id = created_by\)/);
  assert.match(sql, /tasks_owner_operation_key_uidx/);
  assert.match(sql, /calendar_events_owner_operation_key_uidx/);
  assert.match(sql, /file_sources_owner_operation_key_uidx/);
  assert.match(sql, /file_links_owner_operation_key_uidx/);
});

test("final integrity migration uses locked lifecycle, deletion, ordering, and recovery RPCs", () => {
  const sql = readFileSync(MIGRATION_URL, "utf8").toLowerCase();
  for (const name of [
    "reserve_task_attachment",
    "begin_task_attachment_cleanup",
    "finalize_task_attachment_cleanup",
    "claim_task_attachment",
    "create_task_ordered",
    "move_task_ordered",
    "delete_task_cascade",
    "schedule_task_idempotent",
  ]) {
    assert.match(sql, new RegExp(`function public\\.${name}`));
  }
  assert.match(sql, /for update/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /task_attachment_state',''\)\s*<>\s*'unclaimed'/);
  assert.match(sql, /task_attachment_state',''\)\s*<>\s*'cleanup_pending'/);
  assert.match(sql, /delete from public\.workspace_links[\s\S]*resource_type\s*=\s*'task'/);
  assert.match(sql, /delete from public\.file_links[\s\S]*target_type\s*=\s*'task'/);
  assert.match(sql, /'task_attachment_state',\s*'detached'/);
  assert.match(sql, /raise exception 'task order changed'/);
});

test("final integrity functions stay invoker-scoped and API ACLs exclude anonymous callers", () => {
  const sql = readFileSync(MIGRATION_URL, "utf8").toLowerCase();
  assert.doesNotMatch(sql, /security definer/);
  assert.match(sql, /security invoker/g);
  assert.match(sql, /revoke all on function public\.create_task_ordered/);
  assert.match(sql, /from public, anon/);
  assert.match(sql, /to authenticated, service_role/);
});
