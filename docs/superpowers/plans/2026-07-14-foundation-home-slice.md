# Planevo Foundation and Home Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a side-effect-free Planevo shell, the real destinations required by Home, and the responsive Home command center backed by live Supabase empty or user-created data.

**Architecture:** Next.js Server Components own reads and Server Actions own explicit writes. Supabase remains the source of truth; production routes never seed, fabricate, or substitute records. Shared client components provide navigation, overlays, task composition, search, and command interactions, while `/design` alone may use clearly named preview data to render component states.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 tokens, Supabase Postgres/Auth/Storage with RLS, Node test runner, Vercel AI SDK/Gateway in the later AI task.

## Global Constraints

- Workspace-first IA, never agent-first.
- Reference images are craft-only, never layout.
- Production routes show only live Supabase data or an explicit empty/unavailable state; no fixture fallback and no read-time writes.
- Only explicit user actions may create an auth user, workspace, database, view, record, page, file object, or AI action.
- Every new component appears in `/design` with its meaningful states before use in a product screen.
- Components use centralized theme utilities only; never raw hex values, font names, or arbitrary pixel values.
- `marigold` appears at most once per screen; Planevo AI uses `slate` and never dominates.
- Flat surfaces only: no gradients, glow, or heavy shadows.
- The shell supports expanded 210px, rail 56px, 200ms hover-peek, Escape dismissal, pinning, and Command-backslash persistence.
- Desktop, tablet, and 390px mobile are first-class; mobile navigation is a slide-over drawer.
- No sign-in or sign-out UI is introduced in this slice.

---

### Task 1: Make shell reads side-effect-free and honest

**Files:**
- Create: `apps/web/lib/queries/workspace-shell.test.mjs`
- Modify: `apps/web/lib/queries/workspace-shell.ts`
- Modify: `apps/web/lib/data/access.ts`
- Modify: `apps/web/app/(workspace)/page.tsx`
- Modify: `apps/web/app/components/sidebar.tsx`
- Modify: `apps/web/app/design/page.tsx`
- Modify: `apps/web/package.json`
- Delete: `apps/web/lib/data/dev-workspace.ts`
- Delete: `apps/web/scripts/seed-dev-workspace.mjs`
- Delete: `supabase/seed/dev_workspace.sql`

**Interfaces:**
- Produces: `WorkspaceShellStatus = "ready" | "empty" | "unavailable"`.
- Produces: `WorkspaceShellData = { status; workspace; pages; userDisplayName; userInitials }`.
- Produces: `WorkspaceShellRepository` with read-only `listWorkspaces(ownerId)`, `listPages(workspaceId)`, and `getUser()` methods.
- Produces: `loadWorkspaceShellData(access, repository)` for deterministic tests.
- Preserves: `getWorkspaceShellData()` as the cached production entry point.

- [ ] **Step 1: Write failing shell query tests**

Add Node tests that construct a read-only fake repository and assert:

```js
test("returns unavailable without data access", async () => {
  assert.deepEqual(await loadWorkspaceShellData(null, null), {
    status: "unavailable",
    workspace: null,
    pages: [],
    userDisplayName: null,
    userInitials: null,
  });
});

test("returns a true empty state without creating anything", async () => {
  const calls = [];
  const repository = {
    async listWorkspaces(ownerId) { calls.push(["listWorkspaces", ownerId]); return []; },
    async listPages() { calls.push(["listPages"]); return []; },
    async getUser() { calls.push(["getUser"]); return null; },
  };
  const result = await loadWorkspaceShellData(
    { ownerId: "owner-1", mode: "dev", client: {} },
    repository,
  );
  assert.equal(result.status, "empty");
  assert.equal(result.workspace, null);
  assert.deepEqual(result.pages, []);
  assert.deepEqual(calls, [["listWorkspaces", "owner-1"]]);
});
```

Also assert that real rows produce `ready`, nested page depth is correct, archived pages are omitted, and no fixture IDs or labels appear.

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm run test --workspace=apps/web`

Expected: FAIL because `workspace-shell.test.mjs`, `WorkspaceShellStatus`, `WorkspaceShellRepository`, and `loadWorkspaceShellData` do not exist and the current query returns fixtures/writes during reads.

- [ ] **Step 3: Implement the read-only repository boundary**

Replace fixture/bootstrap behavior with this shape:

```ts
export type WorkspaceShellStatus = "ready" | "empty" | "unavailable";

export type WorkspaceShellData = {
  status: WorkspaceShellStatus;
  workspace: WorkspaceRow | null;
  pages: PageTreeItem[];
  userDisplayName: string | null;
  userInitials: string | null;
};

