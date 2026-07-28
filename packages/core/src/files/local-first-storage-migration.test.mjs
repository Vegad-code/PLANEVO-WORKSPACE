import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const MIGRATION_URL = new URL(
  "../../../../supabase/migrations/20260728064408_file_local_first_storage.sql",
  import.meta.url,
);

function migrationSql() {
  return readFileSync(MIGRATION_URL, "utf8").toLowerCase();
}

test("local file metadata is explicit and excluded from ingestion", () => {
  const sql = migrationSql();

  assert.match(sql, /add column if not exists storage_kind text not null/);
  assert.match(
    sql,
    /storage_kind in \('local', 'synced', 'cloud', 'page'\)/,
  );
  assert.match(sql, /ingestion_status in \(\s*'local_only'/);
  assert.match(sql, /function public\.prevent_local_file_chunks/);
  assert.match(sql, /v_storage_kind = 'local'/);
  assert.match(sql, /local-only files cannot create server search chunks/);
  assert.match(sql, /before insert or update on public\.source_chunks/);
});

test("deleting a local file never schedules virtual paths for Storage cleanup", () => {
  const sql = migrationSql();

  assert.match(sql, /function public\.delete_file_document/);
  assert.match(sql, /v_storage_kind <> 'local'/);
  assert.match(sql, /revision\.storage_path not like 'local:%'/);
  assert.match(sql, /v_storage_path not like 'local:%'/);
  assert.match(sql, /current_user <> 'service_role'/);
  assert.match(sql, /\(select auth\.uid\(\)\) is distinct from p_owner_id/);
});
