# Ecosystem Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the database and core-package foundation for Planevo v2 ecosystem architecture — product tables, link layer, signup seeding — without yet replacing product UIs (Phase 2).

**Architecture:** Strangler pattern. Add `tasks`, `calendars`, `calendar_events`, `workspace_links`, `file_links`; evolve `file_sources` to user-scoped; seed global products on signup; stop seeding task/calendar/files template databases in onboarding. Legacy `DatabaseFace` routes stay behind until Phase 2 but must not receive new product logic.

**Tech Stack:** Supabase Postgres + RLS, `@planevo/core` (Node test runner), Next.js App Router server actions, TypeScript strict.

## Global Constraints

- **Authority:** `docs/planevo-prd.md` v2.0 and `docs/planevo-feature-spec.md` v2.0 (F-01, F-02, F-45, DEP-01–03). `AGENTS.md` ecosystem rules.
- **No kernel faces for new code:** Do not add product logic to `face-databases.ts`, `DatabaseFace`, or `template_type` task/calendar/files paths.
- **View filter prefs:** Client-only (`localStorage` / `user_preferences.settings_json`). Never on product rows.
- **RLS:** Every new table gets policies checking `auth.uid()` via `user_id` or workspace ownership chain.
- **Migrations:** New file `supabase/migrations/20260718120000_ecosystem_product_tables.sql`. Do not edit applied migrations.
- **Tests:** `packages/core` — run `npm test` in `packages/core` after each task touching core.
- **Commits:** One commit per task. User did not request push.
- **Tokens:** No hardcoded hex/px in any touched UI files.
- **YAGNI:** Phase 1 is schema + core mutations + signup path only. No Lumis UI, no toast, no embed blocks (Phase 4).

---

## File map (Phase 1)

| File | Responsibility |
|------|----------------|
| `supabase/migrations/20260718120000_ecosystem_product_tables.sql` | Product tables, link layer, RLS, seed RPC |
| `packages/core/src/types/database.types.ts` | Generated/extended types for new tables |
| `packages/core/src/defaults/product-defaults.ts` | Default calendar name, starter task rows for onboarding |
| `packages/core/src/mutations/create-user-products.ts` | RPC wrapper: create global products for user |
| `packages/core/src/mutations/workspace-links.ts` | create/delete/list workspace links |
| `packages/core/src/queries/workspace-links.ts` | Filter helpers for workspace-scoped product queries |
| `packages/core/src/defaults/starter-workspaces.ts` | Remove task/calendar/files DB from seed payload |
| `supabase/migrations/20260717120000_starter_workspace_and_kernel.sql` | **Do not edit** — new migration supersedes seed behavior via new RPC |
| `apps/web/app/onboarding/actions.ts` | Call create-user-products + revised starter workspace |
| `apps/web/lib/ecosystem/feature-flags.ts` | `isEcosystemV2Enabled()` for gradual cutover |
| `packages/core/src/mutations/create-foundations.test.mjs` | Update tests for deprecated paths |

---

### Task 1: Product tables migration

**Files:**
- Create: `supabase/migrations/20260718120000_ecosystem_product_tables.sql`
- Test: manual `supabase db reset` or `supabase migration up`

**Interfaces:**
- Produces: SQL tables `tasks`, `task_subtasks`, `calendars`, `calendar_events`, `workspace_links`, `file_links`

- [ ] **Step 1: Write migration SQL**

```sql
-- tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'done', 'cancelled')),
  priority text check (priority is null or priority in ('low', 'medium', 'high')),
  due_at timestamptz,
  description_json jsonb not null default '{}'::jsonb,
  position numeric not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_user_position_idx on public.tasks (user_id, position);
create index tasks_user_due_idx on public.tasks (user_id, due_at) where due_at is not null;

-- task_subtasks
create table public.task_subtasks (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  title text not null,
  is_done boolean not null default false,
  position numeric not null default 0,
  created_at timestamptz not null default now()
);
create index task_subtasks_task_position_idx on public.task_subtasks (task_id, position);

-- calendars
create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null default 'slate',
  is_visible boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index calendars_user_position_idx on public.calendars (user_id, position);

-- calendar_events
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  location text,
  description_json jsonb not null default '{}'::jsonb,
  task_id uuid references public.tasks (id) on delete set null,
  google_event_id text,
  source text not null default 'planevo'
    check (source in ('planevo', 'google')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index calendar_events_calendar_start_idx on public.calendar_events (calendar_id, starts_at);
create index calendar_events_user_start_idx on public.calendar_events (user_id, starts_at);

-- workspace_links (F-02)
create table public.workspace_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  resource_type text not null check (resource_type in ('task', 'calendar_event', 'file')),
  resource_id uuid not null,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (workspace_id, resource_type, resource_id)
);
create index workspace_links_workspace_type_idx
  on public.workspace_links (workspace_id, resource_type);

-- file_links (cross-feature)
create table public.file_links (
  id uuid primary key default gen_random_uuid(),
  file_source_id uuid not null references public.file_sources (id) on delete cascade,
  target_type text not null check (target_type in ('task', 'calendar_event')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  unique (file_source_id, target_type, target_id)
);
```