export type WorkspaceShellRepository = {
  listWorkspaces(ownerId: string): Promise<WorkspaceRow[]>;
  listPages(workspaceId: string): Promise<PageRow[]>;
  getUser(): Promise<{ email?: string; user_metadata?: Record<string, unknown> } | null>;
};
```

`loadWorkspaceShellData` must return `unavailable` for no access, `empty` when no workspace exists, and `ready` only when a real workspace row exists. It must never call insert/update/upsert, never import dev seeding code, and never substitute pages when the query returns an empty array.

- [ ] **Step 4: Remove all automatic and optional fake-data paths**

Delete the dev workspace seeder module, npm `db:seed` script, and SQL seed file. Keep the fixed pre-auth owner ID environment contract in `getDataAccess`, but allow it to read zero rows. Move design-only shell data into `apps/web/app/design/page.tsx` as `DESIGN_PREVIEW_SHELL` with `status: "ready"`; it must never be exported from a production query module.

- [ ] **Step 5: Render honest empty and unavailable canvas/sidebar states**

For `empty`, show a calm first-run Home placeholder with no records and a clear create entry point. For `unavailable`, show a development configuration notice without suggesting a seed command. The Sidebar must render `Planevo` and an empty Pages region when no real workspace exists; it must not default to Anthony, AP, or invented page titles.

- [ ] **Step 6: Run focused and full verification**

Run:

```bash
npm run test --workspace=apps/web
npm run lint --workspace=apps/web
npx tsc --noEmit -p apps/web/tsconfig.json
rg -n "FIXTURE_|SEED_PAGES|bootstrapDevWorkspace|db:seed|Physics 2400|Apps tracker|Reading list" apps/web supabase
```

Expected: tests PASS; lint has zero warnings; typecheck PASS; search returns only design/documentation references and no production data path.

- [ ] **Step 7: Commit**

```bash
git add apps/web supabase package-lock.json
git commit -m "fix: keep workspace reads side effect free"
```

---

### Task 2: Finish shell navigation, theme preferences, and mobile drawer

**Files:**
- Create: `apps/web/app/components/app-preferences.ts`
- Create: `apps/web/app/components/app-preferences.test.mjs`
- Create: `apps/web/app/components/mobile-sidebar.tsx`
- Modify: `apps/web/app/components/app-shell.tsx`
- Modify: `apps/web/app/components/sidebar.tsx`
- Modify: `apps/web/app/components/nav-item.tsx`
- Modify: `apps/web/app/components/top-bar.tsx`
- Modify: `apps/web/app/design/page.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/package.json`

**Interfaces:**
- Produces: `ThemePreference = "light" | "dark" | "system"` and independent `minimal: boolean`.
- Produces: `resolveTheme(preference, systemDark)` and versioned storage parsing.
- Produces: pathname-aware navigation links for Home, Tasks, Calendar, Files, Planevo AI, Agents, and Settings.

- [ ] Write failing tests for versioned preference parsing, four light/dark × minimal combinations, and route-active navigation.
- [ ] Verify RED with `npm run test --workspace=apps/web`.
- [ ] Add centralized warm-ink dark token overrides under `[data-theme="dark"]`; do not hardcode colors in components.
- [ ] Add a 390px slide-over sidebar with focus trapping, Escape/overlay dismissal, and no desktop canvas reflow.
- [ ] Replace inert `#` navigation with real `next/link` destinations and an icon-first universal-search control in the top bar.
- [ ] Render expanded, rail, peek, mobile-open, light, dark, minimal-light, and minimal-dark states in `/design`.
- [ ] Run tests, lint, typecheck, and browser checks at desktop/tablet/390px.
- [ ] Commit with `git commit -m "feat: complete responsive Planevo shell"`.

---

### Task 3: Add foundational Supabase tables and explicit creation transactions

**Files:**
- Create with `supabase migration new planevo_app_foundations`: generated migration under `supabase/migrations/`
- Modify: `apps/web/lib/database.types.ts`
- Create: `apps/web/lib/mutations/create-foundations.ts`
- Create: `apps/web/lib/mutations/create-foundations.test.mjs`
- Modify: `apps/web/app/(workspace)/actions.ts`

**Interfaces:**
- Adds: `user_preferences`, `recent_items`, `onboarding_progress`, `file_sources`, `integration_connections`, `ai_conversations`, `ai_messages`, and `source_chunks`, all with RLS.
- Adds: private `workspace-files` storage bucket policies.
- Produces transactional explicit-action functions for `createWorkspace`, `createTaskDatabaseWithViews`, `createCalendarDatabaseWithViews`, `createDocumentPage`, and `createTaskWithRequiredFoundation`.

