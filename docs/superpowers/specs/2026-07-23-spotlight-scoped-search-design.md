# Spotlight Scoped Search — Design Spec

**Date:** 2026-07-23  
**Status:** Approved for implementation  
**Authority:** `AGENTS.md`, `docs/design-brief.md`, founder Apple Spotlight references (scoped chip + Files browse panel)  
**Supersedes (partial):** Scope behavior in `2026-07-23-spotlight-pill-morph-design.md` §Scope icons — navigation-on-click and multi-select are replaced by this spec.

---

## Summary

Evolve Cmd+K Spotlight so product scope buttons behave like **Apple Spotlight scoped search**: clicking Tasks, Calendar, Files, or Workspace **enters scoped mode inside Spotlight** (no navigation). A **scope chip** appears inline in the search pill. Typing searches only within that product.

**Hybrid V1 (founder-approved):**

- **Tasks, Calendar, Workspace** — chip + **list** browse (scoped recents when empty; scoped fuzzy search when typing).
- **Files** — chip + **dedicated browse panel** when empty (header, mime filter chips, Suggestions + Recents grid); switches to list search results when typing.

---

## Interaction model

### Entering scope

- Click a side icon → set `activeScope` to that product; Spotlight **stays open**.
- Inline **scope chip** appears in the pill after the query text (e.g. `Tasks`), with dismiss `×`.
- Matching side icon shows **active** state (ink ring + elevated surface — **not marigold**).
- **Single scope at a time.** Clicking another icon **switches** scope. Clicking the **same** icon again **clears** scope.

### Exiting scope

- Click `×` on chip, click active side icon again, or **Escape** (first Escape clears scope; second Escape closes Spotlight).

### Typing while scoped

- Query searches **only** entries matching `activeScope`.
- Chip remains visible while typing.
- Prefix modes (`>`, `@`, `#`) still apply; results respect active scope where applicable.
- **Quick capture:** plain-text capture row appears **only in Tasks scope**.

### Side icons

- **Never navigate** on click alone.
- Optional long-press / secondary action to open product route is **out of scope V1**.

---

## Layout (unchanged chrome)

Desktop: `[ glass search pill (flex-1) ] [ Tasks ] [ Calendar ] [ Files ] [ Workspace ]`

Mobile: pill full-width; scope icons in horizontal scroll-snap row below.

Shell expands when: query non-empty, scoped mode active, scoped recents exist, or load error.

---

## Scope chip (pill)

- Renders **inside** `SpotlightSearchField`, after the input text (Apple `file` tag pattern).
- Label: product name (`Tasks`, `Calendar`, `Files`, `Workspace`).
- Styling: rounded pill, subtle tinted surface (`surface-sunken` / border), ink text, `×` dismiss button.
- Accessible: chip dismiss is a `button` with `aria-label="Clear {product} scope"`.
- Input placeholder unchanged when scoped; chip carries scope context visually.

---

## Tasks / Calendar / Workspace — list mode

When `activeScope` is one of these and query is **empty**:

| Scope | Panel header | Content |
|-------|--------------|---------|
| Tasks | Tasks icon + “Tasks” | Scoped **Recents** from command recents filtered to `task` kind |
| Calendar | Calendar icon + “Calendar” | Scoped recents filtered to `event` |
| Workspace | Workspace icon + “Workspace” | Scoped recents filtered to `page`, `database`, `record` |

- Uses existing **list row** component (icon · title · subtitle · kind label).
- Empty recents: calm one-line message (“No recent tasks” etc.).
- No extra group headers unless search returns multiple groups.

When query is **non-empty**:

- Scoped fuzzy matches only.
- Tasks scope: capture row first when parser finds signals (existing behavior, scoped).
- Other scopes: no capture row.

---

## Files — browse mode

When `activeScope === "files"` and query is **empty**:

### Header

- Files icon + **“Files”** (`text-h3`, ink).
- No dead “…” menu in V1 (omit until actions exist).

### Filter chips

Horizontal row; scroll on mobile. Reuse Files product taxonomy:

| Chip | Filter |
|------|--------|
| All | No mime filter |
| Documents | `mimeFamily !== pdfs && !== images` (see `mimeFamily()`) |
| PDFs | `application/pdf` |
| Images | `mimeType.startsWith("image/")` |

Default: **All**. Client-side filter on indexed file entries.

### Sections

