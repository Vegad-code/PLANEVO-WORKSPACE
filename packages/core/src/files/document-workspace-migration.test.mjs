import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const MIGRATION_URL = new URL(
  "../../../../supabase/migrations/20260724120000_file_document_workspace.sql",
  import.meta.url,
);

function migrationSql() {
  return readFileSync(MIGRATION_URL, "utf8").toLowerCase();
}

test("document workspace tables are owner-scoped with RLS enabled", () => {
  const sql = migrationSql();
  for (const table of [
    "file_document_state",
    "file_revisions",
    "file_notes",
    "file_comment_threads",
    "file_comments",
    "file_index_jobs",
    "file_storage_cleanup_jobs",
  ]) {
    assert.match(
      sql,
      new RegExp(`create table (?:if not exists )?public\\.${table}`),
    );
    assert.match(
      sql,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
  }
  assert.match(sql, /user_id = \(select auth\.uid\(\)\)/);
  assert.match(sql, /source\.user_id = \(select auth\.uid\(\)\)/);
});

test("document save RPCs use invoker-scoped compare-and-swap", () => {
  const sql = migrationSql();
  assert.doesNotMatch(sql, /security definer/);
  for (const name of [
    "save_file_page_document",
    "finalize_file_text_document",
  ]) {
    assert.match(sql, new RegExp(`function public\\.${name}`));
  }
  assert.match(sql, /for update/);
  assert.match(sql, /v_current_version is distinct from p_base_version/);
  assert.match(sql, /raise exception 'document version conflict'/);
  assert.match(sql, /from public, anon/);
  assert.match(sql, /to authenticated, service_role/);
  assert.match(sql, /function public\.delete_file_document/);
  assert.match(sql, /insert into public\.file_storage_cleanup_jobs/);
  assert.match(sql, /delete from public\.file_sources/);
  assert.match(sql, /delete from public\.pages/);
  assert.match(
    sql,
    /unsafe\.path like 'page-assets:' \|\| \(select auth\.uid\(\)\)::text/,
  );
  assert.match(sql, /unsafe\.path like workspace\.id::text \|\| '\/%'/);
  assert.match(
    sql,
    /grant select, insert on public\.file_storage_cleanup_jobs to authenticated/,
  );
});

test("indexing and cleanup workers are service-only and recover stale leases", () => {
  const sql = migrationSql();
  assert.match(sql, /function public\.claim_file_index_jobs/);
  assert.match(sql, /function public\.claim_file_storage_cleanup_jobs/);
  assert.match(sql, /function public\.replace_file_source_chunks/);
  assert.match(sql, /delete from public\.source_chunks/);
  assert.match(sql, /jsonb_to_recordset\(p_chunks\)/);
  assert.match(sql, /auth\.role\(\) <> 'service_role'/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /job\.status = 'processing'/);
  assert.match(sql, /job\.updated_at < now\(\) - interval '10 minutes'/);
  assert.match(sql, /from public, anon, authenticated/);
  assert.match(sql, /to service_role/);
});
