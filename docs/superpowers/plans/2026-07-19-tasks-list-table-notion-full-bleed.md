# Tasks List + Table Notion Full-Bleed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Tasks List and Table views full-bleed with Notion-inspired craft while keeping distinct IA (grouped list vs property grid).

**Architecture:** Extend `getTasksPageLayoutClass` to treat list/table like board when content exists. Reskin `TaskList` and `TaskTable` with shared full-bleed flex shells, sticky table header, hairline rows, and Framer Motion `layout` for sidebar reflow. No new data layer.

**Tech Stack:** Next.js App Router, React 19, Tailwind tokens, Framer Motion (`framer-motion`), existing `@planevo/core` task types.

## Global Constraints

- Planevo tokens only — no hardcoded hex, font names, or arbitrary pixel utilities
- Reference images are craft-only — do not clone Notion sidebar/database IA
- One marigold accent per screen (toolbar Create task when dialog closed)
- List keeps grouping by status/priority — do not merge List into Table
- Reuse `getShellLayoutTransition` / `usePrefersReducedMotion` from board work
- `prefers-reduced-motion`: instant layout transitions

---

### Task 1: Full-bleed layout helper + page wiring

**Files:**
- Modify: `apps/web/features/tasks-product/tasks-page-layout.ts`
- Modify: `apps/web/features/tasks-product/tasks-product-view.tsx`

**Interfaces:**
- Consumes: `TasksView` from `tasks-toolbar`
- Produces: `getTasksPageLayoutClass(view, hasContent: boolean)` returning full-bleed class for `board | list | table` when `hasContent === true`

- [ ] **Step 1: Update layout helper**

```ts
export function getTasksPageLayoutClass(
  view: TasksView,
  hasContent: boolean,
): string {
  if (
    hasContent &&
    (view === "board" || view === "list" || view === "table")
  ) {
    return "flex min-h-full w-full flex-col px-5 pt-6 pb-6 sm:px-6 lg:px-8"
  }
  return "mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
}
```

- [ ] **Step 2: Wire `tasks-product-view.tsx`**

Replace `isBoardFullBleed` with:

```ts
const isFullBleed =
  visibleTasks.length > 0 &&
  (view === "board" || view === "list" || view === "table")
```

Use `isFullBleed` for header margin and content flex wrapper. Pass `fillHeight` to `TaskList` and `TaskTable`.

- [ ] **Step 3: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`  
Expected: PASS

---

### Task 2: Notion-style TaskTable

**Files:**
- Modify: `apps/web/features/tasks-product/task-table.tsx`

**Interfaces:**
- Consumes: `getShellLayoutTransition`, `usePrefersReducedMotion`, `fillHeight?: boolean`
- Produces: `TaskTable` with sticky header, property icons, footer count

- [ ] **Step 1: Add motion wrapper + flex shell**

Outer structure:

```tsx
<motion.div
  layout
  transition={layoutTransition}
  className={fillHeight ? "flex min-h-0 flex-1 flex-col" : undefined}
>
  <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-border bg-paper">
    <div className="min-h-0 flex-1 overflow-auto">
      <table>...</table>
    </div>
    <footer>VALUES {rows.length}</footer>
  </div>
</motion.div>
```

- [ ] **Step 2: Sticky header + column type icons**

Use `Planevo Icon` names: `tasks` (title), `status`, `priority`, `calendar`, `subtasks`, `document`.

Header classes: `sticky top-0 z-10 bg-paper border-b border-border`.

- [ ] **Step 3: Row craft**

Remove heavy `bg-surface-raised` per row. Use `border-b border-border hover:bg-sidebar/40`.

- [ ] **Step 4: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`  
Expected: PASS

---

### Task 3: Notion-style TaskList

**Files:**
- Modify: `apps/web/features/tasks-product/task-list.tsx`

**Interfaces:**
- Consumes: same motion helpers, `fillHeight?: boolean`
- Produces: grouped list with Notion row density

- [ ] **Step 1: Motion + flex shell**

Same outer pattern as TaskTable (without table footer).

- [ ] **Step 2: Toolbar bar**

Group-by select in slim `border-b border-border bg-paper px-4 py-2.5` bar.

- [ ] **Step 3: Row layout**

Title `flex-1 truncate text-body font-medium` left; inline metadata right: status pill, due (hidden sm+), subtask count. Row button: `border-b border-border px-4 py-3 hover:bg-sidebar/40`.

- [ ] **Step 4: Group headers**

`bg-sidebar/60 px-4 py-2 text-label uppercase tracking-wide text-text-muted` with count.

- [ ] **Step 5: Run typecheck**

Run: `cd apps/web && npx tsc --noEmit`  
Expected: PASS

---

### Task 4: Design preview + verification

**Files:**
- Modify: `apps/web/app/design/tasks-product-preview.tsx` (pass `fillHeight` where needed)

- [ ] **Step 1: Preview list/table sections use new components unchanged API**

- [ ] **Step 2: Manual QA on `/tasks`**

Checklist from design spec items 1–5.

- [ ] **Step 3: Final typecheck**

Run: `cd apps/web && npx tsc --noEmit`  
Expected: PASS
