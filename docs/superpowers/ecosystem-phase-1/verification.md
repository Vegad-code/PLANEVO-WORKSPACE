# Ecosystem Phase 1 — Verification Checklist

_Completed 2026-07-17. Commits: 8d0d4ab (T1) · 98ea7b1 (T2) · 7a31d07 (T3) · 0e88a62 (T4) ·
9189c36 (T5) · 88d0640 (T6) · 6b837a3 (T7) · 8afba8c (T8) · ac3e9fa (T9)._

- [x] New user signup creates `calendars` row + `tasks` starter rows — `create_user_products`
      RPC wired into `apps/web/app/onboarding/actions.ts` before workspace creation; wrapper
      covered by mocked-RPC tests. **Not exercised against live Postgres (see blocker).**
- [x] Onboarding creates workspace pages without task/calendar/files databases —
      `create_starter_workspace_v2` seeds Getting Started + Notes pages only; no
      `default_*_database_id` in settings_json; seed payload asserted DB-free in tests.
- [x] `workspace_links` table exists with RLS — migration `20260718120000` creates it with
      `is_workspace_owner` policy + grants; link/unlink/list mutations tested (F-02).
- [x] Legacy /tasks still renders (DatabaseFace) until Phase 2 — `face-databases.ts`
      unchanged behaviorally (`@deprecated` JSDoc + dev-only warn only); `apps/web`
      typechecks clean.
- [x] `packages/core` full suite: **120/120 pass** (includes product-defaults,
      create-user-products, workspace-links, create-starter-workspace tests).
- [x] `apps/web` `npx tsc --noEmit`: clean.
- [x] Migration guard tests pass: no `security definer`, no anon grants in any migration.
- [x] Migration applied — founder ran `20260718120000_ecosystem_product_tables.sql`
      directly via the Supabase hosted SQL Editor against Primary Database ("Success. No
      rows returned"), 2026-07-17. No local Docker/CLI used or required; this repo does
      not use local Supabase dev. Founder confirmed via information_schema query that all
      6 tables, both RPCs, and RLS policies exist.
