# Calendar Planning Sidebar Design

**Date:** 2026-07-23  
**Status:** Approved for implementation  
**Authority:** Founder brainstorming (accordion stack + Files Library parity) + `AGENTS.md`

## Summary

Calendar moves from a **three-pane** product layout (calendars sidebar · Today column · week grid) to a **two-pane** layout: a single collapsible, resizable **Planning** rail plus the main calendar panel.

This is a founder override of the Phase 3 three-pane ASCII in `docs/superpowers/specs/2026-07-19-phase-3-calendar-files-design.md`. Today/to-do and multi-calendar controls remain product features; they live inside one rail instead of two glass columns.

## Layout

```
app-shell (unchanged)
└── /calendar
    ┌─────────────────────┬──────────────────────────────┐
    │ Planning rail       │ Toolbar + Day/Week/Year grid │
    │  Date (accordion)   │                              │
    │  Tasks (accordion)  │                              │
    │  Calendars (acc.)   │                              │
    └─────────────────────┴──────────────────────────────┘
```

- **Desktop (`lg+`):** Planning rail left; grid right.
- **Below `lg`:** Full-width grid; Planning opens as a right-edge drawer.

## Planning rail (Files Library parity)

| Behavior | Detail |
|----------|--------|
| Title | **Planning** |
| Collapse | Header `PanelLeft` + click resize edge without drag |
| Reveal | `PanelLeft` in main panel header when collapsed |
| Resize | Drag right edge; width persisted in `localStorage` |
| Width | Default 320px; clamp 260–420 |
| Storage key | `planevo:calendar:planning-width` |

## Accordion sections

1. **Date** — Mini-month picker (Mon-start leading blanks). Selecting a day drives the grid day view.
2. **Tasks** — Segmented **To-do list** / **Events**; buckets This week / This month / Unscheduled; drag tasks onto the grid to schedule.
3. **Calendars** — Visibility checkboxes + New calendar form.

Section open/closed state persists under `planevo:calendar:planning-sections` (collapsed id set). Default: all open.

## Craft rules

- One rail surface with hairline dividers between accordion sections (not two stacked glass cards).
- Calendar semantic tokens only (`ink`, `paper`, `border`, `surface-raised`) — never `files-*` tokens.
- Zero marigold accent on Calendar chrome (user calendar color swatch `marigold` remains allowed).
- Tasks tab control uses pill segmented control (Files Library pattern), calendar tokens.

## Unchanged

- Server actions and data loaders
- Week/Day/Year grid, toolbar, event peek, create popover
- `@dnd-kit` bridge from task rows to grid slots
- App-shell global navigation

## Out of scope

- Search field in Planning rail
- Shared `ProductSecondaryRail` abstraction with Files
- Grid event-card craft polish (separate work)
