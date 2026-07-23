# Spotlight Scoped Search — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apple-style scoped search in Cmd+K — scope chip in pill, single active scope, list browse for Tasks/Calendar/Workspace, Files grid browse panel.

**Architecture:** Replace multi-select scope `Set` with `activeScope: SpotlightScope | null`; extend file index rows with `mimeType`/`starred`/`updatedAt`; route panel by scope+query in `CommandBar`; pure helpers for Files browse data.

**Tech Stack:** Next.js App Router, TypeScript strict, Tailwind tokens, `node --test`, Supabase `file_sources.mime_type`

**Spec:** `docs/superpowers/specs/2026-07-23-spotlight-scoped-search-design.md`

## Global Constraints

- Tokens only in `globals.css` — no hardcoded hex in components
- One marigold per view — scope active uses ink/paper ring, not marigold
- No navigation on scope icon click alone
- No geometric morph on `backdrop-filter` layers (instant radius + conditional mount)
- Reuse `planevo-icon` names: `tasks`, `calendar`, `files`, `workspace`
- Reuse `mimeFamily()` / `FILE_FILTER_TABS` from `@planevo/core/types/files`
- Honor `prefers-reduced-motion` and `prefers-reduced-transparency`
- Tests: `node --test` in apps/web/features/command-bar; `npx tsc --noEmit` in apps/web

## File map

| File | Action |
|------|--------|
| `packages/core/src/search/command-model.ts` | Extend `CommandIndexEntry` optional fields |
| `apps/web/app/api/command-index/route.ts` | Populate file mime/starred/updatedAt |
| `apps/web/features/command-bar/spotlight-scope.ts` | Single-scope API + migration |
| `apps/web/features/command-bar/spotlight-scope.test.mjs` | Rewrite tests |
| `apps/web/features/command-bar/spotlight-files-browse.ts` | Pure browse helpers |
| `apps/web/features/command-bar/spotlight-files-browse.test.mjs` | New tests |
| `apps/web/features/command-bar/spotlight-scope-chip.tsx` | New chip UI |
| `apps/web/features/command-bar/spotlight-search-field.tsx` | Chip slot |
| `apps/web/features/command-bar/spotlight-files-browse.tsx` | Files grid panel |
| `apps/web/features/command-bar/spotlight-scope-icons.tsx` | Enter/switch/clear scope |
| `apps/web/features/command-bar/spotlight-scoped-list.tsx` | Header + scoped recents list |
| `apps/web/features/command-bar/spotlight-chrome.tsx` | Panel routing slot |
| `apps/web/features/command-bar/spotlight-results.tsx` | Tasks-only capture when scoped |
| `apps/web/features/command-bar/spotlight-overlay.tsx` | Layered Escape |
| `apps/web/features/command-bar/command-bar.tsx` | Wire state + handlers |
| `apps/web/app/design/command-bar-preview.tsx` | Chip + Files browse states |

---

### Task 1: Extend command index entry type

**Files:**
- Modify: `packages/core/src/search/command-model.ts`
- Modify: `apps/web/app/api/command-index/route.ts`

**Interfaces:**
- Produces: `CommandIndexEntry` with optional `mimeType?: string`, `starred?: boolean`, `updatedAt?: string`

- [ ] **Step 1: Extend type**

In `command-model.ts`, add to `CommandIndexEntry`:

```ts
export type CommandIndexEntry = {
  kind: CommandIndexKind;
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  mimeType?: string;
  starred?: boolean;
  updatedAt?: string;
};
```

- [ ] **Step 2: Populate file fields in API**

In `command-index/route.ts`, change file select to include `mime_type, updated_at` and map:

```ts
.select("id,name,folder_id,mime_type,metadata_json,updated_at")
// ...
.map((file) => ({
  kind: "file" as const,
  id: file.id,
  title: file.name,
  mimeType: file.mime_type ?? undefined,
  starred: isStarredFileMetadata(file.metadata_json),
  updatedAt: file.updated_at,
})),
```

Import `isStarredFileMetadata` from `@planevo/core/types/files`.

- [ ] **Step 3: Verify**

Run: `cd apps/web && npx tsc --noEmit`  
Expected: PASS

---

### Task 2: Single-scope module + tests

**Files:**
- Modify: `apps/web/features/command-bar/spotlight-scope.ts`
- Modify: `apps/web/features/command-bar/spotlight-scope.test.mjs`

