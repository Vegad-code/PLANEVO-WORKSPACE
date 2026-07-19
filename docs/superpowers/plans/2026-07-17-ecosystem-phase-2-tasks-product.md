# Ecosystem Phase 2 — Tasks Product Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the real Tasks product — Lumis-craft board/list/table on `tasks` table, cross-feature buttons, F-15 quick capture wire, strangler cutover off `DatabaseFace` for `/tasks`.

**Architecture:** Product queries/mutations in `@planevo/core`; dedicated `apps/web/features/tasks-product/` UI module; server actions in `tasks/actions.ts`; reuse dnd-kit column patterns from database board but typed to `TaskRow`, not `DisplayRecord`. Cross-links via existing F-02 tables.

**Tech Stack:** Next.js App Router (RSC + server actions), TypeScript strict, Tailwind tokens, Supabase RLS, dnd-kit, `@planevo/core` Node test runner.

## Global Constraints

- **Authority:** `docs/planevo-prd.md` v2.0 Phase 2, `docs/planevo-feature-spec.md` F-03, F-15, F-02, `docs/superpowers/specs/2026-07-17-phase-2-tasks-product-design.md`, `AGENTS.md`.
- **No kernel faces:** `/tasks` must not import `DatabaseFace` or `getTaskFaceBundle` when `isEcosystemV2Enabled()` is true.
- **Lumis reference:** craft only (cards, columns, badges) — not Lumis sidebar IA.
- **Tokens:** No hardcoded hex/px — `globals.css` tokens via Tailwind.
- **One marigold per view:** single primary CTA (`+ Create task`).
- **RLS:** All mutations use authenticated client; `user_id = auth.uid()` on tasks.
- **Filter prefs:** Client-only (`planevo:tasks:scope` in localStorage). Never on `tasks` rows.
- **Tests:** `npm test` in `packages/core` after core changes.
- **Commits:** One commit per task. No push unless founder asks.
- **Phase boundary:** No Calendar grid UI, no Files cabinet UI, no embed blocks (Phase 3–4).
- **Dogfood gate:** Phase 2 not complete until founder signs `dogfood-log.md` (≥3 weekdays).

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/core/src/types/tasks.ts` | Status/priority const maps, `TaskRow`, `TaskWithMeta` |
| `packages/core/src/queries/product-tasks.ts` | `loadProductTasks`, subtask + file counts |
| `packages/core/src/mutations/product-tasks.ts` | create/update/delete/reorder tasks + subtasks |
| `packages/core/src/mutations/task-cross-links.ts` | schedule, attachFile, linkToWorkspace |
| `packages/core/src/parsing/quick-capture-to-task.ts` | `QuickCaptureDraft` → insert payload |
| `packages/core/src/queries/product-tasks.test.mjs` | Query tests |
| `packages/core/src/mutations/product-tasks.test.mjs` | Mutation tests |
| `packages/core/src/parsing/quick-capture-to-task.test.mjs` | Parser mapping tests |
| `apps/web/lib/tasks/scope-prefs.ts` | `All \| This workspace` localStorage |
| `apps/web/features/tasks-product/types.ts` | View mode union |
| `apps/web/features/tasks-product/task-card.tsx` | Lumis-craft card |
| `apps/web/features/tasks-product/task-board.tsx` | Board + dnd |
| `apps/web/features/tasks-product/task-list.tsx` | List view |
| `apps/web/features/tasks-product/task-table.tsx` | Table view |
| `apps/web/features/tasks-product/task-peek.tsx` | Detail sheet |
| `apps/web/features/tasks-product/tasks-toolbar.tsx` | View toggle, filter, create |
| `apps/web/features/tasks-product/tasks-product-view.tsx` | Client shell |
| `apps/web/features/tasks-product/cross-link-actions.tsx` | Schedule / Attach / Workspace |
| `apps/web/app/(workspace)/tasks/page.tsx` | RSC strangler |
| `apps/web/app/(workspace)/tasks/actions.ts` | Server actions |
| `apps/web/app/design/tasks-product-preview.tsx` | `/design` states |
| `apps/web/app/design/page.tsx` | Register preview section |

---

### Task 1: Task types and status maps

**Files:**
- Create: `packages/core/src/types/tasks.ts`
- Test: `packages/core/src/types/tasks.test.mjs`

**Interfaces:**
- Produces: `TASK_STATUSES`, `TASK_STATUS_LABELS`, `TASK_PRIORITIES`, `TaskStatus`, `TaskPriority`, `TaskRow`

- [ ] **Step 1: Write the failing test**

```javascript
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  taskStatusLabel,
} from "../src/types/tasks.ts";

