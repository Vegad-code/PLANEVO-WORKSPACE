# Tasks Full-Bleed Board + Unified Shell Motion

> **Status:** Approved for implementation · July 19, 2026  
> **Authority:** Founder session decisions, `AGENTS.md` tokens, F-03 Tasks product  
> **Scope:** Board view layout + shell sidebar motion only

---

## Goal

Make the Tasks **board view** fill the main canvas edge-to-edge (Lumis craft reference), with a unified Framer Motion shell that choreographs sidebar width changes and board column reflow. List and Table views keep the current centered `max-w-7xl` layout.

---

## Locked decisions (founder)

| Decision | Choice |
|----------|--------|
| View scope | **Board only** — List/Table unchanged |
| Header | **Full bleed** with board (title, toolbar, board span canvas) |
| Motion | **Unified shell** — sidebar spacer + tasks canvas share Framer Motion |
| Peek | **Notion standard** — peek overlay does not shrink board |
| Approach | **A — Unified `LayoutGroup` shell** |

---

## Out of scope

- List/Table layout changes
- Lumis sidebar IA clone
- Migrating peek CSS animations to Framer Motion
- Home/Calendar fluid layout (unaffected except shared spacer motion)
- Create task modal (separate spec)

---

## Layout model

| State | Board horizontal space | Motion trigger |
|-------|------------------------|----------------|
| Sidebar expanded | 100% of main column | Spacer width spring + column `layout` |
| Sidebar hidden | Full viewport minus padding | Spacer → 0 + column `layout` |
| Sidebar peek | Same as hidden | No spacer change; overlay only |
| Sidebar resize | Main column narrows/widens | Spacer width spring + column `layout` |
| List / Table | Centered `max-w-7xl` | No shell coupling |

### Visual contract (board view)

- Remove `max-w-7xl` and `mx-auto` when `view === "board"`
- Padding: `px-5 sm:px-6 lg:px-8`; header `pt-6 pb-4`
- Board fills remaining height via flex chain (`min-h-0 flex-1`)
- Board shell: `rounded-card border border-border bg-paper`, full content width
- Columns: equal grid on `md+`; horizontal scroll below `md`

---

## Architecture

### New files

- `apps/web/lib/motion/shell-spring.ts` — shared spring + reduced-motion transition
- `apps/web/features/shell/sidebar-layout-context.tsx` — context exposing spacer metrics

### Modified files

- `apps/web/features/shell/app-shell.tsx` — `LayoutGroup`, motion spacer, provider
- `apps/web/features/tasks-product/tasks-product-view.tsx` — board full-bleed switch + `getTasksPageLayoutClass`
- `apps/web/features/tasks-product/task-board.tsx` — motion columns, height fill, DnD layout pause
- `apps/web/app/(workspace)/tasks/loading.tsx` — full-bleed skeleton

### Context shape

```ts
type SidebarLayoutContextValue = {
  preference: SidebarPreference
  spacerWidth: number
  isExpanded: boolean
}
```

### Motion

- Spring: stiffness ~380, damping ~36 (≈280ms sidebar enter feel)
- `prefers-reduced-motion`: `duration: 0`
- Pause column `layout` during active DnD drag

---

## Testing

1. `/tasks` board — no side gutters at ≥1280px; columns stretch evenly
2. Toggle sidebar (⌘\) — spacer + columns animate together
3. Resize sidebar — board reflows live
4. Peek sidebar — board width unchanged
5. List/Table — centered `max-w-7xl`
6. Mobile — full width; drawer unchanged
7. Active card drag — no layout jank
8. `prefers-reduced-motion` — instant layout
9. `cd apps/web && npx tsc --noEmit`

---

*Design v1.0 · July 19, 2026 · Approved in plan*