**Interfaces:**
- Produces:
  - `loadSpotlightScope(): SpotlightScope | null`
  - `saveSpotlightScope(scope: SpotlightScope | null): void`
  - `setSpotlightScope(current: SpotlightScope | null, next: SpotlightScope): SpotlightScope | null` — same scope → null; different → next
  - `filterEntriesByScope(entries, scope: SpotlightScope | null): CommandIndexEntry[]`
  - Remove `toggleSpotlightScope`, `loadSpotlightScopes`, multi-select helpers, `SPOTLIGHT_SCOPE_ROUTES` usage from scope actions

- [ ] **Step 1: Write failing tests**

Replace `spotlight-scope.test.mjs` with:

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterEntriesByScope,
  setSpotlightScope,
  loadSpotlightScope,
  saveSpotlightScope,
} from "./spotlight-scope.ts";

const ENTRIES = [
  { kind: "task", id: "t1", title: "Task one" },
  { kind: "event", id: "e1", title: "Event one" },
  { kind: "file", id: "f1", title: "File one" },
  { kind: "page", id: "p1", title: "Page one" },
];

test("null scope returns all entries", () => {
  assert.equal(filterEntriesByScope(ENTRIES, null).length, 4);
});

test("tasks scope filters tasks only", () => {
  const result = filterEntriesByScope(ENTRIES, "tasks");
  assert.equal(result.length, 1);
  assert.equal(result[0]?.kind, "task");
});

test("setSpotlightScope switches and clears", () => {
  assert.equal(setSpotlightScope(null, "tasks"), "tasks");
  assert.equal(setSpotlightScope("tasks", "tasks"), null);
  assert.equal(setSpotlightScope("tasks", "files"), "files");
});