- [ ] Write failing contract tests for born-with-views and no record creation until task submission.
- [ ] Verify RED.
- [ ] Generate the migration using the Supabase CLI command discovered via `supabase migration --help`.
- [ ] Implement tables, indexes, grants for current Data API settings, ownership RLS, and explicit transactions/RPCs without public `SECURITY DEFINER` functions.
- [ ] Regenerate/update database types and implement mutation adapters.
- [ ] Run local migration verification or hosted read-only verification, database advisors, tests, lint, and typecheck.
- [ ] Commit with `git commit -m "feat: add Planevo app foundation schema"`.

---

### Task 4: Build shared action, search, and task-composer primitives

**Files:**
- Create: `apps/web/app/components/action-card.tsx`
- Create: `apps/web/app/components/empty-state.tsx`
- Create: `apps/web/app/components/universal-search.tsx`
- Create: `apps/web/app/components/command-surface.tsx`
- Create: `apps/web/app/components/task-composer.tsx`
- Create: `apps/web/lib/commands/types.ts`
- Create: `apps/web/lib/commands/parse-quick-capture.ts`
- Create: `apps/web/lib/commands/parse-quick-capture.test.mjs`
- Modify: `apps/web/app/design/page.tsx`
- Modify: `apps/web/package.json`

**Interfaces:**
- Produces: `TaskDraft`, `SearchResult`, `CommandIntent`, and `ActionProposal` shared types.
- Produces: deterministic parsing for task title, due date/time, and `#tag` tokens.
- Task composer fields: title, description, priority, due date, estimate, tags, and attachments.

- [ ] Write failing parser and composer-validation tests.
- [ ] Verify RED.
- [ ] Implement keyboard-accessible components and all loading/empty/error/success/confirm states.
- [ ] Add all variants to `/design` before product-route use.
- [ ] Verify tests, lint, typecheck, and keyboard interaction.
- [ ] Commit with `git commit -m "feat: add shared Planevo creation primitives"`.

---

### Task 5: Build real Home destinations one screen at a time

**Files:**
- Create: `apps/web/app/(workspace)/templates/page.tsx`
- Create: `apps/web/app/(workspace)/ai/page.tsx`
- Create: `apps/web/app/(workspace)/ai/[conversationId]/page.tsx`
- Create: `apps/web/app/(workspace)/files/new/page.tsx`
- Create: `apps/web/app/components/template-picker.tsx`
- Create: `apps/web/app/components/ai-workspace.tsx`
- Modify: `apps/web/app/design/page.tsx`

**Interfaces:**
- Template picker exposes eight balanced templates plus Blank and Describe it with equal visual weight.
- AI welcome and active routes persist `ai_conversations`/`ai_messages`; mutations remain propose-first.
- File entry offers new Planevo document, device upload, or import.

- [ ] Build and verify Template picker, then commit it before starting the next screen.
- [ ] Build and verify Planevo AI welcome, then commit it before the active conversation screen.
- [ ] Build and verify Planevo AI active, then commit it before file creation/import.
- [ ] Build and verify the file creation/import sheet.
- [ ] For each screen, run tests/lint/typecheck plus desktop/tablet/390px browser QA and add its new components to `/design` first.

---

### Task 6: Build and visually verify Home command center

**Files:**
- Create: `apps/web/app/components/home/home-command-center.tsx`
- Create: `apps/web/app/components/home/home-data.ts`
- Create: `apps/web/app/components/home/home-data.test.mjs`
- Create: `apps/web/public/illustrations/home/*.webp`
- Modify: `apps/web/app/(workspace)/page.tsx`
- Modify: `apps/web/app/design/page.tsx`
- Create: `design-qa.md`

**Interfaces:**
- Produces: `HomeData` with real recents (opens plus updated time), empty/lived-in state, and six destination actions.
- Six cards: New task, New calendar, New workspace, New file, Browse templates, Open Planevo AI.
- Bottom copy: `Create, find, or ask anything…`.

- [ ] Write failing Home-data tests for empty and lived-in ordering.
- [ ] Generate and inspect six original Planevo-owned action illustrations in the approved flat geometric line-art/filled-color system; do not copy Acme assets.
- [ ] Add ActionCard states and illustration framing to `/design`.
- [ ] Implement first-run cards-as-hero and lived-in recents-first compressed-card states.
- [ ] Connect every card to its real route/action and task submission to the explicit creation transaction.
- [ ] Run Browser/IAB QA at the reference desktop size, tablet, and 390×844 mobile; verify the sidebar states and every Home action.
- [ ] Compare the reference and latest browser capture with `view_image`, record at least five fidelity points, run the above-the-fold copy diff, and iterate until `design-qa.md` says `final result: passed`.
- [ ] Run full tests, lint, typecheck, and build.
- [ ] Commit with `git commit -m "feat: build Planevo Home command center"`.