- [ ] **Step 2: Add RLS policies in same migration**

```sql
alter table public.tasks enable row level security;
create policy tasks_owner on public.tasks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.task_subtasks enable row level security;
create policy task_subtasks_via_task on public.task_subtasks for all to authenticated
  using (exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.tasks t where t.id = task_id and t.user_id = auth.uid()));

-- Repeat pattern for calendars, calendar_events, workspace_links (via workspace owner), file_links (via file owner)
```

- [ ] **Step 3: Add `user_id` to `file_sources` (nullable first, backfill, then NOT NULL in follow-up task if data exists)**

```sql
alter table public.file_sources add column if not exists user_id uuid references auth.users (id) on delete cascade;
update public.file_sources set user_id = created_by where user_id is null;
```

- [ ] **Step 4: Apply locally**

Run: `cd /Users/jabbo/PLANEVO && supabase db reset`  
Expected: migration applies without error

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260718120000_ecosystem_product_tables.sql
git commit -m "feat(db): add ecosystem product tables and link layer (Phase 1)"
```

---

### Task 2: TypeScript database types

**Files:**
- Modify: `packages/core/src/types/database.types.ts`

**Interfaces:**
- Consumes: migration schema from Task 1
- Produces: `Database['public']['Tables']['tasks']`, etc.; RPC slot for `create_user_products`

- [ ] **Step 1: Regenerate or hand-add types for new tables**

Run: `supabase gen types typescript --local > packages/core/src/types/database.types.ts`  
Or hand-add matching Row/Insert/Update for `tasks`, `task_subtasks`, `calendars`, `calendar_events`, `workspace_links`, `file_links`.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd packages/core && npx tsc --noEmit 2>/dev/null || npm test`  
Expected: no new type errors in consumers

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(core): add TypeScript types for ecosystem product tables"
```

---

### Task 3: Product defaults config

**Files:**
- Create: `packages/core/src/defaults/product-defaults.ts`
- Create: `packages/core/src/defaults/product-defaults.test.mjs`
- Modify: `packages/core/package.json` (add test to script)

**Interfaces:**
- Produces: `buildProductSeedPayload(): { calendarName: string; starterTasks: Array<{ title: string; status: string }> }`

- [ ] **Step 1: Write failing test**

```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildProductSeedPayload } from "./product-defaults.ts";

