# Spotlight Pill Morph — Design Spec

**Date:** 2026-07-23  
**Status:** Approved for implementation  
**Authority:** `AGENTS.md`, `docs/design-brief.md`, founder reference (macOS Spotlight pill + product scope icons)

---

## Summary

Replace the current square Spotlight panel with a **macOS-style horizontal row**: glass search pill + four circular product scope buttons (Tasks, Calendar, Files, Workspace). A **single morphing glass shell** expands downward when the user types or has recents. Evolve the existing `CommandBar`; do not add a second search surface.

---

## Layout (founder-approved)

**Desktop:** `[ glass search pill (flex-1) ] [ Tasks ] [ Calendar ] [ Files ] [ Workspace ]` in one horizontal row.

**Mobile (`< md`):** Pill full-width; scope icons in a horizontal scroll-snap row below (touch targets ≥ 44px).

**Placement:** Centered horizontally, `pt-[min(20vh,160px)]` from viewport top.

---

## States

| State | Trigger | Chrome |
|-------|---------|--------|
| Open collapsed | Cmd+K, empty query, no recents | Pill shell only (`rounded-full`) |
| Open expanded | Query non-empty, recents exist, loading, or error | Shell morphs to `rounded-2xl`; results panel below search row |
| Closed | Escape or backdrop click | Unmount |

---

## Scope icons

| Icon | Scope key | Index kinds filtered |
|------|-----------|----------------------|
| Tasks | `tasks` | `task` |
| Calendar | `calendar` | `event` |
| Files | `files` | `file` |
| Workspace | `workspace` | `page`, `database`, `record` |

- Click **toggles** scope (multi-select; empty set = all products).
- Does **not** navigate on click alone.
- Persists in `sessionStorage` key `planevo:spotlight-scope`.
- Icons reuse `planevo-icon` names: `tasks`, `calendar`, `files`, `workspace`.
- Active state uses ink/paper elevation, **not** marigold (one accent per view law).

---

## Glass & motion

- **Implementation:** CSS token glass + Motion `layout` on one shell. No `liquid-glass-react`.
- **Classes:** `.spotlight-glass-shell`, `.spotlight-glass-icon` in `globals.css`.
- **Open:** opacity + scale(0.96→1) + y(-8→0), spring stiffness 380 / damping 32.
- **Expand:** `layout` on shell; `AnimatePresence` for results; row stagger 0.04s cap 0.12s.
- **`prefers-reduced-motion`:** instant transitions.
- **`prefers-reduced-transparency`:** solid-fill fallback, no backdrop-filter on shell.

---

## Keyboard & a11y

- Outer: `role="dialog"` `aria-modal="true"` `aria-label="Spotlight search"`.
- Input: `role="combobox"` `aria-controls` → results list id, `aria-expanded`.
- Scope buttons: `aria-pressed`, descriptive `aria-label`.
- Tab focus trap within overlay (existing behavior).
- Arrow keys: ↑/↓ results; scope icon group supports horizontal arrow roving when focused.

---

## Data flow

1. `fetchCommandIndex()` → entries cache (unchanged).
2. `filterEntriesByScope(entries, activeScopes)` before `buildCommandResults`.
3. Recents filtered by same scope rules.
4. Select row → `rememberCommandEntry` + navigate (unchanged).

---

## Files

| File | Role |
|------|------|
| `spotlight-chrome.tsx` | Pill row + morph shell + results slot |
| `spotlight-scope-icons.tsx` | Four circular scope buttons |
| `spotlight-scope.ts` | Filter + session persistence |
| `spotlight-overlay.tsx` | Backdrop portal only |
| `spotlight-search-field.tsx` | Pill-styled combobox input |
| `spotlight-results.tsx` | Grouped results inside shell |
| `command-bar.tsx` | Scope state wiring |
| `globals.css` | Glass tokens |
| `command-bar-preview.tsx` | `/design` states |

---

## Success criteria

- Cmd+K opens pill + four icon buttons (not square panel).
- Typing or recents morph one glass shell downward; no detached pieces.
- Scope icons filter results per product.
- Keyboard + screen reader path complete.
- `/design` shows collapsed, expanded, scoped states.
- Unit tests for scope filter matrix.

---

## Out of scope (V1)

- Server-side scoped API
- Scope icon navigation on click
- AI search beyond quick capture
- A/B test instrumentation (stubs optional)
