# Tasks List + Table — Notion Full-Bleed Design

> **Status:** Approved for implementation · July 19, 2026  
> **Authority:** Founder request, Notion library table craft reference, `AGENTS.md`, design-build-sheet Screens 3 & 6  
> **Scope:** List and Table views only (Board unchanged)

---

## Goal

Extend the Tasks **List** and **Table** views to fill the main canvas edge-to-edge (same shell contract as Board), with Notion-inspired craft: airy property grid for Table, grouped sparse rows for List. Same underlying task data; distinct layout contracts per Notion product behavior.

---

## Research conclusion (Notion product model)

Notion keeps **List** and **Table** as separate first-class views:

| View | Notion role | Planevo mapping |
|------|-------------|-----------------|
| Board | Stage columns, drag workflow | Already full-bleed |
| List | Title-first rows, 1–3 inline properties, optional grouping | Grouped sections (status default) |
| Table | Dense property grid, sortable columns, filter pills | Full spreadsheet scan |

**Do not merge List into Table** — that contradicts Notion's view switcher mental model.

---

## Locked decisions

| Decision | Choice |
|----------|--------|
| List IA | **Option A** — keep grouping (status/priority), Notion row craft |
| Table IA | Full Notion library-table craft (headers, pills, hairlines) |
| Layout | Full bleed for List + Table when tasks exist (match Board padding) |
| Motion | Reuse `shell-spring` + `layout` on data shells (sidebar reflow) |
| Filters | No new filter engine — scope stays in toolbar; table shows task count footer only |
| Tokens | Planevo tokens only — no hardcoded hex |

---

## Visual contract

### Page shell (List / Table with content)

- Same as Board: `flex min-h-full w-full flex-col px-5 pt-6 pb-6 sm:px-6 lg:px-8`
- Header: `mb-4 shrink-0` (not `mb-8`)
- Content wrapper: `flex min-h-0 flex-1 flex-col`

### Table view (Notion craft)

- Outer: `flex min-h-0 flex-1 flex-col border border-border bg-paper` (full width, minimal chrome)
- Sticky `<thead>` on vertical scroll inside flex shell
- Column headers: `text-label uppercase text-text-muted` + Planevo property-type icon
- Rows: `border-b border-border`, `hover:bg-sidebar/40`, no per-row cards
- Cells: status/priority as existing pill tokens
- Footer: `VALUES {n}` count row (mono label, muted)
- Horizontal scroll when columns exceed viewport

### List view (Notion craft)

- Outer: same full-bleed flex shell as Table
- Slim toolbar: Group by select (right-aligned), `border-b border-border`
- Group headers: muted bar, title + count (collapsible styling optional later)
- Rows: title left (prominent), 2–3 inline properties right (status pill, due, subtasks)
- Hairline row dividers only — no card per row
- Grouping behavior unchanged (status / priority)

---

## Out of scope

- New filter/sort pill bar (toolbar owns scope + view switch)
- Column resize / reorder / freeze
- List/table DnD reorder
- Lumis / Notion IA clone (sidebar, database property editor)

---

## Files

| File | Action |
|------|--------|
| `tasks-page-layout.ts` | Extend full-bleed to list + table |
| `tasks-product-view.tsx` | Unified `isFullBleed` for all content views |
| `task-table.tsx` | Notion grid reskin + motion shell |
| `task-list.tsx` | Notion grouped list reskin + motion shell |
| `tasks-product-preview.tsx` | Preview sections match new chrome |

---

## Testing

1. `/tasks` Table — edge-to-edge, sticky header, pills, footer count
2. `/tasks` List — grouped rows, inline properties, full width
3. Toggle Board ↔ List ↔ Table — layout fills canvas each time
4. Sidebar toggle — table/list reflow with shell motion
5. Empty state — stays centered `max-w-7xl`
6. `npx tsc --noEmit`

---

*Design v1.0 · July 19, 2026*
