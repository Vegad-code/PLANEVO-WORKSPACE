# Calendar Grid Rebuild Design

**Date:** 2026-07-24  
**Status:** Approved for implementation (plan execute)  
**Authority:** Founder GCal constraint + Grok scrape synthesis (`.claude/plan/calendar-grid-engine-scrape.md`) + `AGENTS.md` + Planning sidebar spec

## Summary

Replace the blank calendar main panel with a **Google Calendar-like week/day time grid** powered by **FullCalendar MIT** (`@fullcalendar/react` + timegrid + interaction). Keep the existing Planning rail, Planevo toolbar, event peek, create popover, year view, and `@dnd-kit` task scheduling.

## Engine choice

| Option | Verdict |
|--------|---------|
| FullCalendar MIT | **Adopt** — highest GCal fidelity (8.0 weighted) |
| react-big-calendar | Reject for V1 grid — already installed but lower GCal score; dual HTML5 DnD |
| Schedule-X | Reject — drag/resize Premium in v4 |
| Nextcloud Calendar | Patterns only (AGPL) — validated FC as production choice |

## Layout (unchanged shell)

```
app-shell
└── /calendar
    ┌─────────────────────┬──────────────────────────────┐
    │ Planning rail       │ Toolbar + FullCalendar grid  │
    │  Date / Tasks / Cal │ Day | Week | Year            │
    └─────────────────────┴──────────────────────────────┘
```

- Engine owns Day + Week views only.
- Year stays Planevo `YearView`.
- `headerToolbar: false` on FC — Planevo toolbar drives date/view.

## Data flow

1. RSC `loadCalendarPageData` → `calendars`, `events`, `taskDues`, `todayTasks`.
2. Adapter maps `CalendarEventRow` → FC `EventInput` (filter by `is_visible`).
3. FC callbacks → existing server actions:
   - `select` / `dateClick` → create popover
   - `eventClick` → EventPeek
   - `eventDrop` / `eventResize` → `updateEventTimesAction`
   - External task drop → `scheduleTaskFromDragAction`

## GCal behaviors (V1)

- Sunday-start week (`firstDay: 0`) — matches `calendar-range.ts`
- 24h axis, scroll to ~now on mount
- All-day row for `all_day` events
- Current-time indicator
- Drag-move + resize timed events
- Click / drag-select empty → create
- Click event → peek
- Task from Planning → grid schedules 1h block

## Craft / tokens

- Map `--fc-*` to Planevo CSS variables in `globals.css`
- Zero marigold on calendar chrome (user calendar color swatches OK)
- Custom `eventContent`: title + time + left color bar from calendar tint
- No FC default purple/blue, no gradients, no heavy shadows

## DnD ownership

- **In-grid event move/resize:** FullCalendar interaction
- **Planning task → grid:** keep `@dnd-kit` on task rows; bridge via droppable slot layer OR FC `ThirdPartyDraggable` so `scheduleTaskFromDragAction` still fires
- Single owner per gesture — do not run both engines for event move

## Out of scope

- FullCalendar Premium / resource timeline
- Month view in toolbar (range helper exists; stretch later)
- Copying Nextcloud AGPL source
- Removing `react-big-calendar` from package.json (follow-up cleanup)

## Verification

- `/calendar` week/day populated; now line; visibility toggles
- Task drag schedules; event drag/resize persists
- Peek + create popover work
- `/design` shows engine states
- Keyboard focus + 24px targets on interactive chrome we own
