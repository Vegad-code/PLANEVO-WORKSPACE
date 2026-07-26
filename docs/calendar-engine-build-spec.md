# Calendar Engine — Build Spec

**Audience:** an AI coding agent (Codex 5.6 Sol first, then Cursor / Composio 2.5 / Grok 4.5 for touch-ups).
**Repo:** `/Users/jabbo/PLANEVO` · branch `codex/calendar-month-premium-hybrid`
**Companions:** `calendar-trajectory.md` (status) · `calendar-audit-2026-07-25.md` (findings) · `calendar-view-engine-and-aesthetic-2026-07-25.md` (architecture + research)

---

## 0. How to use this document

Work orders are **WO-1 … WO-9**, in dependency order. Each is independently shippable and independently verifiable.

**Rules for the implementing agent:**

1. **Do one work order at a time.** Finish it, run the verification block, commit. Do not start WO-N+1 with WO-N failing.
2. **Read before writing.** Every WO names the files it touches. Read all of them fully before editing any of them.
3. **Do not rebuild what exists.** §2 lists what is already built. Extend it.
4. **If a spec here contradicts the code, stop and say so** in your output. Do not silently pick one.
5. **Never mark a WO done without running its verification block** and pasting real output.
6. **Do not "improve" past the spec.** No new abstractions, no refactors outside the named files, no dependency additions beyond those listed.

---

## 1. Non-negotiable repo conventions

These are learned from the codebase. Violating them breaks the build or the review.

### Code

| Rule | Detail |
|---|---|
| **Relative imports carry `.ts`** | `import { x } from "./view-config.ts"` — extensionless breaks the test runner |
| **No hardcoded colors, fonts, spacing** | Every value is a CSS custom property in `globals.css`, surfaced via the Tailwind theme. **No `bg-[#F5F3ED]`, no `text-[13px]`.** A palette swap must be a one-file edit |
| **Tailwind class maps must use literals** | Dynamic class strings get purged. See `calendar-color-dot.tsx` for the `Record<K, string>` pattern |
| **TypeScript strict** | `npx tsc --noEmit` must be clean |
| **Next.js is a modified build** | `apps/web/AGENTS.md`: read `node_modules/next/dist/docs/` before using any Next API. Do not assume framework behavior from memory |
| **Read `AGENTS.md` at the repo root first** | Inviolable product rules live there |

### Tests

- Files are `*.test.mjs`, colocated, using `node:test` + `node:assert/strict`.
- They import `.ts` sources directly — run under `--experimental-strip-types`.
- `apps/web/package.json` test glob already covers `lib/calendar/*.test.mjs`, `lib/mutations/*.test.mjs`, `features/tasks-product/*.test.mjs`. **New directories must be added to that glob or the tests silently never run.**
- Comment style in tests is `// Arrange / Act / Assert`.
- Run: `cd apps/web && npm test`

### Migrations

- Named `YYYYMMDDHHMMSS_snake_case.sql` in `supabase/migrations/`.
- **Applied via the hosted Supabase SQL Editor by a human — never `supabase db push`, never local Docker.** You write the file; you do not apply it. Say so in your handoff.
- Must be **idempotent**: `add column if not exists`, `create index if not exists`, `drop policy if exists` before `create policy`.
- RLS pattern: `using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))`.
- Functions: **always** `language plpgsql security invoker set search_path = ''`. A `security definer` anywhere in this repo is a bug.
- Always `grant select, insert, update, delete on public.<table> to authenticated;` for new tables.
- Never write a backfill that moves user data. Prefer nullable columns with a legacy fallback path.

### Server actions

Pattern in `apps/web/app/(workspace)/calendar/actions.ts` — copy it exactly:
1. `"use server"` at file top
2. zod schema per action, including cross-field `.refine()`
3. `requireMutationDataAccess()` for auth
4. Ownership re-check in app code (`requireOwnedEvent` / `requireOwnedCalendar`) on top of RLS
5. `actionError()` wrapper with correlation IDs
6. `revalidatePath("/calendar")` (and `/tasks` when tasks change)

### Known pre-existing failure — do not chase

`apps/web/lib/calendar/format-now-indicator-time.test.mjs` fails with `'11 :10 AM'` vs `'11 : 10 AM'`. It is an ICU spacing difference, both files are untracked from earlier work, and it is **unrelated to every work order here.** Baseline is **173/174 passing.**

---

## 2. What already exists — do not rebuild