test("persistence round-trip", () => {
  saveSpotlightScope("calendar");
  assert.equal(loadSpotlightScope(), "calendar");
  saveSpotlightScope(null);
  assert.equal(loadSpotlightScope(), null);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd apps/web && node --test features/command-bar/spotlight-scope.test.mjs`

- [ ] **Step 3: Implement single-scope module**

Key implementation:

```ts
export function loadSpotlightScope(): SpotlightScope | null {
  // read sessionStorage; if JSON array (legacy), take first valid scope
  // if JSON string valid scope, return it; else null
}

export function saveSpotlightScope(scope: SpotlightScope | null): void {
  sessionStorage.setItem(SPOTLIGHT_SCOPE_STORAGE_KEY, scope ? JSON.stringify(scope) : "null");
}

export function setSpotlightScope(
  current: SpotlightScope | null,
  next: SpotlightScope,
): SpotlightScope | null {
  return current === next ? null : next;
}

export function filterEntriesByScope(
  entries: CommandIndexEntry[],
  scope: SpotlightScope | null,
): CommandIndexEntry[] {
  if (!scope) return entries;
  return entries.filter((entry) => scopeForKind(entry.kind) === scope);
}
```

Keep `SPOTLIGHT_SCOPE_ITEMS`, remove `SPOTLIGHT_SCOPE_ROUTES` from this module (or leave constant unused — do not use in scope click handler).

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd apps/web && node --test features/command-bar/spotlight-scope.test.mjs`

---

### Task 3: Files browse pure helpers + tests

**Files:**
- Create: `apps/web/features/command-bar/spotlight-files-browse.ts`
- Create: `apps/web/features/command-bar/spotlight-files-browse.test.mjs`

**Interfaces:**
- Consumes: `CommandIndexEntry` with `kind: "file"`, optional mime/starred/updatedAt
- Produces:
  - `filterFileEntriesByTab(entries: CommandIndexEntry[], tab: FileFilterTab): CommandIndexEntry[]`
  - `buildFileSuggestions(entries: CommandIndexEntry[], limit?: number): CommandIndexEntry[]`
  - `buildFileRecents(entries: CommandIndexEntry[], commandRecents: CommandIndexEntry[], limit?: number): CommandIndexEntry[]`

- [ ] **Step 1: Write failing tests**

```js
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildFileSuggestions,
  buildFileRecents,
  filterFileEntriesByTab,
} from "./spotlight-files-browse.ts";

const FILES = [
  { kind: "file", id: "a", title: "a.pdf", mimeType: "application/pdf", starred: false, updatedAt: "2026-07-01" },
  { kind: "file", id: "b", title: "b.png", mimeType: "image/png", starred: true, updatedAt: "2026-07-02" },
  { kind: "file", id: "c", title: "c.txt", mimeType: "text/plain", starred: false, updatedAt: "2026-07-03" },
];

test("filterFileEntriesByTab pdfs", () => {
  const pdfs = filterFileEntriesByTab(FILES, "pdfs");
  assert.equal(pdfs.length, 1);
  assert.equal(pdfs[0]?.id, "a");
});

test("buildFileSuggestions starred first", () => {
  const suggestions = buildFileSuggestions(FILES, 2);
  assert.equal(suggestions[0]?.id, "b");
});

test("buildFileRecents dedupes recents and index", () => {
  const recents = [{ kind: "file", id: "a", title: "a.pdf" }];
  const merged = buildFileRecents(FILES, recents, 10);
  assert.equal(merged[0]?.id, "a");
  assert.ok(merged.length >= 2);
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement helpers**

Use `matchesFileFilterTab(mimeType ?? null, tab)` from `@planevo/core/types/files`. Filter to `kind === "file"` first. Suggestions: starred desc, then `updatedAt` desc. Recents: recents order first, then index by `updatedAt`, dedupe by id.

- [ ] **Step 4: Run — expect PASS**

---

### Task 4: Scope chip component

**Files:**
- Create: `apps/web/features/command-bar/spotlight-scope-chip.tsx`
- Modify: `apps/web/features/command-bar/spotlight-search-field.tsx`

**Interfaces:**
- Consumes: `scope: SpotlightScope`, `onClear: () => void`
- Produces: `SpotlightScopeChip` exported; search field accepts `activeScope: SpotlightScope | null`, `onClearScope: () => void`

- [ ] **Step 1: Create chip**

```tsx
export function SpotlightScopeChip({ scope, onClear }: { scope: SpotlightScope; onClear: () => void }) {
  const label = SPOTLIGHT_SCOPE_ITEMS.find((item) => item.scope === scope)?.label ?? scope;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-sunken px-2.5 py-0.5 text-label text-ink">
      {label}
      <button type="button" onClick={onClear} aria-label={`Clear ${label} scope`} className="...">
        ×
      </button>
    </span>
  );
}
```

- [ ] **Step 2: Wire into search field**

Wrap input row in `flex items-center gap-2`; after `<input>`, render chip when `activeScope` set. Chip sits visually after typed text (flex order: icon, input flex-1, chip).

- [ ] **Step 3: Verify types**

Run: `cd apps/web && npx tsc --noEmit`

---

### Task 5: Scope icons — enter/switch/clear (no navigation)

**Files:**
- Modify: `apps/web/features/command-bar/spotlight-scope-icons.tsx`

**Interfaces:**
- Consumes: `activeScope: SpotlightScope | null`, `onScopeAction: (scope: SpotlightScope) => void`
- Remove `hasQuery` prop; `aria-pressed={activeScope === scope}`; label `Search ${label} only`

- [ ] **Step 1: Update props and labels**

Replace multi-select `activeScopes: Set` with `activeScope: SpotlightScope | null`.

- [ ] **Step 2: Keep stopPropagation on click**

---

### Task 6: Files browse panel UI

**Files:**
- Create: `apps/web/features/command-bar/spotlight-files-browse.tsx`

**Interfaces:**
- Consumes: file entries from index, command recents, `onSelect: (entry: CommandIndexEntry) => void`
- Uses: `FILE_FILTER_TABS`, helpers from Task 3

- [ ] **Step 1: Build panel structure**

```tsx
export function SpotlightFilesBrowse({ entries, recents, onSelect }: Props) {
  const [tab, setTab] = useState<FileFilterTab>("all");
  const fileEntries = entries.filter((e) => e.kind === "file");
  const filtered = filterFileEntriesByTab(fileEntries, tab);
  const suggestions = buildFileSuggestions(filtered, 6);
  const recentFiles = buildFileRecents(filtered, recents.filter((r) => r.kind === "file"), 12);
  // Header: Icon files + "Files"
  // Filter chips: All Documents PDFs Images (labels from files product)
  // Section Suggestions: grid grid-cols-3 sm:grid-cols-6 gap-3
  // Section Recents: same grid
  // Tile: button, Icon files, truncated title
}
```

Token-only classes; no marigold on filter chips (use ink ring when active).

- [ ] **Step 2: a11y**

Filter row `role="tablist"`; chips `role="tab"` `aria-selected`. Tiles `aria-label={entry.title}`.

---

### Task 7: Scoped list panel (Tasks / Calendar / Workspace)

**Files:**
- Create: `apps/web/features/command-bar/spotlight-scoped-list.tsx`

**Interfaces:**
- Consumes: `scope: SpotlightScope`, `recents: CommandIndexEntry[]`, `onSelect`, `onHover`, `activeIndex`

- [ ] **Step 1: Implement header + reuse ResultRow**

Import `ResultRow` from `spotlight-results.tsx` (export it if not already exported). Map scope → icon + title + empty message:

```ts
const SCOPE_META = {
  tasks: { icon: "tasks", title: "Tasks", empty: "No recent tasks." },
  calendar: { icon: "calendar", title: "Calendar", empty: "No recent events." },
  workspace: { icon: "workspace", title: "Workspace", empty: "No recent workspace items." },
} as const;
```

Render scoped recents as list rows; single "Recents" subheader optional (product header is enough).

---

### Task 8: CommandBar wiring + Escape layering

**Files:**
- Modify: `apps/web/features/command-bar/command-bar.tsx`
- Modify: `apps/web/features/command-bar/spotlight-overlay.tsx`
- Modify: `apps/web/features/command-bar/spotlight-chrome.tsx`
- Modify: `apps/web/features/command-bar/spotlight-results.tsx`

**Interfaces:**
- State: `activeScope: SpotlightScope | null`
- `handleScopeAction(scope)` → `setActiveScope(setSpotlightScope(prev, scope))`, save, focus input — **never router.push**
- `handleClearScope()` → null + save
- `expanded` when query, activeScope, scoped recents, loadError
- Panel routing in chrome:
  - `activeScope === "files" && !query.trim()` → `<SpotlightFilesBrowse />`
  - `activeScope && !query.trim() && activeScope !== "files"` → `<SpotlightScopedList />`
  - else → `<SpotlightResults />` (existing)

- [ ] **Step 1: Replace Set state with nullable scope**

Remove `SPOTLIGHT_SCOPE_ROUTES` import and navigate-on-empty logic.

- [ ] **Step 2: Layered Escape in overlay**

Change overlay `onClose` prop to support optional `onEscape?: () => boolean` — if returns true, consumed (scope cleared). Or handle in command-bar keydown on input: Escape with scope → clear scope + prevent close; Escape without scope → close.

Implement in `command-bar.tsx` `handleKeyDown`:

```ts
if (event.key === "Escape") {
  if (activeScope) {
    event.preventDefault();
    handleClearScope();
    return;
  }
}
```

Overlay global Escape: if scope active, clear scope instead of close (pass `onRequestClose` callback).

- [ ] **Step 3: Tasks-only capture**

Pass `activeScope` to `SpotlightResults`; suppress capture row unless `activeScope === "tasks" || activeScope === null` (null = account-wide capture allowed).

- [ ] **Step 4: buildCommandResults with scoped entries**

```ts
const scopedEntries = filterEntriesByScope(entries, activeScope);
const scopedRecents = filterEntriesByScope(recents, activeScope);
```

- [ ] **Step 5: Verify manually**

Cmd+K → Tasks → chip + list; type → filtered; Escape clears scope; second Escape closes.

---

### Task 9: Design preview

**Files:**
- Modify: `apps/web/app/design/command-bar-preview.tsx`

- [ ] **Step 1: Add states**

- Collapsed with Tasks chip visible in pill mock
- Files browse panel (static grid sample)
- Tasks scoped list with recents

Use static data; no fetch.

---

### Task 10: Final verification

- [ ] **Step 1: Run all command-bar tests**

Run: `cd apps/web && node --test features/command-bar/spotlight-scope.test.mjs features/command-bar/spotlight-files-browse.test.mjs`

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npx tsc --noEmit`

- [ ] **Step 3: Manual checklist**

- [ ] Tasks scope empty → chip + recents list
- [ ] Files scope empty → grid + filter chips
- [ ] Files scope + type query → list search, chip remains
- [ ] Switch scope Tasks → Files → chip updates
- [ ] Same icon click clears scope
- [ ] Chip × clears scope
- [ ] Escape clears scope then closes
- [ ] No navigation on icon click alone
- [ ] `/design` shows new states

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Single scope + chip | 2, 4, 5, 8 |
| No navigate on icon click | 8 |
| List browse Tasks/Calendar/Workspace | 7, 8 |
| Files grid browse | 3, 6, 8 |
| Index mime/starred/updatedAt | 1 |
| Escape layering | 8 |
| Tasks-only capture | 8 |
| Design preview | 9 |
| Unit tests | 2, 3, 10 |
| Perf (no stagger, conditional mount) | 6, 8 |

## Out of scope (do not implement)

- SPOTLIGHT_SCOPE_ROUTES navigation on click
- Multi-select scopes
- File thumbnails
- Header "…" menu on Files