test("taskStatusLabel maps db enum to UI label", () => {
  assert.deepEqual(TASK_STATUSES, ["not_started", "in_progress", "done", "cancelled"]);
  assert.equal(taskStatusLabel("not_started"), "Not started");
  assert.equal(taskStatusLabel("in_progress"), "In progress");
  assert.equal(taskStatusLabel("done"), "Done");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && node --no-warnings --experimental-strip-types --test src/types/tasks.test.mjs`  
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
export const TASK_STATUSES = [
  "not_started",
  "in_progress",
  "done",
  "cancelled",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority | null;
  due_at: string | null;
  description_json: Record<string, unknown>;
  position: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function taskStatusLabel(status: TaskStatus): string {
  return TASK_STATUS_LABELS[status];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && node --no-warnings --experimental-strip-types --test src/types/tasks.test.mjs`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/types/tasks.ts packages/core/src/types/tasks.test.mjs
git commit -m "feat(core): add task product types and status labels"
```

---

### Task 2: Product task queries

**Files:**
- Create: `packages/core/src/queries/product-tasks.ts`
- Create: `packages/core/src/queries/product-tasks.test.mjs`
- Modify: `packages/core/package.json` (add test file to test script if needed)

**Interfaces:**
- Consumes: `TaskRow` from `types/tasks.ts`, `listWorkspaceResourceIds` from `queries/workspace-links.ts`
- Produces: `loadProductTasks(client, userId, options?)` → `TaskWithMeta[]`, `TaskWithMeta` type

- [ ] **Step 1: Write the failing test**

```javascript
import assert from "node:assert/strict";
import { test } from "node:test";
import { loadProductTasks } from "../src/queries/product-tasks.ts";

test("loadProductTasks returns tasks ordered by position", async () => {
  const rows = [
    { id: "t2", user_id: "u1", title: "B", status: "not_started", priority: null,
      due_at: null, description_json: {}, position: 2, completed_at: null,
      created_at: "2026-01-01", updated_at: "2026-01-01" },
    { id: "t1", user_id: "u1", title: "A", status: "done", priority: "high",
      due_at: null, description_json: {}, position: 1, completed_at: null,
      created_at: "2026-01-01", updated_at: "2026-01-01" },
  ];
  const client = {
    from(table) {
      if (table === "tasks") {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: rows, error: null }),
            }),
          }),
        };
      }
      if (table === "task_subtasks") {
        return { select: () => ({ in: async () => ({ data: [], error: null }) }) };
      }
      if (table === "file_links") {
        return { select: () => ({ eq: () => ({ in: async () => ({ data: [], error: null }) }) }) };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  const result = await loadProductTasks(client, "u1");
  assert.equal(result.length, 2);
  assert.equal(result[0].title, "B");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && node --no-warnings --experimental-strip-types --test src/queries/product-tasks.test.mjs`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Implement `loadProductTasks` selecting from `tasks` where `user_id`, order by `position`, batch-load subtask counts and `file_links` counts per task, optional `workspaceId` filter via `listWorkspaceResourceIds`. Export `TaskWithMeta` extending `TaskRow` with `subtaskTotal`, `subtaskDone`, `fileCount`, `subtasks[]`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/core && npm test`  
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/queries/product-tasks.ts packages/core/src/queries/product-tasks.test.mjs
git commit -m "feat(core): add product task queries with subtask and file counts"
```

---

### Task 3: Product task mutations

**Files:**
- Create: `packages/core/src/mutations/product-tasks.ts`
- Create: `packages/core/src/mutations/product-tasks.test.mjs`

**Interfaces:**
- Produces: `createTask`, `updateTask`, `updateTaskStatus`, `reorderTask`, `deleteTask`, `createSubtask`, `toggleSubtask`, `deleteSubtask`

- [ ] **Step 1: Write failing tests for createTask and updateTaskStatus**

```javascript
import assert from "node:assert/strict";
import { test } from "node:test";
import { createTask, updateTaskStatus } from "../src/mutations/product-tasks.ts";

test("createTask inserts with defaults", async () => {
  let inserted = null;
  const client = {
    from() {
      return {
        insert(row) {
          inserted = row;
          return { select: () => ({ single: async () => ({ data: { id: "new-id", ...row }, error: null }) }) };
        },
      };
    },
  };
  const task = await createTask(client, "user-1", { title: "Ship Phase 2" });
  assert.equal(inserted.title, "Ship Phase 2");
  assert.equal(inserted.status, "not_started");
  assert.equal(task.id, "new-id");
});

test("updateTaskStatus sets completed_at when done", async () => {
  let patch = null;
  const client = {
    from() {
      return {
        update(values) {
          patch = values;
          return { eq: () => ({ eq: async () => ({ error: null }) }) };
        },
      };
    },
  };
  await updateTaskStatus(client, "user-1", "task-1", "done");
  assert.equal(patch.status, "done");
  assert.ok(patch.completed_at);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement mutations** with `updated_at` touch, position via `fractional` ordering if reorder needed (reuse `packages/core/src/ordering/fractional.ts`).

- [ ] **Step 4: Run `cd packages/core && npm test` — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(core): add product task CRUD and subtask mutations"
```

---

### Task 4: Cross-link mutations (Schedule, Attach, Workspace)

**Files:**
- Create: `packages/core/src/mutations/task-cross-links.ts`
- Create: `packages/core/src/mutations/task-cross-links.test.mjs`

**Interfaces:**
- Consumes: `linkResourceToWorkspace` from `mutations/workspace-links.ts`
- Produces: `scheduleTask`, `attachFileToTask`, `linkTaskToWorkspace`

- [ ] **Step 1: Write failing test for scheduleTask**

```javascript
test("scheduleTask creates calendar_event with task_id", async () => {
  const inserts = [];
  const client = {
    from(table) {
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: { id: "cal-1" }, error: null }),
              }),
            }),
          }),
        }),
        insert(row) {
          inserts.push({ table, row });
          return { select: () => ({ single: async () => ({ data: { id: "evt-1" }, error: null }) }) };
        },
      };
    },
  };
  await scheduleTask(client, "user-1", {
    taskId: "task-1",
    title: "Review PRD",
    startsAt: "2026-07-20T14:00:00.000Z",
    endsAt: "2026-07-20T15:00:00.000Z",
  });
  assert.equal(inserts[0].table, "calendar_events");
  assert.equal(inserts[0].row.task_id, "task-1");
});
```

- [ ] **Step 2–4: Implement** `attachFileToTask` (insert `file_links`), `linkTaskToWorkspace` (delegate to `linkResourceToWorkspace`), tests pass.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(core): add task cross-link mutations for schedule, file, workspace"
```