| Thing | Where | Note |
|---|---|---|
| 8-axis view config + zod schema | `apps/web/lib/calendar/view-config.ts` | `ViewConfig`, `viewConfigSchema`, `VIEW_LAYOUTS` |
| Presets Classic / Planner / Flow | same file | `PRESET_CONFIGS`, `MONTH_CONFIG`, `DEFAULT_VIEW_CONFIG` |
| Config resolution | same file | `resolveViewConfig(preset, stored)` — merges partial over base, degrades to Classic on bad input |
| Renderer registry | `apps/web/lib/calendar/view-registry.ts` | `REGISTRY`, `resolveRenderer`, `isLayoutImplemented`, `configForLegacyView` |
| `calendar_views` table + `calendars.is_default` | `supabase/migrations/20260725120000_calendar_views_and_defaults.sql` | **⚠️ NOT YET APPLIED** |
| Types | `packages/core/src/types/calendar.ts` | `CalendarViewRow`, `CalendarRow.is_default` |
| Data layer (renderer-agnostic) | `packages/core/src/queries/product-calendar.ts`, `apps/web/features/calendar-product/use-calendar-data.ts` | Already returns plain rows |
| Adapters | `lib/calendar/rbc-event-adapter.ts`, `lib/calendar/month-items.ts` | Pattern to copy for a third renderer |
| Motion primitives | `lib/calendar/calendar-nav-motion.ts`, `features/calendar-product/calendar-view-transition.tsx`, `lib/motion/use-prefers-reduced-motion.ts` | New renderers inherit enter/exit free |
| DnD | `features/calendar-product/calendar-dnd-context.tsx` | dnd-kit, single context (cannot nest) |
| Idempotent writes | `operation_key` on `calendar_events` | Reuse for any new mutation |

**Shared chrome that every renderer reuses as-is** — do not fork these: toolbar, detail panel/popover, quick capture, hotkeys, planning sidebar, query provider, DnD context.

---

## WO-1 · Data foundation: timezone, recurrence, soft delete

**Why first:** it gates everything. Recurrence changes what a renderer must draw, and the timezone migration gets strictly harder with every row added.

**Deliverable:** one migration file. No app code.

### Schema

```sql
alter table public.calendar_events
  add column if not exists starts_at_local timestamp,      -- authored wall clock, no zone
  add column if not exists ends_at_local   timestamp,
  add column if not exists timezone        text,           -- IANA id, e.g. 'America/New_York'
  add column if not exists duration_minutes integer,        -- prefer over ends_at for DST safety
  add column if not exists rrule           text,           -- RFC5545 RRULE, series master only
  add column if not exists recurrence_end  timestamptz,
  add column if not exists parent_event_id uuid references public.calendar_events (id) on delete cascade,
  add column if not exists recurrence_id   timestamptz,    -- original occurrence this overrides
  add column if not exists is_exception    boolean not null default false,
  add column if not exists is_cancelled    boolean not null default false,
  add column if not exists deleted_at      timestamptz,
  add column if not exists color           text,           -- per-event override; null = calendar color
  add column if not exists conference_url  text;
```

### Rules the implementation must honor

- **`starts_at`/`ends_at` (timestamptz) remain the indexed query columns.** They become a *derived cache* recomputed from `starts_at_local` + `timezone`. Do not drop them.
- **`timezone IS NULL` means "legacy row"** — render using `starts_at` exactly as today. **No destructive backfill.** This is what makes the migration safe to apply on live data.
- `parent_event_id` + `recurrence_id` identify an override of one occurrence. `is_cancelled` marks a deleted single occurrence (an EXDATE).
- Exception columns ship **now**, even though recurrence UI lands in WO-2. Adding them later means migrating existing series.

### Indexes

```sql
create index if not exists calendar_events_user_start_live_idx
  on public.calendar_events (user_id, starts_at) where deleted_at is null;
create index if not exists calendar_events_parent_idx
  on public.calendar_events (parent_event_id) where parent_event_id is not null;
```

### Acceptance
- [ ] Migration file is fully idempotent (re-running is a no-op)
- [ ] No `update` statement that changes an existing row's time
- [ ] No `security definer` introduced
- [ ] File named `supabase/migrations/2026MMDDHHMMSS_calendar_event_model.sql`
- [ ] Handoff explicitly states: **must be applied via hosted SQL Editor, alongside the still-pending `20260725120000`**

---

## WO-2 · Recurrence expansion + UI

