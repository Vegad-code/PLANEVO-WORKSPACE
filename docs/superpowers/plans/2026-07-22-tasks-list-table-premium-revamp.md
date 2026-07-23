# Tasks List + Table Premium Revamp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** List and Table views feel Notion-premium: zero placeholder noise, checkbox complete, inline status/priority/due, collapsible groups, prefs persist, `/design` preview complete, `tsc` + tests pass.

**Architecture:** Shared `task-row/` primitives + `task-inline-edit/` popovers + formatters/prefs libs. List and Table compose the same atoms. Optimistic patches in `tasks-product-view.tsx` via existing `updateProductTaskAction`.

**Tech Stack:** Next.js App Router, React 19, Tailwind tokens, Framer Motion shell, existing `@planevo/core` task types. Custom anchored popovers (no new Radix dependency).

## Global Constraints

- Planevo tokens only — no hardcoded hex
- One marigold accent (toolbar Create when dialog closed)
- List keeps grouping — do not merge List into Table
- Board view unchanged
- `prefers-reduced-motion` respected
- Fresh reviewer every 2 tasks (council mode)

---

### Task 1: Design spec + orchestrator artifacts

**Files:**
- Create: `docs/superpowers/specs/2026-07-22-tasks-list-table-premium-revamp-design.md`
- Create: `docs/superpowers/plans/2026-07-22-tasks-list-table-premium-revamp.md`
- Create: `docs/superpowers/prompts/grok-4.5-tasks-list-table-orchestrator.md`
- Create: `docs/superpowers/prompts/grok-4.5-tasks-list-table-PASTE-PACKAGE.md`
- Create: `.superpowers/tasks-list-table-revamp/{council-log,worker-status,lessons}.md`
- Create: `docs/superpowers/tasks-list-table-revamp/verification.md` (stub)

- [ ] Write all artifacts; kickoff council logged

### Task 2: `task-row/` primitives

**Files:**
- Create: `apps/web/features/tasks-product/task-row/*.tsx`

- [ ] `TaskRowCheckbox`, `TaskStatusPill`, `TaskPriorityPill`, `TaskDueLabel`, `TaskSubtaskProgress`, `TaskFileBadge`, `TaskMetadataStrip`

### Task 3: Formatters + tests

**Files:**
- Create: `apps/web/lib/tasks/task-row-formatters.ts`
- Create: `apps/web/lib/tasks/task-row-formatters.test.mjs`

- [ ] `getVisibleMetadata`, relative due labels; unit tests pass

### Task 4: Checkbox + optimistic complete

**Files:**
- Modify: `task-row/task-row-checkbox.tsx`, `tasks-product-view.tsx`

- [ ] Wire checkbox to patch status with optimistic update

### Task 5: Status popover

**Files:**
- Create: `apps/web/features/tasks-product/task-inline-edit/task-status-popover.tsx`

- [ ] All statuses; Escape/outside dismiss; a11y

### Task 6: Priority + due popovers

**Files:**
- Create: `task-priority-popover.tsx`, `task-due-popover.tsx`

- [ ] Nullable priority; date + clear due

### Task 7: View prefs + hide done

**Files:**
- Create: `apps/web/lib/tasks/task-view-prefs.ts`
- Create: `apps/web/lib/tasks/task-view-prefs.test.mjs`

- [ ] Persist view/grouping/sort/collapsed/hideDone; hydration-safe

### Task 8: List group header + GroupBy

**Files:**
- Create: `task-list-group.tsx`, group-by control in `task-list.tsx`

- [ ] Collapsible groups; segmented Group by

### Task 9: List row revamp

**Files:**
- Modify: `task-list.tsx`

- [ ] Compose primitives; context-aware metadata; title → peek

### Task 10: Table column system

**Files:**
- Create: `task-table-columns.ts`
- Modify: `task-table.tsx`

- [ ] Sticky title; `VALUES {n}` footer

### Task 11: Table row revamp

**Files:**
- Modify: `task-table.tsx`

- [ ] Checkbox+icon title; inline editors; blank zero cells

### Task 12: Product view integration

**Files:**
- Modify: `tasks-product-view.tsx`

- [ ] Optimistic patch; prefs; hide-done; pass callbacks

### Task 13: Design preview + loading

**Files:**
- Modify: `app/design/tasks-product-preview.tsx`
- Modify: `app/(workspace)/tasks/loading.tsx`

- [ ] All states in `/design`; neutral loading skeleton

### Task 14: Tests + verification

**Files:**
- Modify/create tests; fill `verification.md`

- [ ] `tsc --noEmit`; formatter/prefs tests; checklist signed

---

## North-star `/goal`

> List and Table views feel Notion-premium: zero placeholder noise on typical rows, checkbox complete works, status/priority/due editable inline, groups collapsible, prefs persist, `/design` preview shows all states, `tsc` + tests pass.