---

### Task 5: Quick capture → tasks mapping (F-15)

**Files:**
- Create: `packages/core/src/parsing/quick-capture-to-task.ts`
- Create: `packages/core/src/parsing/quick-capture-to-task.test.mjs`

**Interfaces:**
- Consumes: `parseQuickCapture`, `QuickCaptureDraft` from `parsing/natural-capture.ts`
- Produces: `quickCaptureToTaskInsert(draft)` → `{ title, status, priority, due_at }`

- [ ] **Step 1: Write failing test**

```javascript
import { quickCaptureToTaskInsert } from "../src/parsing/quick-capture-to-task.ts";

test("maps priority token to db enum", () => {
  const payload = quickCaptureToTaskInsert({
    title: "Finish essay",
    dueDate: null,
    priority: "High",
    status: null,
    time: null,
    databaseToken: null,
    personToken: null,
    priorityToken: "high",
    recurringUnsupported: false,
    consumedRanges: [],
  });
  assert.equal(payload.priority, "high");
  assert.equal(payload.status, "not_started");
});
```

- [ ] **Step 2–4: Implement** mapping: priority labels → `low|medium|high`, status labels → enum, combine `dueDate` + `time` into `due_at` ISO.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(core): map quick capture draft to tasks insert payload"
```

---

### Task 6: Scope prefs + server data loader

**Files:**
- Create: `apps/web/lib/tasks/scope-prefs.ts`
- Create: `apps/web/lib/queries/product-tasks.ts`
- Modify: `apps/web/app/(workspace)/tasks/page.tsx`

**Interfaces:**
- Produces: `getTasksScope()`, `setTasksScope()`, `loadTasksPageData()` for RSC

- [ ] **Step 1: Implement scope prefs** (`"all" | "workspace"`, localStorage key `planevo:tasks:scope`).

- [ ] **Step 2: Create `loadTasksPageData`** — `getUser()`, `loadProductTasks`, current workspace id, workspace filter when scope is workspace (read scope from cookie or default `all` on server; client hydrates from localStorage).

- [ ] **Step 3: Update `page.tsx`** — if `isEcosystemV2Enabled()`, render placeholder `<TasksProductView tasks={...} />` (stub); else keep `DatabaseFace`.

- [ ] **Step 4: Manual check** — `/tasks` with `PLANEVO_ECOSYSTEM_V2=true` shows stub, not DatabaseFace.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): add tasks scope prefs and ecosystem v2 page strangler"
```