1. **Suggestions** — up to 6 tiles: starred files first (`metadata_json.starred`), then most recently updated from index.
2. **Recents** — file entries from command recents plus recently updated files from index, deduped, cap 12.

### Grid tile

- File icon (thumbnail **out of scope V1**).
- Truncated filename below.
- Click → `rememberCommandEntry` + navigate `/files?file={id}` + close Spotlight.

### Search within Files scope

When query is **non-empty**: hide grid; show **scoped list results** (same row component as other scopes). Chip stays in pill.

---

## Data model & state

### Scope state

```ts
activeScope: SpotlightScope | null
```

Replace multi-select `Set<SpotlightScope>`.

Persistence: `sessionStorage` key `planevo:spotlight-scope` stores a **single string or null**. Migrate reads from legacy JSON array (use first valid entry or empty).

### Index extension

Extend `CommandIndexEntry` for file rows:

```ts
mimeType?: string  // from file_sources metadata / storage mime
starred?: boolean  // from metadata_json.starred
updatedAt?: string // ISO; for suggestions ordering
```

Populate in `GET /api/command-index` from existing `file_sources` select (add mime from metadata or blob record as available).

### Filtering

- `filterEntriesByScope(entries, activeScope)` — when `activeScope` is null, return all; else filter by kind map (unchanged mapping).
- Files browse helpers in `spotlight-files-browse.ts` (pure functions): `buildFileSuggestions`, `buildFileRecents`, `filterFilesByTab`.

### Data flow

1. `fetchCommandIndex()` → entries (unchanged cache).
2. `activeScope` + `query` drive panel variant:
   - null + empty → collapsed or account recents (unchanged default).
   - tasks|calendar|workspace + empty → scoped list recents.
   - files + empty → `SpotlightFilesBrowse`.
   - any scope + query → `SpotlightResults` scoped list.
3. Select row → navigate (unchanged href map).

---

## Components

| File | Role |
|------|------|
| `spotlight-scope.ts` | Single-scope state helpers, filter, persistence migration |
| `spotlight-scope-chip.tsx` | Inline pill chip + dismiss |
| `spotlight-search-field.tsx` | Chip slot after input |
| `spotlight-files-browse.ts` | Pure browse data helpers |
| `spotlight-files-browse.tsx` | Header, filter chips, grid sections |
| `spotlight-scope-icons.tsx` | Enter/switch/clear scope (no navigation) |
| `spotlight-chrome.tsx` | Route results slot by scope + query |
| `command-bar.tsx` | `activeScope` wiring, Escape layering |
| `command-bar-preview.tsx` | Scoped chip + Files browse states |
| `api/command-index/route.ts` | File mime/starred/updatedAt on entries |

---

## Keyboard & a11y

- Scope chip dismiss: focusable button; Tab order: input → chip dismiss → scope icons → results.
- Escape: clear scope if set, else close overlay.
- Scope icons: `aria-pressed={activeScope === scope}`; label “Search {Product} only”.
- Files filter chips: `role="tablist"` / `role="tab"` or toggle buttons with `aria-pressed`.
- Grid tiles: `button` with filename `aria-label`.

---

## Motion & performance

- No geometric morph on backdrop-filter layer (keep instant shell radius + conditional mount from perf pass).
- Files grid: no per-tile stagger animation V1.
- Browse panel mounts only when `files` scope + empty query.

---

## Success criteria

- Click Tasks with empty query → chip appears, scoped task recents list expands; typing filters tasks only.
- Click Files with empty query → Files browse panel (filters + Suggestions + Recents grid).
- Typing in Files scope → chip stays, list search results replace grid.
- Click same scope icon or chip `×` → clears scope.
- Escape clears scope before closing Spotlight.
- No navigation on scope icon click alone.
- `/design` preview shows chip + Files browse + scoped list states.
- Unit tests: single-scope toggle, filter matrix, Files browse helpers, persistence migration.

---

## Out of scope (V1)

- Navigate to product route on scope icon click
- Multi-select scopes
- Per-app filters beyond Files mime families (Xcode, Pages, etc.)
- File thumbnails in grid
- Server-side scoped search API
- Scope-specific keyboard shortcuts beyond existing roving focus
- “…” menu on Files header

---

## Testing

- `spotlight-scope.test.mjs` — update for single scope + migration
- `spotlight-files-browse.test.mjs` — suggestions ordering, tab filter, dedupe
- Manual: Cmd+K → each scope → empty browse → type → clear → Escape chain
