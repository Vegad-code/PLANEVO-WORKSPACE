# Tasks List + Table — Premium Revamp Design

> **Status:** Approved for implementation · July 22, 2026  
> **Authority:** Founder request, prior Notion full-bleed list/table spec, `AGENTS.md`, F-03  
> **Scope:** List and Table views only (Board unchanged)

---

## Goal

Make Tasks **List** and **Table** scan-first and Notion/Linear-premium: zero placeholder noise on typical rows, checkbox complete, inline status/priority/due editing, collapsible groups, and persisted view prefs.

---

## Hypothesis

Because list/table rows currently show repetitive placeholder metadata ("No due date", "0/0", "00") and require opening peek for every property change, we believe a scan-first row with smart metadata + inline property editing will increase task throughput and reduce visual noise. Success: change status or scan due dates without opening peek; empty metadata does not render.

---

## Smart metadata rules

| Field | Show when | Hide when | Display |
|-------|-----------|-----------|---------|
| Due | `due_at` set | no due date | Relative within 7 days (`Today`, `Tomorrow`, `Overdue`, weekday); else short date. Overdue uses `text-brick`. |
| Priority | `priority` non-null | null | Existing priority pill tokens |
| Subtasks | `subtaskTotal > 0` | zero | Mini progress + `done/total` tabular |
| Files | `fileCount > 0` | zero | Count badge |
| Status (list) | `grouping === "priority"` | `grouping === "status"` | Status pill |
| Status (table) | always (column) | empty cell N/A | Status pill + inline editor |
| Done title | status `done` | — | `line-through` + muted; checkbox meadow-filled |

---

## Inline editing contract

- **Checkbox:** toggles `done` ↔ previous non-done status (fallback `not_started`). Optimistic + `updateProductTaskAction`.
- **Status / Priority / Due:** click opens anchored popover; Escape / outside click / successful save dismisses.
- **Peek:** title click / row body (not property controls).
- **Keyboard:** Space on focused checkbox toggles; popovers trap focus; `aria-expanded` / labels required.

---

## Visual craft

- Hairline rows only — no per-row cards
- Group headers: muted bar, optional subtle status tint, tabular count, collapse chevron
- Custom segmented **Group by** control (no native `<select>`)
- Table: sticky title column, sentence-case headers, footer `VALUES {n}`
- Hover: `bg-sidebar/40`; honor `prefers-reduced-motion`
- Tokens only; one marigold (toolbar Create when dialog closed)

---

## List-specific

- Collapsible groups; persist collapsed keys
- **Hide done** toggle (client filter)
- Empty group: "No tasks in this group."

## Table-specific

- Title cell: checkbox + icon + title (sticky left)
- Subtasks/Files blank when zero
- Inline popovers in Status, Priority, Due cells

---

## Persistence (`planevo:tasks:view-prefs`)

```ts
{
  view: "board" | "list" | "table"
  grouping: "status" | "priority"
  sort: { key: string; direction: "ascending" | "descending" }
  collapsedGroups: string[]
  hideDone: boolean
}
```

Hydration-safe: default SSR values, apply stored prefs after mount (no router flash for view).

---

## Accessibility matrix

| Control | Requirement |
|---------|-------------|
| Checkbox | `aria-label` includes task title; Space toggles |
| Group header | `aria-expanded`, keyboard activatable |
| Sort headers | `aria-sort` |
| Popovers | focus trap, Escape closes, restore focus to trigger |
| Empty metadata | do not announce placeholder noise |

---

## File map

| Path | Role |
|------|------|
| `features/tasks-product/task-row/*` | Shared primitives |
| `features/tasks-product/task-inline-edit/*` | Status/priority/due popovers |
| `lib/tasks/task-row-formatters.ts` | Visibility + relative due |
| `lib/tasks/task-view-prefs.ts` | localStorage prefs |
| `task-list.tsx` / `task-list-group.tsx` | List assembly |
| `task-table.tsx` / `task-table-columns.ts` | Table assembly |
| `tasks-product-view.tsx` | Optimistic patch + prefs + hide-done |

---

## Out of scope

Board changes, list/table DnD, column resize/reorder, full filter engine, server sort/filter, live PostHog A/B.

---

## Success criteria

1. Typical row: title + 1–2 meaningful properties  
2. Checkbox completes without peek  
3. Status/priority/due editable inline in both views  
4. Group collapse + group-by + hide-done persist  
5. `/design` shows all states  
6. WCAG for checkbox, popover, sort  
7. `tsc` + unit tests pass  

---

*Design v1.0 · July 22, 2026*