**Depends on:** WO-1 applied.
**New dependency:** `rrule` (BSD-3-Clause). `npm i rrule -w web`. **Do not add any other package.**

### 2a. Pure expansion module

Create `apps/web/lib/calendar/recurrence.ts`:

```ts
export type ExpandInput = {
  master: CalendarEventRow            // has rrule, starts_at_local, timezone, duration_minutes
  exceptions: CalendarEventRow[]      // rows with parent_event_id === master.id
  windowStart: Date
  windowEnd: Date
}

/**
 * Expands a series into concrete instances inside the window.
 * - Occurrences matching a cancelled exception are omitted.
 * - Occurrences matching an override exception are replaced by it.
 * - Instances are synthetic: id is `${master.id}::${recurrenceId}`.
 */
export function expandRecurrence(input: ExpandInput): CalendarEventRow[]

/** Splits a synthetic instance id back into its parts. Returns null for a real id. */
export function parseInstanceId(id: string): { masterId: string; recurrenceId: string } | null
```

**Correctness requirements:**
- Use rrule's **object API** (`new RRule({...})`), **not** `RRule.fromString()` — there is an open bug where EXDATE/RDATE are dropped when parsing raw `RRULE:` strings.
- `dtstart` is not guaranteed to be the first instance unless it matches the rule. Test this case explicitly.
- Cap expansion at **windowEnd** — never expand an unbounded rule to completion.
- Duration comes from `duration_minutes`, not `ends_at - starts_at`, so a DST-crossing occurrence keeps its intended length.

### 2b. Wire into the query layer

In `packages/core/src/queries/product-calendar.ts`, after the range query: fetch masters whose series could overlap the window, fetch their exceptions, expand, merge with non-recurring rows, sort. **Filter `deleted_at is null` everywhere.**

### 2c. UI

- Recurrence picker in `event-detail-panel.tsx`: None / Daily / Weekly on {days} / Monthly / Yearly / Custom RRULE. Uses existing form tokens only.
- Editing or deleting an instance prompts: **"This event" / "This and following" / "All events."**
  - *This event* → write an exception row (`parent_event_id`, `recurrence_id`, `is_exception`)
  - *This and following* → set `recurrence_end` on the master, create a new master from the split point
  - *All events* → edit the master
- `parse-event-capture.ts` already detects recurrence phrases and declines. **Make it accept them** and emit an RRULE.

### Acceptance
- [ ] `lib/calendar/recurrence.test.mjs` covers: weekly expansion across a window boundary; a cancelled occurrence is omitted; an override replaces the right instance; DST-crossing occurrence keeps `duration_minutes`; `dtstart` not matching the rule
- [ ] A weekly event renders on every matching day in week and month views
- [ ] Deleting one occurrence leaves the rest intact
- [ ] `npm test` = baseline + new tests, no regressions

---

## WO-3 · Task round-trip

**Independent of WO-1/2.** Highest user-visible value in the whole plan.

Fix the four divergences documented in `calendar-audit-2026-07-25.md` §A3.

| # | Behavior required | Touch |
|---|---|---|
| 1 | Moving/resizing a task-linked event updates `tasks.due_at` | `packages/core/src/mutations/product-calendar.ts` |
| 2 | Completing the task marks the linked event done (and styles it) | `product-tasks.ts`, `rbc-event-content.tsx`, `month-event-bar.tsx` |
| 3 | Completing the event completes the task | `product-calendar.ts` |
| 4 | Deleting a task asks: delete the linked block too, or keep it? Never silently orphan | `delete_task_cascade` (new migration), task delete UI |

Plus:
- **Task badge on event cards.** A scheduled task must be visibly a task. `rbc-event-content.tsx` and `month-event-bar.tsx` currently have zero references to `task_id`. Icon + accessible label — **never color alone** (WCAG 1.4.1).
- **Honor task duration.** `scheduleTaskFromDrag` hardcodes `DRAG_SCHEDULE_DURATION_MS = 60min`. Use the task's estimate when present.
- **Unschedule.** Dragging a task-linked event off the grid deletes the event and returns the task to the backlog. No path exists today.

### Acceptance
- [ ] `lib/mutations/task-calendar-roundtrip.test.mjs` covers all four directions
- [ ] Task badge renders and is keyboard/screen-reader reachable
- [ ] No orphaned events reachable through any path
- [ ] Delete-confirm copy updated — it currently says "Linked tasks stay in Tasks"

---

## WO-4 · Undo

**Depends on:** WO-1 (`deleted_at`).

