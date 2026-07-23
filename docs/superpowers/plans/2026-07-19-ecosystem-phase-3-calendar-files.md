# Ecosystem Phase 3 — Calendar + Files Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Calendar (week + today, multi-calendar, task integration) and Files (CloudNest/Untitled UI cabinet) as real products on `calendar_events` and `file_sources`; strangler cutover off `DatabaseFace` for `/calendar` and `/files`.

**Architecture:** Product queries/mutations in `@planevo/core`; dedicated `calendar-product/` and `files-product/` UI modules; server actions in route `actions.ts`; merge task due dates at calendar render layer; reuse Phase 2 cross-link patterns (`scheduleTask`, `file_links`, `workspace_links`).

**Tech Stack:** Next.js App Router (RSC + server actions), TypeScript strict, Tailwind tokens, Supabase RLS, dnd-kit (calendar drag), `@planevo/core` Node test runner.

## Global Constraints

- **Authority:** `docs/planevo-prd.md` v2.0 Phase 3, `docs/planevo-feature-spec.md` F-04, F-05, F-02, F-03 cross-links, `docs/superpowers/specs/2026-07-19-phase-3-calendar-files-design.md`, `AGENTS.md`.
- **Layout override:** Calendar + Files reference screenshots are **layout** references for those routes (founder override July 19). Global nav stays Planevo `app-shell`.
- **No kernel faces:** `/calendar` and `/files` must not import `DatabaseFace`, `getCalendarFaceBundle`, or `getFilesFaceBundle` when v2 path ships.
- **Tokens:** No hardcoded hex/px — `globals.css` tokens via Tailwind.
- **One marigold per view:** single primary CTA per product screen.
- **RLS:** All mutations use authenticated client; `user_id = auth.uid()` on product rows.
- **Filter prefs:** Client-only (`planevo:calendar:scope`, `planevo:files:scope`). Never on product rows.
- **Tests:** `npm test` in `packages/core` and `apps/web` after changes.
- **Commits:** One commit per task. No push unless founder asks.
- **Phase boundary:** No workspace embed blocks (Phase 4), no month view requirement, no Google write sync.

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/core/src/types/calendar.ts` | `CalendarRow`, `CalendarEventRow`, color tokens |
| `packages/core/src/types/files.ts` | `FileSourceRow`, MIME filter helpers |
| `packages/core/src/queries/product-calendar.ts` | `loadCalendars`, `loadCalendarWeek`, task due merge |
| `packages/core/src/queries/product-files.ts` | `loadProductFiles`, storage totals |
| `packages/core/src/mutations/product-calendar.ts` | event + calendar CRUD, drag schedule |
| `packages/core/src/mutations/product-files.ts` | upload metadata, tags, delete |
| `packages/core/src/mutations/file-cross-links.ts` | attach to task/event |
| `apps/web/lib/calendar/scope-prefs.ts` | `All \| This workspace` |
| `apps/web/lib/files/scope-prefs.ts` | `All \| This workspace` |
| `apps/web/features/calendar-product/` | Sidebar, today column, week grid, peek |
| `apps/web/features/files-product/` | Cabinet shell, table, upload, preview |
| `apps/web/app/(workspace)/calendar/page.tsx` | RSC strangler |
| `apps/web/app/(workspace)/calendar/actions.ts` | Server actions |
| `apps/web/app/(workspace)/files/page.tsx` | RSC strangler |
| `apps/web/app/(workspace)/files/actions.ts` | Server actions |
| `apps/web/app/design/calendar-product-preview.tsx` | `/design` states |
| `apps/web/app/design/files-product-preview.tsx` | `/design` states |

---

### Task 1: Calendar types and week range helpers

**Files:**
- Create: `packages/core/src/types/calendar.ts`
- Create: `packages/core/src/types/calendar.test.mjs`
- Modify: `packages/core/src/state/calendar-state.ts` (add `weekRange`, `weekParam`)

**Interfaces:**
- Produces: `CALENDAR_COLORS`, `CalendarColor`, `CalendarRow`, `CalendarEventRow`, `TaskDueChip`, `weekRange`, `weekParam`

- [ ] **Step 1: Write the failing test**

```javascript
import assert from "node:assert/strict";
import { test } from "node:test";
import { CALENDAR_COLORS } from "../src/types/calendar.ts";
import { weekRange, weekParam } from "../src/state/calendar-state.ts";

