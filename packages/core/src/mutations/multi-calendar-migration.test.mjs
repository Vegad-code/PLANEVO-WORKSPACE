import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const MIGRATION_URL = new URL(
  "../../../../supabase/migrations/20260729201025_multi_calendar_redesign.sql",
  import.meta.url,
)

function migration() {
  return readFileSync(MIGRATION_URL, "utf8").toLowerCase()
}

test("migration creates protected Main identity and persistent inclusion", () => {
  const sql = migration()
  assert.match(sql, /add column if not exists is_main boolean/)
  assert.match(sql, /calendars_one_main_per_user/)
  assert.match(sql, /is_included_in_main/)
  assert.match(sql, /calendar_main_is_protected/)
  assert.match(sql, /create or replace function public\.create_user_products/)
  assert.doesNotMatch(sql, /security definer/)
})

test("migration assigns every task to one owned calendar with RLS", () => {
  const sql = migration()
  assert.match(sql, /create table if not exists public\.task_calendar_assignments/)
  assert.match(sql, /task_id uuid primary key/)
  assert.match(sql, /enable row level security/)
  assert.match(sql, /task_calendar_assignments_owner_select/)
  assert.match(sql, /task_calendar_assignments_owner_update/)
  assert.match(sql, /calendar_task_assignment_follows_event/)
  assert.match(sql, /schedule_task_in_calendar_idempotent/)
  assert.match(
    sql,
    /when target_color_mode = 'required_per_event' then target_color/,
  )
})

test("migration converts embeds before removing saved views", () => {
  const sql = migration()
  const rewrite = sql.indexOf("rewrite_calendar_embed_nodes")
  const update = sql.indexOf("update public.pages")
  const drop = sql.indexOf("drop table if exists public.calendar_views")
  assert.ok(rewrite >= 0)
  assert.ok(update > rewrite)
  assert.ok(drop > update)
  assert.match(sql, /'unavailable'/)
  assert.match(sql, /to_regclass\('public\.calendar_views'\)/)
})

test("calendar deletion and disconnect have bounded retention", () => {
  const sql = migration()
  assert.match(sql, /purge_after/)
  assert.match(sql, /interval '30 days'/)
  assert.match(sql, /purge_deleted_calendars/)
  assert.match(sql, /disconnect_calendar/)
  assert.match(sql, /restore_calendar/)

  const disconnect = sql.slice(
    sql.indexOf("create or replace function public.disconnect_calendar"),
    sql.indexOf("create or replace function public.purge_deleted_calendars"),
  )
  assert.doesNotMatch(disconnect, /delete from public\.calendar_events/)
  assert.match(disconnect, /delete from public\.calendars/)
})

test("workspace links accept calendars only through ownership checks", () => {
  const sql = migration()
  assert.match(sql, /resource_type = 'calendar'/)
  assert.match(sql, /from public\.calendars/)
  assert.match(sql, /calendar\.user_id = \(select auth\.uid\(\)\)/)
  assert.match(sql, /create_calendar_workspace_page/)
})

test("required event colors are backfilled before the mode is enabled", () => {
  const sql = migration()
  const preferences = sql.slice(
    sql.indexOf("create or replace function public.update_calendar_preferences"),
    sql.indexOf("create or replace function public.set_default_calendar"),
  )
  assert.match(preferences, /update public\.calendar_events/)
  assert.match(preferences, /and color is null/)
  assert.ok(
    preferences.indexOf("update public.calendar_events") <
      preferences.indexOf("update public.calendars"),
  )
})

test("event color remap keeps palette keys intact on re-run", () => {
  const sql = migration()
  assert.match(
    sql,
    /update public\.calendar_events\s+set color = case color[\s\S]*?when 'ocean' then 'blueberry'[\s\S]*?when color ~ '\^#\[0-9a-fa-f\]\{6\}\$' then upper\(color\)[\s\S]*?else color[\s\S]*?end\s+where color is not null/,
  )
  assert.doesNotMatch(
    sql,
    /when 'ocean' then 'blueberry'\s+else upper\(color\)/,
  )
})

test("moved recurrence masters remain discoverable in an isolated context", () => {
  const sql = migration()
  const recurrence = sql.slice(
    sql.indexOf(
      "create or replace function public.list_calendar_recurrence_masters_for_context",
    ),
    sql.indexOf("workspace embeds:"),
  )
  assert.match(recurrence, /moved_parent_ids/)
  assert.match(
    recurrence,
    /or master\.id in \(select parent_event_id from moved_parent_ids\)/,
  )
})
