# Phase 2 — Tasks Product Design

> **Status:** Approved for implementation planning · July 17, 2026  
> **Authority:** `docs/planevo-prd.md` v2.0 §8 Phase 2, `docs/planevo-feature-spec.md` F-03, F-15, F-02 (cross-links), `AGENTS.md`

---

## Goal

Ship the real **Tasks product** on the `tasks` / `task_subtasks` tables. `/tasks` stops using `DatabaseFace`. Lumis-craft board (default), list, and table views. Cross-feature buttons: **Schedule**, **Attach file**, **Add to workspace**. Quick capture (F-15) inserts into `tasks`. **Dogfood Gate #1:** founder uses Tasks daily before Phase 3.

---

## Architecture

**Strangler cutover (Phase B).** Phase 1 laid product tables and `workspace_links` / `file_links`. Phase 2 adds:

1. **`packages/core`** — product queries and mutations against `tasks` (replace kernel `loadTasksBundle` for the `/tasks` route).
2. **`apps/web/features/tasks-product/`** — dedicated React module (board/list/table, cards, peek, actions). Reuse **dnd-kit patterns** from `record-board.tsx` and **column grouping** from `board-state.ts`; do **not** route through `DisplayRecord` / kernel properties.
3. **`apps/web/app/(workspace)/tasks/`** — RSC page loads product data; server actions call core mutations.
4. **Cross-feature** — Schedule writes `calendar_events` with `task_id`; Attach writes `file_links`; Add to workspace writes `workspace_links` (calm toast, no auto-link).
5. **F-15** — `parseQuickCapture` output maps to `tasks` row insert (not `records`).

**Feature flag:** `isEcosystemV2Enabled()` gates the new UI on `/tasks`. When false, legacy `DatabaseFace` remains (Phase 1 behavior). Phase 2 completion sets env default to v2 for dev and removes the face path from `/tasks` when flag is on.

---

## Lumis reference (craft only)

The attached Lumis board screenshot is **craft reference only** — card density, priority pill, subtask line, due date, file count, column headers. **Do not clone** Lumis sidebar IA (AI Threads, Agents, usage meter). Planevo keeps workspace-first shell from `app-shell.tsx`.

| Lumis craft to borrow | Planevo rule |
|----------------------|--------------|
| Card radius, paper surface, priority color pills | Use tokens (`paper`, `ink`, `border`, priority semantic tokens) |
| Column headers with counts | Status columns from app enum, renameable labels in UI code |
| Subtask progress line | `task_subtasks` count |
| File count footer | `file_links` count per task |
| Board / List toggle | Board / List / **Table** (spec requires table) |
| Black primary CTA | **One marigold** primary CTA per view (`+ Create task`) |

---

## Views (F-03)

| View | Default | Behavior |
|------|---------|----------|
| **Board** | Yes | Columns: Not started / In progress / Done (labels in UI; DB: `not_started`, `in_progress`, `done`). Drag card changes `status` + `position`. |
| **List** | | Dense rows; group by status or priority. |
| **Table** | | Sortable columns: title, status, priority, due, subtasks, files. |

**Filter:** `All` \| `This workspace` — client-cached (`localStorage` key `planevo:tasks:scope`). Workspace filter uses `listWorkspaceResourceIds` for `resource_type: 'task'`.

---

## Task card & peek

**Card shows:** title, priority badge, due date, subtask progress (`n of m`), file count, (assignee avatars **later** — V1 shows owner only or omit).

**Peek panel:** title edit, status, priority, due date, description (BlockNote or plain textarea V1), subtask checklist, cross-feature buttons.

**Creation:** `+ Create task`, `N` shortcut in Tasks view, F-15 quick capture globally. All create **global** `tasks` rows. If workspace context active, calm toast: *"Add to [Workspace]?"* → `workspace_links` (one tap).

---

## Cross-feature buttons (Phase 2 scope)

| Button | Action | Tables |
|--------|--------|--------|
| **Schedule** | Opens minimal schedule sheet: pick date/time → `calendar_events` row on user's default calendar with `task_id` set | `calendars`, `calendar_events` |
| **Attach file** | Picker from user's `file_sources` → `file_links` | `file_links` |
| **Add to workspace** | Picker or current workspace → `workspace_links` | `workspace_links` |

Calendar **grid UI** is Phase 3; Schedule only needs mutation + success feedback in Phase 2.

---

## Empty state

Illustration (line art scaffolding) + **Add your first task** + import hint. **No** "create task database" or `RecreateDatabaseButton`.

---

## Out of scope (Phase 2)

- Full Calendar product UI (Phase 3)
- Files cabinet UI (Phase 3) — attach uses picker only
- Workspace embed blocks / link toast on every create (Phase 4) — minimal toast on create OK
- Custom fields, recurring tasks, multi-assignee
- Deleting `face-databases` entirely (Phase 8 cleanup)
- LLM quick capture

---

## Dogfood Gate #1

Before declaring Phase 2 complete:

1. Founder uses `/tasks` as primary task surface for **≥ 3 consecutive weekdays**.
2. Checklist: create task, drag across board, list + table views, subtasks, due date, Schedule, Attach file, Add to workspace, quick capture, workspace filter.
3. Orchestrator records daily sign-off in `.superpowers/ecosystem-phase-2/dogfood-log.md`.

---

## File map

| Path | Role |
|------|------|
| `packages/core/src/types/tasks.ts` | Task status/priority enums, row types |
| `packages/core/src/queries/product-tasks.ts` | Load tasks + subtasks + file counts |
| `packages/core/src/mutations/product-tasks.ts` | CRUD, reorder, subtasks |
| `packages/core/src/mutations/task-cross-links.ts` | schedule, attach file, workspace link |
| `packages/core/src/parsing/quick-capture-to-task.ts` | Map `QuickCaptureDraft` → task insert payload |
| `apps/web/features/tasks-product/` | UI module |
| `apps/web/app/(workspace)/tasks/page.tsx` | RSC entry, strangler |
| `apps/web/app/(workspace)/tasks/actions.ts` | Server actions |
| `apps/web/lib/tasks/scope-prefs.ts` | All / This workspace localStorage |
| `apps/web/app/design/tasks-product-preview.tsx` | Kitchen-sink states |

---

*Design v1.0 · July 17, 2026*