test("CALENDAR_COLORS includes token keys", () => {
  assert.ok(CALENDAR_COLORS.includes("slate"));
  assert.ok(CALENDAR_COLORS.includes("marigold"));
});

test("weekRange returns Mon-Sun inclusive bounds", () => {
  const anchor = new Date(2026, 6, 15); // Wed Jul 15 2026
  const { start, end } = weekRange(anchor);
  assert.equal(start.getDay(), 1);
  assert.equal(end.getTime() - start.getTime(), 7 * 24 * 60 * 60 * 1000);
  assert.equal(weekParam(anchor), "2026-W29");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && node --no-warnings --experimental-strip-types --test src/types/calendar.test.mjs`  
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

`packages/core/src/types/calendar.ts`:

```typescript
export const CALENDAR_COLORS = [
  "slate",
  "marigold",
  "meadow",
  "brick",
  "ocean",
] as const;

export type CalendarColor = (typeof CALENDAR_COLORS)[number];

export type CalendarRow = {
  id: string;
  user_id: string;
  name: string;
  color: CalendarColor;
  is_visible: boolean;
  position: number;
  created_at: string;
};

export type CalendarEventRow = {
  id: string;
  calendar_id: string;
  user_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string | null;
  description_json: Record<string, unknown>;
  task_id: string | null;
  google_event_id: string | null;
  source: "planevo" | "google";
  created_at: string;
  updated_at: string;
};

export type TaskDueChip = {
  taskId: string;
  title: string;
  dueAt: string;
  status: string;
};
```

Add to `calendar-state.ts`:

```typescript
export function weekRange(anchor: Date): { start: Date; end: Date } {
  const start = new Date(anchor);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export function weekParam(anchor: Date): string {
  const { start } = weekRange(anchor);
  const year = start.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const week = Math.ceil(
    ((start.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7,
  );
  return `${year}-W${String(week).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && node --no-warnings --experimental-strip-types --test src/types/calendar.test.mjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/types/calendar.ts packages/core/src/types/calendar.test.mjs packages/core/src/state/calendar-state.ts
git commit -m "feat(core): add calendar product types and week range helpers"
```

---

### Task 2: Product calendar queries

**Files:**
- Create: `packages/core/src/queries/product-calendar.ts`
- Create: `packages/core/src/queries/product-calendar.test.mjs`

**Interfaces:**
- Consumes: `CalendarRow`, `CalendarEventRow`, `TaskDueChip`, `weekRange`
- Produces: `loadCalendars`, `loadCalendarWeek`

- [ ] **Step 1: Write the failing test**

```javascript
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCalendars, loadCalendarWeek } from "./product-calendar.ts";

function mockClient(overrides = {}) {
  return {
    from: (table) => ({
      select: () => ({
        eq: () => ({
          order: async () => ({
            data: overrides[table] ?? [],
            error: null,
          }),
        }),
        gte: () => ({
          lt: async () => ({ data: overrides.events ?? [], error: null }),
        }),
      }),
    }),
    ...overrides,
  };
}

test("loadCalendars returns user calendars ordered by position", async () => {
  const calendars = [
    { id: "c1", user_id: "u1", name: "Work", color: "slate", is_visible: true, position: 0, created_at: "" },
  ];
  const client = mockClient({ calendars });
  const result = await loadCalendars(client, "u1");
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "Work");
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement `loadCalendars` and `loadCalendarWeek`**

`loadCalendarWeek` must:
1. Query visible `calendars` for user
2. Query `calendar_events` in `[start, end)` for those calendar ids
3. Query `tasks` with `due_at` in range (all-day chips)
4. Optional `workspaceId` filter via `workspace_links` for events and tasks
5. Return `{ calendars, events, taskDues }`

- [ ] **Step 4: Run test — expect PASS**

Run: `cd packages/core && node --no-warnings --experimental-strip-types --test src/queries/product-calendar.test.mjs`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(core): add product calendar queries with task due merge"
```

---

### Task 3: Product calendar mutations

**Files:**
- Create: `packages/core/src/mutations/product-calendar.ts`
- Create: `packages/core/src/mutations/product-calendar.test.mjs`

**Interfaces:**
- Produces: `createCalendarEvent`, `updateCalendarEvent`, `deleteCalendarEvent`, `createCalendar`, `updateCalendarVisibility`, `scheduleTaskFromDrag`

- [ ] **Step 1: Write failing tests** for create event, toggle calendar visibility, drag schedule (sets `task_id`)

- [ ] **Step 2: Implement mutations** using authenticated client; drag schedule reuses duration default 60 min

- [ ] **Step 3: Run tests — PASS**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(core): add product calendar mutations and drag schedule"
```

---

### Task 4: Product files queries and types

**Files:**
- Create: `packages/core/src/types/files.ts`
- Create: `packages/core/src/queries/product-files.ts`
- Create: `packages/core/src/queries/product-files.test.mjs`

**Interfaces:**
- Produces: `FileSourceWithMeta`, `loadProductFiles`, `summarizeStorageBytes`, `mimeFamily`

- [ ] **Step 1: Write failing test** for user-scoped file list ordered by `created_at desc`

- [ ] **Step 2: Implement** — filter `isVisibleFileSourceMetadata` equivalent in core or accept `metadata_json` filter param; workspace scope via `workspace_links`

- [ ] **Step 3: Add `mimeFamily(mime)`** → `all | documents | pdfs | images`

- [ ] **Step 4: Run tests — PASS; commit**

```bash
git commit -m "feat(core): add product files queries and MIME filter helpers"
```

---

### Task 5: Product files mutations + file cross-links

**Files:**
- Create: `packages/core/src/mutations/product-files.ts`
- Create: `packages/core/src/mutations/file-cross-links.ts`
- Create: `packages/core/src/mutations/file-cross-links.test.mjs`

**Interfaces:**
- Produces: `createFileSourceRecord`, `updateFileTags`, `deleteFileSource`, `attachFileToEvent`, `linkFileToTask` (if not re-exporting from task-cross-links)

- [ ] **Step 1: Write failing tests** for tag update and attach to calendar_event

- [ ] **Step 2: Implement** — respect Phase 2 attachment reservation patterns where upload touches tasks

- [ ] **Step 3: Run `cd packages/core && npm test` — all PASS**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(core): add product files mutations and event file links"
```

---

### Task 6: Scope prefs (calendar + files)

**Files:**
- Create: `apps/web/lib/calendar/scope-prefs.ts`
- Create: `apps/web/lib/files/scope-prefs.ts`

Mirror `apps/web/lib/tasks/scope-prefs.ts` with keys `planevo:calendar:scope` and `planevo:files:scope`.

- [ ] **Step 1: Copy pattern from tasks scope-prefs**

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(web): add calendar and files scope preference helpers"
```

---

### Task 7: Calendar sidebar + multi-calendar list

**Files:**
- Create: `apps/web/features/calendar-product/calendar-sidebar.tsx`
- Create: `apps/web/features/calendar-product/calendar-color-dot.tsx`
- Modify: `apps/web/app/design/calendar-product-preview.tsx` (create file with sidebar states)

**Interfaces:**
- Consumes: `CalendarRow[]`, `onToggleVisibility`, `onCreateCalendar`

- [ ] **Step 1: Build sidebar** — list with color dots, visibility checkbox, `+ New calendar` button (ink border, not marigold unless sole CTA)

- [ ] **Step 2: Register in `/design`** — empty, 3 calendars, one hidden

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(web): add calendar product sidebar component"
```

---

### Task 8: Today column (tasks due + unscheduled)

**Files:**
- Create: `apps/web/features/calendar-product/today-column.tsx`
- Create: `apps/web/features/calendar-product/today-task-row.tsx`
- Modify: `apps/web/app/design/calendar-product-preview.tsx`

- [ ] **Step 1: Today column** with tabs craft (To-dos active; Event/Notes disabled V1), sections: Today, This week, Unscheduled

- [ ] **Step 2: Task rows** draggable (`useDraggable` from dnd-kit) with `taskId` in data payload

- [ ] **Step 3: `/design` preview** — populated + empty states

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): add calendar today column with draggable tasks"
```

---

### Task 9: Week time grid + event blocks

**Files:**
- Create: `apps/web/features/calendar-product/week-grid.tsx`
- Create: `apps/web/features/calendar-product/event-block.tsx`
- Create: `apps/web/features/calendar-product/time-axis.tsx`
- Create: `apps/web/features/calendar-product/calendar-toolbar.tsx`
- Modify: `apps/web/app/design/calendar-product-preview.tsx`

- [ ] **Step 1: Toolbar** — week label (`Aug 2026 / W30`), Day/Week toggle (Week default), prev/next, Today button (one marigold candidate), Share disabled V1

- [ ] **Step 2: Week grid** — 7 columns, time slots, current-time red line (use `brick` token), all-day row for task due chips

- [ ] **Step 3: Event blocks** — rounded cards, calendar color tint classes (`bg-slate-tint`, etc.), title + time

- [ ] **Step 4: `/design`** — week with 4 events + due chips

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): add calendar week grid and event blocks"
```

---

### Task 10: Calendar event peek + grid click create

**Files:**
- Create: `apps/web/features/calendar-product/event-peek.tsx`
- Create: `apps/web/features/calendar-product/create-event-popover.tsx`
- Modify: `apps/web/app/(workspace)/calendar/actions.ts`

- [ ] **Step 1: Event peek** — anchored popover per reference (title, time, location, description, cross-link buttons: Link task, Attach file, Add to workspace)

- [ ] **Step 2: Grid click** — empty slot opens create form; server action `createCalendarEventAction`

- [ ] **Step 3: Wire actions** with Zod validation

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): add calendar event peek and create-from-grid"
```

---

### Task 11: Calendar drag-drop schedule + product shell

**Files:**
- Create: `apps/web/features/calendar-product/calendar-product-view.tsx`
- Create: `apps/web/features/calendar-product/calendar-dnd-context.tsx`
- Modify: `apps/web/app/(workspace)/calendar/page.tsx`
- Modify: `apps/web/lib/queries/product-calendar.ts` (page loader)

- [ ] **Step 1: DnD** — drop task on grid slot → `scheduleTaskFromDragAction` with computed `starts_at`/`ends_at`

- [ ] **Step 2: `CalendarProductView`** — composes sidebar + today + week grid; client scope toggle

- [ ] **Step 3: Replace `DatabaseFace` in `calendar/page.tsx`** — load via `loadCalendarPageData`

- [ ] **Step 4: Kernel grep** — no `DatabaseFace` in calendar route

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): ship calendar product view with drag-to-schedule"
```

---

### Task 12: Files cabinet shell (CloudNest layout)

**Files:**
- Create: `apps/web/features/files-product/files-cabinet-header.tsx`
- Create: `apps/web/features/files-product/files-action-row.tsx`
- Create: `apps/web/features/files-product/folder-chips.tsx`
- Create: `apps/web/app/design/files-product-preview.tsx`

- [ ] **Step 1: Header** — "Welcome back, {firstName}" + action row: `+ Create` (outline), `Upload or drop` (marigold — sole accent), `Create folder` (outline)

- [ ] **Step 2: Folder chips** — from distinct `metadata_json.folder` or tags

- [ ] **Step 3: `/design` preview** — match CloudNest spacing hierarchy with tokens

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): add files cabinet header and folder chips"
```

---

### Task 13: Files table, filters, upload drop zone

**Files:**
- Create: `apps/web/features/files-product/files-filter-tabs.tsx`
- Create: `apps/web/features/files-product/files-table.tsx`
- Create: `apps/web/features/files-product/files-upload-dropzone.tsx`
- Create: `apps/web/features/files-product/storage-meter.tsx`
- Modify: `apps/web/app/(workspace)/files/actions.ts`

- [ ] **Step 1: Filter tabs** — View all, Documents, PDFs, Images (client filter via `mimeFamily`)

- [ ] **Step 2: Table** — checkbox, icon+name, shared-by placeholder, size, modified, row menu (Download, Delete, Attach to task, Link to event)

- [ ] **Step 3: Upload dropzone** — drag files → server action creates `file_sources` + storage upload (reuse patterns from task attachment upload)

- [ ] **Step 4: Storage meter** — `summarizeStorageBytes` / 10GB cap constant

- [ ] **Step 5: `/design` all row states**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(web): add files table filters upload and storage meter"
```

---

### Task 14: Files preview panel + product cutover

**Files:**
- Create: `apps/web/features/files-product/file-preview-panel.tsx`
- Create: `apps/web/features/files-product/files-product-view.tsx`
- Modify: `apps/web/app/(workspace)/files/page.tsx`

- [ ] **Step 1: Preview panel** — image/PDF/text; close button; tags inline edit

- [ ] **Step 2: `FilesProductView`** — composes cabinet; scope toggle

- [ ] **Step 3: Replace `DatabaseFace` in `files/page.tsx`**

- [ ] **Step 4: Kernel grep** — no `DatabaseFace` in files route

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): ship files product view with preview panel"
```

---

### Task 15: Cross-link UI symmetry + verification

**Files:**
- Modify: `apps/web/features/calendar-product/event-peek.tsx` (attach file picker)
- Modify: `apps/web/features/files-product/files-table.tsx` (attach to task/event pickers)
- Create: `docs/superpowers/ecosystem-phase-3/verification.md`
- Modify: `apps/web/app/design/page.tsx` (register both previews)

- [ ] **Step 1: Event peek** — Attach file opens file picker from `loadProductFiles`

- [ ] **Step 2: Files row menu** — Attach to task / Link to event pickers

- [ ] **Step 3: Verify Schedule from Tasks appears on calendar grid** (manual + document in verification.md)

- [ ] **Step 4: Run full gate suite**

```bash
cd packages/core && npm test
cd apps/web && npm test
cd apps/web && npx tsc --noEmit
cd apps/web && npm run build
rg 'DatabaseFace|getCalendarFaceBundle|getFilesFaceBundle' 'apps/web/app/(workspace)/calendar' 'apps/web/app/(workspace)/files' apps/web/features/calendar-product apps/web/features/files-product
```

Expected: all tests PASS; ripgrep exit `1` (no matches)

- [ ] **Step 5: Write `verification.md`** with command outputs and manual QA checklist

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(ecosystem): complete phase 3 calendar and files verification"
```

---

## Manual QA checklist (Task 15)

1. `/calendar` shows three-pane layout matching reference (sidebar · today · week grid).
2. Toggle calendar visibility hides/shows events on grid.
3. Task with `due_at` shows as chip on calendar without creating duplicate event.
4. Drag task from Today column onto grid → event with `task_id` appears.
5. Schedule button on task (Phase 2) → event visible on grid after refresh.
6. Click grid → create event; peek shows cross-links.
7. `/files` shows CloudNest cabinet: greeting, actions, chips, tabs, table, storage meter.
8. Upload file → appears in table with processing badge → ready.
9. Filter tabs work; search filters client-side by name.
10. Preview panel opens for PDF/image.
11. Attach file to event and task from Files row menu.
12. `All | This workspace` scope filters both products.
13. `/design` shows calendar + files product sections.
14. No `DatabaseFace` on `/calendar` or `/files`.

---

*Plan v1.0 · July 19, 2026 · 15 tasks · Pairs with design spec `2026-07-19-phase-3-calendar-files-design.md`*
