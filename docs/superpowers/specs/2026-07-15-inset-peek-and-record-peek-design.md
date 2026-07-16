# Inset Sidebar Peek + Record Peek

**Date:** 2026-07-15  
**Status:** Implemented  
**Extends:** [2026-07-15-notion-sidebar-design.md](./2026-07-15-notion-sidebar-design.md)

## Goal

1. When the sidebar is hidden, show a Notion-style **three-line** control floating on the
   canvas; hover/click peeks an **inset card** (not full viewport height).
2. Opening a **database record** uses Notion-style **center** or **side** peek, driven by
   URL search params.

## Locked decisions

| Topic | Choice |
|---|---|
| Scope | Sidebar inset float **and** page/record peek |
| Record peek triggers | Database records only |
| Peek modes | Center + side, with in-peek mode switcher |
| Hamburger | Floating top-left of canvas (not TopBar) |
| URL | `/databases/[id]?p=[recordId]&peek=center\|side` |

## Sidebar inset peek (AFFiNE craft)

When `view === "peek"`:

- `top: 52px`, `bottom: 8px`, `left: 8px`
- `height: calc(100dvh - 60px)`
- `rounded-xl` + `border-border` (no glow shadows — Planevo flat rule)
- Pin locks open; leave / Esc dismisses
- `PREVENT_HOVER_MS` (500) after collapse blocks immediate re-hover

Floating `SidebarRevealButton` (`menu` icon) appears when preference is `hidden` and not
peeked. Click opens peek; hover also schedules peek.

## Record peek

- Parse/build helpers: `@planevo/core/state/record-peek-state`
- UI: `apps/web/features/database/record-peek.tsx`
- Wired from table / board / list / calendar via `onOpenRecord`
- Esc / backdrop closes; mode preference stored in `localStorage`
- Expand: optional “Open page” when database has `page_id`

## Out of scope

- Full Notion three-mode defaults per view type (gallery/calendar defaults)
- Peek for sidebar pages / Home recents / search
- Intercepting routes
