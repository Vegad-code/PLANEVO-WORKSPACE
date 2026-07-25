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
- Create: `apps/web/app/components/navigation-state.ts`
- Create: `apps/web/app/components/navigation-state.test.mjs`
- Create: `apps/web/app/components/mobile-sidebar.tsx`
- Modify: `apps/web/app/components/app-shell.tsx`
- Modify: `apps/web/app/components/sidebar.tsx`
- Modify: `apps/web/app/components/nav-item.tsx`
- Modify: `apps/web/app/components/planevo-icon.tsx`
- Modify: `apps/web/app/components/top-bar.tsx`
- Modify: `apps/web/app/design/minimal-toggle.tsx`
- Modify: `apps/web/app/design/page.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/next.config.ts`
- Modify: `apps/web/package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `ThemePreference = "light" | "dark" | "system"`, `ResolvedTheme = "light" | "dark"`, and `AppPreferences = { version: 1; theme; minimal }`.
- Produces: `parseAppPreferences(value)`, `resolveTheme(preference, systemDark)`, and `getRootAppearance(preferences, systemDark)`.
- Produces: `isNavItemActive(pathname, href)` and `reduceMobileNavigation(state, event)`.
- Produces: pathname-aware links for Home `/`, Tasks `/tasks`, Calendar `/calendar`, Files `/files`, Planevo AI `/ai`, Agents `/agents`, and Settings `/settings`.
- Replaces handcrafted inline icon paths with `iconoir-react@7.11.1` through the existing `Icon` wrapper.

- [ ] **Step 1: Write failing preference and navigation tests**

Cover this exact behavior:

```js
assert.deepEqual(parseAppPreferences(null), {
  version: 1,
  theme: "system",
  minimal: false,
});
assert.deepEqual(parseAppPreferences('{"version":1,"theme":"dark","minimal":true}'), {
  version: 1,
  theme: "dark",
  minimal: true,
});
assert.equal(resolveTheme("system", true), "dark");
assert.equal(resolveTheme("system", false), "light");
assert.deepEqual(getRootAppearance({ version: 1, theme: "dark", minimal: false }, false), {
  theme: "dark",
  minimal: false,
});
assert.deepEqual(getRootAppearance({ version: 1, theme: "light", minimal: true }, true), {
  theme: "light",
  minimal: true,
});
assert.equal(isNavItemActive("/", "/"), true);
assert.equal(isNavItemActive("/tasks/record-1", "/tasks"), true);
assert.equal(isNavItemActive("/calendar", "/tasks"), false);
assert.deepEqual(reduceMobileNavigation({ open: false }, { type: "open" }), { open: true });
assert.deepEqual(reduceMobileNavigation({ open: true }, { type: "escape" }), { open: false });
```

Also test malformed/wrong-version preferences fall back to defaults, `theme` and `minimal` remain independent across all four resolved combinations, and mobile close/overlay/navigation events close the drawer.

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm run test --workspace=apps/web`

Expected: existing 15 tests pass and the new tests fail because the preference/navigation modules do not exist.

- [ ] **Step 3: Implement versioned preferences and a no-flash root appearance**

Use storage key `planevo.app.preferences.v1`. `parseAppPreferences` must accept only version `1`, the three theme values, and a boolean `minimal`; everything else returns the default. In `layout.tsx`, add a small pre-hydration appearance script that reads that key and `prefers-color-scheme`, then sets `document.documentElement.dataset.theme` and toggles `data-minimal` before paint. Add `suppressHydrationWarning` to `<html>`. The existing `/design` toggle must update the same versioned preference object instead of maintaining disconnected state.

- [ ] **Step 4: Add the Notion-caliber dark token layer**

> **Superseded 2026-07-22:** the earlier warm-ink dark palette (`#1c1b18` /
> `#22211d`) was replaced by Notion-caliber cool neutrals. Canonical values live
> in `docs/design-brief.md` §1 Dark mode and `apps/web/app/globals.css`.

Centralize these provisional values in `globals.css`, never in components:

```css
[data-theme="dark"] {
  --color-paper: #191919;
  --color-ink: rgba(255, 255, 255, 0.9);
  --color-sidebar: #191919;
  --color-surface-raised: #252525;
  --color-border: rgba(255, 255, 255, 0.13);
  --color-border-strong: #373737;
  --color-text-secondary: #9b9b9b;
  --color-text-muted: #6f6f6f;
  --color-marigold: #2383e2;
  --color-brick: #ff7369;
  --color-meadow: #4dab9a;
  --color-ocean: #529cca;
  --color-slate: #9a6dd7;
  --color-marigold-tint: #364954;
  --color-meadow-tint: #354c4b;
  --color-brick-tint: #594141;
  --color-slate-tint: #443f57;
  --color-ocean-tint: #364954;
}
```

Add a `[data-theme="dark"][data-minimal]` override so minimal mode desaturates
accents toward cool gray (`#8a8a8a` / tint `#2f2f2f`) while ink/slate remain intact.

- [ ] **Step 5: Replace handcrafted icons with Iconoir**

Install exact package `iconoir-react@7.11.1`, add `experimental.optimizePackageImports: ["iconoir-react"]` to `next.config.ts`, and keep the existing semantic `IconName` API. Map every semantic name to the closest consistent Iconoir 24px outline icon with `strokeWidth={1.5}` and `aria-hidden`; no handcrafted SVG/path data remains in application components.

- [ ] **Step 6: Implement route-aware navigation and the approved sidebar IA**

Convert `NavItem` to `next/link`, derive active state from `usePathname`, and set the active marigold pip only on the current route. Rename the first item to `Home`. Render two honest workspace sections: `Pinned` (empty invitation when none exist) and `Pages` (real shell pages only). The AI group stays at the bottom. Preserve expanded/rail/200ms hover-peek/Command-backslash behavior and existing tests.

- [ ] **Step 7: Implement the mobile drawer and top-bar search trigger**

Below the desktop breakpoint, remove the sidebar spacer and show a menu button in `TopBar`. It opens a fixed paper/sidebar drawer with backdrop, initial focus, Tab/Shift-Tab containment, Escape/backdrop/navigation dismissal, restored trigger focus, and body-scroll lock. Desktop retains grid reflow only for expanded/rail and never for peek. Replace the large Ask-AI pill in the top bar with the approved icon-first universal-search trigger; it expands to the compact label `Search Planevo` and exposes `aria-keyshortcuts="Meta+K Control+K"`. Planevo AI remains available in the sidebar.

- [ ] **Step 8: Render the new states in `/design`**

Show expanded, rail, hover-peek, mobile-open, identity/neutral top bars, light, dark, minimal-light, and minimal-dark. `/design` may use its isolated preview shell, but no production route may receive those rows.

- [ ] **Step 9: Run full verification**

Run:

```bash
npm run test --workspace=apps/web
npm run lint --workspace=apps/web
npx tsc --noEmit -p apps/web/tsconfig.json
npm run build --workspace=apps/web
rg -n "<svg|<path|FIXTURE_|href=\"#\"|>Workspace<" apps/web/app/components apps/web/lib
git diff --check
```

Expected: all checks pass; the search finds no handcrafted SVG/path, fixture export, inert href, or old first-nav label in production components.

- [ ] **Step 10: Commit**

```bash
git add apps/web package-lock.json
git commit -m "feat: complete responsive Planevo shell"
```

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