- Toast with **Undo** on: event delete, drag-move, resize, task unschedule.
- Implement in **shared chrome**, not per renderer, so every future renderer inherits it.
- Undo window: 8 seconds. Undo restores prior state (for delete, clears `deleted_at`).
- Delete becomes soft everywhere. Every read path filters `deleted_at is null`.

### Acceptance
- [ ] `lib/calendar/undo-stack.test.mjs` — push/pop, expiry, restore payload correctness
- [ ] Undo after a drag restores the exact prior times
- [ ] No read path returns soft-deleted rows (grep every `.from("calendar_events")`)

---

## WO-5 · View CRUD + management UI

**Depends on:** `20260725120000` applied.

### Server actions (`app/(workspace)/calendar/actions.ts`)
`createCalendarViewAction`, `updateCalendarViewAction`, `deleteCalendarViewAction`, `setDefaultCalendarViewAction` — all following the §1 action pattern. Validate `config` with `viewConfigSchema.partial()`; store only overrides, never the resolved config.

### UI
- View switcher in `calendar-toolbar.tsx` — lists saved views, marks the default.
- Create/edit panel: name, preset picker (Classic / Planner / Flow), source-calendar multi-select, `include_task_dues` toggle.
- **Presets first.** The 8 raw axes live behind a "Customize" disclosure that is collapsed by default. This is a product rule, not a preference — configurability is the documented churn driver.
- **There is no calendar edit UI today** (`calendar-sources-section.tsx` is create + visibility only). Add rename/edit/set-default there too.

### Behavioral rule — do not get this wrong
**A view filters what is drawn. It never filters availability.** Conflict detection, free/busy, and any auto-placement read the user's whole event pool regardless of `source_calendar_ids`. Booking over a hidden event must still report a conflict.

### Acceptance
- [ ] `lib/calendar/view-crud.test.mjs` — partial config round-trips; setting a default clears the previous one
- [ ] A user with zero saved views still gets a working calendar (Classic fallback)
- [ ] Deleting a calendar referenced by a view does not break that view
- [ ] Only one `is_default` per user survives concurrent writes (the partial unique index enforces this — test it)

---

## WO-6 · Timeline renderer

**Depends on:** WO-2 (else it gets built twice).

Unlocks the **Planner** and **Flow** presets — the first genuinely different paradigm.

### Files
- `apps/web/lib/calendar/timeline-items.ts` — adapter, mirroring `month-items.ts`
- `apps/web/features/calendar-product/timeline-grid.tsx` — the renderer
- Register in `view-registry.ts`: `"single-timeline": TIMELINE`

### Spec
- Single vertical column, one day.
- `timeAxis.rowHeight: "proportional-to-duration"` → block height scales with duration (Flow). `"fixed"` → uniform rows (Planner).
- `timeAxis.mode: "cropped-working-hours"` → axis starts at the first event and ends after the last, with padding. `"auto-scale-to-content"` → axis fits content exactly.
- `sidebarMode: "task-backlog"` and `"inbox-capture"` bind to the existing planning sidebar.
- Reuses: detail popover, DnD context, hotkeys, `CalendarViewTransition`.
- **Accessibility is not optional here.** Month's `role="grid"` + roving tabindex is the quality bar. The RBC week/day view falls short of it — do not copy that gap forward.

### Layout math
Write `apps/web/lib/calendar/interval-layout.ts` — interval partitioning: sort by start, greedily assign each event to the first free column, track max concurrent columns per collision cluster, width = container ÷ maxColumns.

