# Create Task Modal Lumis Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin `CreateTaskDialog` so look and size match the Lumis create-modal reference (narrow shell, taller controls, ink Create Task).

**Architecture:** In-place class/copy changes on `create-task-dialog.tsx`; minor Select height alignment if needed. No new server actions. `/design` preview picks up the same component.

**Tech Stack:** Next.js client component, Tailwind tokens, Lucide, existing `Dialog` / `Button` / `SelectField`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-19-create-task-modal-lumis-parity-design.md`
- Width: `max-w-md`; radius: `rounded-2xl`; body `gap-5`; inputs `h-11`
- Modal primary CTA: `Button variant="ink"` (not marigold)
- Tokens only; Planevo tag vocabulary only
- Keep attachment upload wiring unchanged

---

### Task 1: Reskin CreateTaskDialog to Lumis pixel contract

**Files:**
- Modify: `apps/web/features/tasks-product/create-task-dialog.tsx`
- Modify: `apps/web/components/ui/select.tsx` (input height `h-11` if SelectField used)

- [x] **Step 1: Update shell, header, spacing, controls, dropzone, footer** per spec
- [x] **Step 2: Run** `cd apps/web && npx tsc --noEmit`
- [x] **Step 3: Commit**

```bash
git commit -m "feat(web): Lumis size and look for create task modal"
```

---

### Task 2: Align SelectField height with h-11 inputs

**Files:**
- Modify: `apps/web/components/ui/select.tsx`

- [x] **Step 1: Change select default height from h-10 to h-11**
- [x] **Step 2: tsc + commit if not folded into Task 1**

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| max-w-md / rounded-2xl / gap-5 | 1 |
| Header square + Create New Task | 1 |
| h-11 inputs / rows=5 description | 1 |
| Tall dropzone copy | 1 |
| Ink Create Task | 1 |
| Select height | 2 |