---

### Task 7: Task card + board (design first)

**Files:**
- Create: `apps/web/features/tasks-product/task-card.tsx`
- Create: `apps/web/features/tasks-product/task-board.tsx`
- Create: `apps/web/app/design/tasks-product-preview.tsx`
- Modify: `apps/web/app/design/page.tsx`

**Interfaces:**
- Consumes: `TaskWithMeta`, `TASK_STATUS_LABELS`, dnd-kit (mirror `record-board.tsx` sensors)

- [ ] **Step 1: Add `/design` preview** with sample `TaskWithMeta` fixtures — card states: default, high priority, overdue, all subtasks done, empty column.

- [ ] **Step 2: Implement `TaskCard`** — title, priority pill, due date, `n of m Subtasks`, file count; tokens only; no marigold on card.

- [ ] **Step 3: Implement `TaskBoard`** — columns for `not_started`, `in_progress`, `done`; drag calls `onStatusChange(taskId, status, position)` prop.

- [ ] **Step 4: Visual review** at `/design` — founder craft check before wiring actions.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): add Lumis-craft task card and board with design preview"
```

---

### Task 8: List and table views + toolbar

**Files:**
- Create: `apps/web/features/tasks-product/task-list.tsx`
- Create: `apps/web/features/tasks-product/task-table.tsx`
- Create: `apps/web/features/tasks-product/tasks-toolbar.tsx`
- Modify: `apps/web/app/design/tasks-product-preview.tsx`

- [ ] **Step 1: Toolbar** — Board | List | Table segmented control; All | This workspace filter; **one** marigold `+ Create task`.

- [ ] **Step 2: List view** — dense rows, group headers by status.

- [ ] **Step 3: Table view** — sortable columns (client sort OK for V1).

- [ ] **Step 4: Extend design preview** with list + table states.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): add task list, table views, and toolbar"
```

---

### Task 9: Tasks product shell + server actions

**Files:**
- Create: `apps/web/features/tasks-product/tasks-product-view.tsx`
- Create: `apps/web/features/tasks-product/task-peek.tsx`
- Modify: `apps/web/app/(workspace)/tasks/actions.ts`
- Modify: `apps/web/app/(workspace)/tasks/page.tsx`

- [ ] **Step 1: Server actions** — `createProductTask`, `updateProductTask`, `moveProductTask`, `deleteProductTask`, subtask actions; each: `getUser()`, Zod validate, core mutation, `revalidatePath('/tasks')`.

- [ ] **Step 2: `TasksProductView`** — wires toolbar, board/list/table, optimistic drag → `moveProductTask`.

- [ ] **Step 3: `TaskPeek`** — slide-over: edit fields, subtask checklist.

- [ ] **Step 4: Empty state** — line-art illustration + `Add your first task`; remove recreate-database copy.

