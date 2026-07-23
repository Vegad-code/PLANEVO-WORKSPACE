# Phase 3 migration runbook

> Audit fix pass · July 19, 2026 · Linked Supabase project (CLI `--linked`)

## Summary

**Phase 3 ships no new migration SQL.** Calendar and Files use tables and RPCs from Phase 1–2. Your **linked remote already has the required schema** (tables + `schedule_task_idempotent`). Two follow-ups remain: **migration ledger repair** and **icon catalog seed**.

---

## Required for Calendar + Files (schema)

These objects were verified on the linked remote via `npx supabase db query --linked`:

| Check | Status |
|-------|--------|
| `calendars`, `calendar_events`, `file_links`, `workspace_links`, `file_sources`, `tasks` | Present |
| `schedule_task_idempotent` RPC | Present |
| `create_user_products` RPC | Present |

**Source migrations** (if ever applying to a fresh database, in order):

1. `20260714150000` through `20260717120000` — kernel + workspace foundation
2. **`20260718120000_ecosystem_product_tables.sql`** — product tables + link layer
3. `20260718130000` through `20260718150000` — task attachment (recommended)
4. **`20260718160000_phase2_final_integrity.sql`** — cross-link RLS + `schedule_task_idempotent`

---

## Migration ledger drift (linked remote)

`npx supabase migration list` shows these **local** migrations with **empty remote** ledger column (schema may already exist from manual apply):

| Version | File |
|---------|------|
| `20260717090000` | `workspace_revamp.sql` |
| `20260717120000` | `starter_workspace_and_kernel.sql` |
| `20260718120000` | `ecosystem_product_tables.sql` |
| `20260719120000` | `icon_catalog.sql` |

Because `calendars` / `file_links` / RPCs already exist, **do not blindly re-run** `20260718120000` if objects exist — it will error. Options:

**A — Repair ledger only** (if schema matches migration files):

```bash
cd /Users/jabbo/PLANEVO
npx supabase migration repair --status applied 20260717090000
npx supabase migration repair --status applied 20260717120000
npx supabase migration repair --status applied 20260718120000
npx supabase migration repair --status applied 20260719120000
npx supabase migration list
```

**B — Fresh database** (dev reset only):

```bash
npx supabase db push --linked
```

Use **A** on the current linked project. Use **B** only on a new Supabase project or after explicit founder approval.

---

## Icon catalog (Tasks smart icon picker — optional for Calendar/Files)

Table `icon_catalog` exists on linked remote but has **0 rows**. Seed after migration ledger includes `20260719120000`:

```bash
cd /Users/jabbo/PLANEVO
# Requires service role key — load from apps/web/.env.local or shell env
export $(grep -E '^(NEXT_PUBLIC_SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=' apps/web/.env.local | xargs)
export SUPABASE_URL="${SUPABASE_URL:-$NEXT_PUBLIC_SUPABASE_URL}"
node scripts/seed-icon-catalog.mjs
```

Verify:

```bash
npx supabase db query --linked "select count(*) from icon_catalog;"
```

Expected: thousands of rows (catalog JSON size).

---

## Post-migration smoke (SQL)

```bash
npx supabase db query --linked "
  select proname from pg_proc
  join pg_namespace n on n.oid = pg_proc.pronamespace
  where n.nspname = 'public'
  and proname = 'schedule_task_idempotent';
"
```

```bash
npx supabase db query --linked "
  select table_name from information_schema.tables
  where table_schema = 'public'
  and table_name in ('calendars','calendar_events','file_links','file_sources')
  order by 1;
"
```

---

## What you do NOT need for Phase 3

- No new migration file in this audit fix pass
- `20260719120000_icon_catalog.sql` — only for task icon search, not Calendar/Files routes
