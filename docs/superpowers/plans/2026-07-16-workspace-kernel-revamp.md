# Workspace Kernel Revamp (Scope C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Deliver production-ready Workspace kernel through F-08 + ease mechanics F-10, F-11, F-12 per `docs/planevo-feature-spec.md`.

**Architecture:** Single kernel path — `database-templates.ts` → `createDatabase()` RPC; shared BlockNote editor for pages and records; relations via join table; dnd-kit sidebar tree; faces route to `DatabaseWorkspace`.

**Tech Stack:** Next.js 16 App Router, BlockNote 0.51 + shadcn, Supabase RLS, dnd-kit, packages/core validation shared by UI and API.

## Global Constraints

- Tokens only in components — no hardcoded hex/font sizes (`AGENTS.md`).
- One marigold accent per view.
- Manual-first: every AI-capable action has a human path.
- BlockNote JSON stored verbatim in `content_json`.
- Property `type` is plain TEXT, never Postgres ENUM.
- Relations in `relations` join table, never JSONB ID arrays.
- RLS on every table; `getUser()` not `getSession()` on server.
- Workspace-first IA outside Home.

---

## Phase 1 — Kernel schema & templates (blocking)

- [ ] Task 1: Migration — `records.content_json`, `records.deleted_at`, `records.source_block_id`, fractional `position` on pages/records
- [ ] Task 2: `packages/core/src/defaults/database-templates.ts` (F-11 all templates)
- [ ] Task 3: `create_database_from_template` RPC + `createDatabase()` in core
- [ ] Task 4: Align task template to F-11 spec; relations write path in core

## Phase 2 — BlockNote editor platform

- [ ] Task 5: Migrate `@blocknote/mantine` → `@blocknote/shadcn` + token bridge
- [ ] Task 6: `planevoSchema` with `database_view` custom block
- [ ] Task 7: Slash / side / formatting toolbar controllers
- [ ] Task 8: Saved indicator, 500ms debounce, shared `PlanevoEditor` component

## Phase 3 — Records & pages

- [ ] Task 9: Record routes `/records/[recordId]` + peek → full page
- [ ] Task 10: Properties header on record page (inline edit)
- [ ] Task 11: Soft delete trash + restore (30 days)

## Phase 4 — Database views (F-05)

- [ ] Task 12: Filter/sort/search toolbar + view config persistence
- [ ] Task 13: Board drag between columns (optimistic upsert)
- [ ] Task 14: Calendar drag-day + empty-day create
- [ ] Task 15: Column resize/reorder/hide in table view
- [ ] Task 16: Relation + person pickers

## Phase 5 — Sidebar & tree (F-02)

- [ ] Task 17: dnd-kit page tree reorder/nest
- [ ] Task 18: Page icon + cover image
- [ ] Task 19: Database creation from sidebar + `/database` slash

## Phase 6 — Retroactive structure (F-10)

- [ ] Task 20: Promote panel + `replaceBlocks` → `database_view`
- [ ] Task 21: Turn back into text (reverse path)
- [ ] Task 22: `natural-capture.ts` parser for property detection

## Phase 7 — Faces unification (F-08)

- [ ] Task 23: Tasks/Calendar/Files through `DatabaseWorkspace` + recreate-if-missing
- [ ] Task 24: Workspace face as live canvas (not static directory)

## Phase 8 — Duplicate-and-strip (F-12)

- [ ] Task 25: Page duplicate-as-template (clear text, fresh block UUIDs)
- [ ] Task 26: Database duplicate menu (full + template)

## Phase 9 — Polish & `/design`

- [ ] Task 27: Editor + database states on `/design` route
- [ ] Task 28: Integration tests + typecheck gate