Reference implementations to **read, not copy**: `react-big-calendar/src/utils/layout-algorithms/overlap.js` (note its known bugs — hardcoded 30-minute same-line threshold, issues #1530/#2240/#1843), FullCalendar core segment placement, `@event-calendar/core`. **Schedule-X (MIT) is the only project code may be taken from.**

### Acceptance
- [ ] `lib/calendar/interval-layout.test.mjs` — non-overlapping full width; two overlapping split 50/50; three-way overlap; a long event overlapping two short ones; zero-duration event
- [ ] Switching preset Classic → Flow re-renders without remount errors
- [ ] Keyboard navigation reaches every event
- [ ] `prefers-reduced-motion` respected

---

## WO-7 · Workspace embed

**Depends on:** WO-5, WO-6.

Copy the working `database_view` block end-to-end — `apps/web/features/editor/schema.tsx:11-47` is the template.

1. `createReactBlockSpec({ type: "calendar_embed", propSchema: { viewId, height } })`
2. Render component fetching from a new `/api/embedded-calendar?viewId=…` route, mirroring `/api/embedded-database`
3. `toExternalHTML` fallback for copy/export
4. Register in `planevoSchema.extend` (`schema.tsx:75-82`)
5. Slash-menu entry in `slash-menu-items.tsx`

The block stores **only a `viewId`.** It renders through the same registry as `/calendar`. There must be exactly one rendering path — no second implementation, no copied config.

### Acceptance
- [ ] Embedding a view and then editing that view updates the embed
- [ ] Deleting the view degrades gracefully (placeholder, not a crash)
- [ ] Embed respects RLS — another user's `viewId` returns nothing

---

## WO-8 · ICS subscribe → Google read sync

Ship **ICS first** — a fraction of the work, and it covers Apple/Outlook/any provider.

- **8a ICS subscribe:** store a feed URL per calendar; poll; parse with `ical.js` or `node-ical`; upsert as read-only rows with `source`. Gotcha: providers refresh ICS on their own schedule (Google ~12–24h, Apple hourly) — surface "last synced," never promise realtime.
- **8b Google read sync:** OAuth, then `watch()` + `syncToken` incremental pull into the existing `google_event_id` / `source` columns (currently inert placeholders). **Watch channels expire (max ~30 days) — a renewal job is mandatory or notifications silently stop.**
- External events render **read-only** — no edit affordances, visually distinct.

---

## WO-9 · Reminders

`event_reminders (event_id, offset_minutes, method)`. Browser Notification API first.

⚠️ **Product warning from the research:** unreliable notifications destroy trust faster than missing ones. Shipping half a reminder system may be worse than shipping none. Confirm scope with the founder before building delivery.

---

## 3. Anti-scope — do not do these

- ❌ Do not add attendees/RSVP. Out of scope for the year pending a decision.
- ❌ Do not add AI auto-scheduling. House rule is manual-first, present-not-pushy. The research shows users resent schedulers that move their day.
- ❌ Do not copy code from Cal.com, Nextcloud, Radicale, Baïkal, EteSync, Etar, or Fossify — all GPL/AGPL. Reading for ideas is fine.
- ❌ Do not add a calendar UI library. The engine is headless by decision.
- ❌ Do not replace react-big-calendar. It stays as "Classic."
- ❌ Do not hardcode any color, font, or pixel value.
- ❌ Do not use `security definer`.
- ❌ Do not apply migrations yourself.
- ❌ Do not expose the 8 raw axes as the primary UI. Presets first.
- ❌ Do not fix `format-now-indicator-time.test.mjs`. Pre-existing, unrelated.

---

## 4. Verification protocol — run after every work order

```bash
cd apps/web && npx tsc --noEmit
```
```bash
cd apps/web && npm test
```

**Pass = `tsc` silent, and test count ≥ baseline with only the known `format-now-indicator-time` failure.**

Then, for anything visually observable:
1. Start the dev server through the preview tooling (never a bare `npm run dev` in a terminal)
2. Load `/calendar`, switch every view, create/drag/resize an event
3. Check the browser console for errors
4. Confirm `prefers-reduced-motion` still suppresses transforms

**Report honestly.** If a step was skipped, say it was skipped. If tests fail, paste the output. A WO with unverified claims is not done.

---

## 5. Handoff checklist

Before declaring any work order complete:

- [ ] `npx tsc --noEmit` clean — output pasted
- [ ] `npm test` at or above baseline — output pasted
- [ ] New logic has a `*.test.mjs` beside it
- [ ] New test directories added to the `apps/web/package.json` test glob
- [ ] No hardcoded hex / font / px introduced (`grep -rn "#[0-9a-fA-F]\{6\}\|text-\[\|bg-\[" ` over touched files)
- [ ] No `security definer` introduced
- [ ] Migrations listed explicitly as **pending human application via hosted SQL Editor**
- [ ] Anything skipped, guessed, or left incomplete is named out loud
- [ ] Files touched listed with one-line reasons

---

## 6. Current pending migrations

Both need a human to run them in the hosted Supabase SQL Editor:

1. `supabase/migrations/20260725120000_calendar_views_and_defaults.sql` — **written, not applied**
2. WO-1's `calendar_event_model.sql` — **not yet written**

Until #1 is applied, `calendars.is_default` and `calendar_views` exist in TypeScript types but not in the database. Any code path touching them will fail at runtime.