- [ ] **Step 5: `N` shortcut** — register in `TasksProductView` when focused.

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(web): wire tasks product view with server actions and peek panel"
```

---

### Task 10: Cross-feature buttons

**Files:**
- Create: `apps/web/features/tasks-product/cross-link-actions.tsx`
- Modify: `apps/web/app/(workspace)/tasks/actions.ts`
- Modify: `apps/web/features/tasks-product/task-peek.tsx`

- [ ] **Step 1: Schedule sheet** — date + time pickers → `scheduleTask` action → toast success.

- [ ] **Step 2: Attach file** — modal listing `file_sources` for user → `attachFileToTask` → refresh file count.

- [ ] **Step 3: Add to workspace** — use current workspace or picker → `linkTaskToWorkspace` → calm toast (no auto-link on create yet).

- [ ] **Step 4: Manual test** all three buttons from peek panel.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): add Schedule, Attach file, and Add to workspace task actions"
```

---

### Task 11: Quick capture wire (F-15)

**Files:**
- Modify: `apps/web/features/command-bar/command-bar.tsx` (or quick-capture handler)
- Modify: `apps/web/app/(workspace)/tasks/actions.ts`

- [ ] **Step 1: Action `captureTaskFromQuickAdd`** — parse with `parseQuickCapture`, map with `quickCaptureToTaskInsert`, `createTask`.

- [ ] **Step 2: Wire command bar** submit path to new action instead of kernel record insert.

- [ ] **Step 3: Test** `Cmd+K` → `Finish essay !!high tomorrow` creates row in `tasks`.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(web): wire quick capture to tasks product table"
```

---

### Task 12: Strangler cutover + cleanup

**Files:**
- Modify: `apps/web/app/(workspace)/tasks/page.tsx`
- Modify: `apps/web/app/(workspace)/tasks/actions.ts` (remove `recreateTaskDatabase`, kernel `submitTask` paths when v2)
- Modify: `apps/web/lib/queries/tasks.ts` (add `@deprecated` JSDoc — kernel bundle for legacy only)

- [ ] **Step 1: When `isEcosystemV2Enabled()`** — `/tasks` renders only `TasksProductView`; no `DatabaseFace` import in that branch.

- [ ] **Step 2: Remove** `RecreateDatabaseButton`, `getTaskFaceBundle`, `TaskComposer` kernel paths from v2 branch.

- [ ] **Step 3: Deprecate** `loadTasksBundle` with JSDoc pointing to `loadProductTasks`.

- [ ] **Step 4: Grep** repo for `/tasks` kernel assumptions; fix command-bar index if needed.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(web): complete tasks strangler cutover off DatabaseFace"
```

---

### Task 13: Verification + dogfood gate doc

**Files:**
- Create: `docs/superpowers/ecosystem-phase-2/verification.md`
- Modify: `.superpowers/ecosystem-phase-2/dogfood-log.md`

- [ ] **Step 1: Write verification checklist** — automated (`npm test`, typecheck) + manual UI steps mirroring dogfood checklist.

- [ ] **Step 2: Run** `cd packages/core && npm test` and `cd apps/web && npx tsc --noEmit` — paste results in verification.md.

- [ ] **Step 3: Document** dogfood gate instructions for founder.

- [ ] **Step 4: Commit**

```bash
git commit -m "docs: add phase 2 tasks product verification and dogfood gate"
```

---

### Task 14: Dogfood gate sign-off (founder)

**Files:**
- Modify: `.superpowers/ecosystem-phase-2/dogfood-log.md`

- [ ] **Step 1:** Founder uses `/tasks` daily for ≥3 weekdays; orchestrator does not advance to Phase 3 until sign-off.

- [ ] **Step 2:** Append dated rows to `dogfood-log.md` with checklist ticks.

- [ ] **Step 3:** Council declares Phase 2 complete only after sign-off.

**This task is blocked on the founder — not automatable by workers.**

---

## Spec coverage self-review

| Requirement | Task |
|-------------|------|
| Board default Lumis craft | 7 |
| List + table views | 8 |
| `tasks` table not kernel | 2, 3, 12 |
| Subtasks | 2, 3, 9 |
| Cross-feature Schedule/Attach/Workspace | 4, 10 |
| F-15 quick capture | 5, 11 |
| All / This workspace filter | 6 |
| Empty state no task database | 9 |
| `/tasks` not DatabaseFace | 6, 12 |
| Dogfood gate | 13, 14 |
| `/design` preview | 7, 8 |

---

*Plan v1.0 · July 17, 2026 · Orchestrated by `fable-5-phase-2-orchestrator.md`*