test("buildProductSeedPayload returns default calendar and onboarding tasks", () => {
  const seed = buildProductSeedPayload({ organizing: "school" });
  assert.equal(seed.calendarName, "My Calendar");
  assert.ok(seed.starterTasks.length >= 4);
  assert.ok(seed.starterTasks.some((t) => /rename/i.test(t.title)));
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd packages/core && node --experimental-strip-types --test src/defaults/product-defaults.test.mjs`

- [ ] **Step 3: Implement `product-defaults.ts`**

```typescript
export type OrganizingAnswer = "work" | "personal" | "school" | "other";

export function buildProductSeedPayload(input: { organizing: OrganizingAnswer | null }) {
  const calendarName = "My Calendar";
  const starterTasks = [
    { title: "Rename this workspace", status: "not_started" },
    { title: "Add your first real task", status: "not_started" },
    { title: "Drag a task to Done", status: "not_started" },
    { title: "Connect Google Calendar", status: "not_started" },
    { title: "Import from Notion", status: "not_started" },
  ];
  if (input.organizing === "school") {
    starterTasks[2] = { title: "Move a task across the board", status: "not_started" };
  }
  return { calendarName, starterTasks };
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

---

### Task 4: `create_user_products` RPC + TS wrapper

**Files:**
- Modify: `supabase/migrations/20260718120000_ecosystem_product_tables.sql` (append function)
- Create: `packages/core/src/mutations/create-user-products.ts`
- Create: `packages/core/src/mutations/create-user-products.test.mjs`

**Interfaces:**
- Consumes: `buildProductSeedPayload`
- Produces: `createUserProducts(client, { userId, organizing }) => Promise<{ calendarId: string; taskIds: string[] }>`

- [ ] **Step 1: Add SQL function `create_user_products(p_user_id uuid, p_seed jsonb)`**

Inserts one calendar + starter tasks from seed JSON. Idempotent: if user already has calendar, skip.

- [ ] **Step 2: Write TS wrapper with validation**

- [ ] **Step 3: Test with mocked RPC client (pattern from `create-foundations.test.mjs`)**

- [ ] **Step 4: Commit**

---

### Task 5: Workspace links mutations

**Files:**
- Create: `packages/core/src/mutations/workspace-links.ts`
- Create: `packages/core/src/queries/workspace-links.ts`
- Create: `packages/core/src/mutations/workspace-links.test.mjs`

**Interfaces:**
- Produces:
  - `linkResourceToWorkspace(client, { workspaceId, resourceType, resourceId })`
  - `unlinkResourceFromWorkspace(client, { workspaceId, resourceType, resourceId })`
  - `listWorkspaceResourceIds(client, { workspaceId, resourceType })`

- [ ] **Step 1: Failing tests for link/unlink/list**

- [ ] **Step 2: Implement mutations + queries**

- [ ] **Step 3: Run `npm test` in packages/core — PASS**

- [ ] **Step 4: Commit**

---

### Task 6: Revise starter workspace seed (no product DBs)

**Files:**
- Modify: `packages/core/src/defaults/starter-workspaces.ts`
- Modify: `packages/core/src/defaults/starter-workspaces.test.mjs`

**Interfaces:**
- Consumes: F-45 spec — seed pages/checklist only
- Produces: `buildStarterSeedPayload()` without `taskDatabase`, `calendarDatabase`, `filesDatabase` keys

- [ ] **Step 1: Update tests to assert seed has pages but no template_type task/calendar/files**

- [ ] **Step 2: Remove product DB sections from seed builder**

- [ ] **Step 3: Run starter-workspaces tests — PASS**

- [ ] **Step 4: Commit**

---

### Task 7: New `create_starter_workspace_v2` RPC

**Files:**
- Modify: `supabase/migrations/20260718120000_ecosystem_product_tables.sql`
- Modify: `packages/core/src/mutations/create-starter-workspace.ts`

**Interfaces:**
- Produces: RPC that seeds workspace pages only; does not write `default_*_database_id` to settings_json

- [ ] **Step 1: Add `create_starter_workspace_v2` or replace behavior behind flag in migration**

- [ ] **Step 2: Update TS wrapper to call v2 RPC**

- [ ] **Step 3: Commit**

---

### Task 8: Wire onboarding signup flow

**Files:**
- Modify: `apps/web/app/onboarding/actions.ts`
- Modify: `apps/web/lib/mutations/create-foundations.ts` (if signup path lives there)

**Interfaces:**
- Consumes: `createUserProducts`, `createStarterWorkspace` v2

- [ ] **Step 1: On onboarding complete — call `createUserProducts` then `createStarterWorkspace`**

- [ ] **Step 2: Remove calls that create task/calendar/files template databases**

- [ ] **Step 3: Manual smoke: signup flow still redirects to Getting Started**

- [ ] **Step 4: Commit**

---

### Task 9: Feature flag + deprecate face routes

**Files:**
- Create: `apps/web/lib/ecosystem/feature-flags.ts`
- Modify: `apps/web/lib/queries/face-databases.ts` (add `@deprecated` JSDoc + console.warn in dev)

**Interfaces:**
- Produces: `isEcosystemV2Enabled(): boolean` — env `PLANEVO_ECOSYSTEM_V2=true` or `user_preferences.settings_json.ecosystem_v2`

- [ ] **Step 1: Implement feature flag helper**

- [ ] **Step 2: Add deprecation comments to face-databases; no behavior change yet**

- [ ] **Step 3: Commit**

---

### Task 10: Phase 1 integration verification

**Files:**
- Create: `docs/superpowers/ecosystem-phase-1/verification.md` (checklist only)

- [ ] **Step 1: Run full core test suite**

Run: `cd packages/core && npm test`  
Expected: all pass

- [ ] **Step 2: Run web typecheck if available**

Run: `cd apps/web && npx tsc --noEmit`

- [ ] **Step 3: Document verification checklist**

```markdown
- [ ] New user signup creates `calendars` row + `tasks` starter rows
- [ ] Onboarding creates workspace pages without task/calendar/files databases
- [ ] `workspace_links` table exists with RLS
- [ ] Legacy /tasks still renders (DatabaseFace) until Phase 2
```

- [ ] **Step 4: Commit**

---

## Phase 1 completion criteria (orchestrator `/goal`)

Phase 1 is **done** when all of the following are true:

1. Migration `20260718120000_ecosystem_product_tables.sql` applies cleanly on fresh `supabase db reset`.
2. `packages/core` tests pass including new product-defaults, workspace-links, create-user-products tests.
3. Onboarding creates global products + workspace pages without template task/calendar/files databases.
4. `face-databases.ts` marked deprecated; no new product logic added there.
5. Verification checklist in `docs/superpowers/ecosystem-phase-1/verification.md` is complete.

**Out of scope for Phase 1:** Lumis Tasks UI, Calendar week grid, Files cabinet UI, link toast, embed blocks, deleting DatabaseFace routes.

---

## Spec coverage self-review

| Spec | Task |
|------|------|
| F-01 workspace context | Tasks 6–8 (settings_json cleanup) |
| F-02 link layer schema | Tasks 1, 5 |
| F-45 onboarding v2 | Tasks 3, 6, 7, 8 |
| DEP-02 template DBs deprecated | Tasks 6, 7, 9 |
| PRD §7.3 strangler Phase A | Task 1 |
| PRD Phase 1 roadmap | All tasks |

---

*Plan version 1.0 · July 17, 2026 · Companion: `docs/superpowers/prompts/fable-5-phase-1-orchestrator.md`*
