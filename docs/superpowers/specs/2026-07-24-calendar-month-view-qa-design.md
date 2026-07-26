# Calendar Month View — QA Completion Design

**Date:** 2026-07-24  
**Status:** Approved  
**Authority:** [handoff.md](../../handoff.md), phoenix rebuild plan (`we-need-to-revamp-structured-phoenix.md`)

## Summary

The hand-rolled month grid implementation is complete and green in CI. This spec defines the ship gates for the remaining QA tail before the branch merges.

## Ship gates

### 1. Multi-day bar resize (browser)

- Start and end resize handles on a multi-day bar change the visible `grid-column` span live during drag.
- After hard reload, start/end dates match the resized span.
- Exclusive all-day end semantics preserved (end at midnight day after last occupied day).
- Unit tests in `month-drag.test.mjs` cover edge clamping and exclusive-end writes.

### 2. Drag reliability (manual)

Five gestures must register reliably by hand on `/calendar?view=month`:

1. Single-day event chip move
2. Multi-day bar move from a middle segment (delta from origin cell)
3. Task due-date chip move
4. Resize start handle
5. Resize end handle

Pass threshold: ≥4/5 by hand. Automation misses below this threshold are acceptable if hand-drag passes.

Mutation failure must roll back optimistic state and show an error toast.

### 3. Keyboard navigation

| Key | Expected behavior |
|-----|-------------------|
| Tab | One `tabIndex=0` cell at a time; default is today if in month |
| Arrows | Move one cell; clamp within grid or cross month at edges |
| Arrow off edge | Previous/next month; focus lands on parallel weekday |
| Home / End | Row start / row end |
| PageUp / PageDown | ±1 month; same weekday column focused |
| Enter / Space | Open day agenda popover |
| Escape | Close agenda; focus returns to cell |
| Tab from cell | Chips inside focused cell are ordinary tab stops |

### 4. `/design` fixtures

At least one month state shows a week-crossing multi-day bar with continuation styling:

- `calendar-month-bar--continues-before` on the second-week segment
- `calendar-month-bar--continues-after` on the first-week segment
- Squared continuation edges per `globals.css`

Rendered at compact (`h-80`) and full height (`h-[900px]`), light and dark.

### 5. Screen reader

- Grid announced with month/year `aria-label`
- Each cell: full date via `formatDayHeaderAccessibleLabel`
- Today: `aria-current="date"`
- Overflow link: readable count (`aria-label` with event count)
- Continued bar segments: "Continued: {title}" via `sr-only`
- Month change: polite announcement via `calendar-view-transition.tsx` `aria-live`
- Agenda popover: focus moves into panel; `role="dialog"`; Escape dismisses

Resize handles remain `aria-hidden`; bars are reachable via the day agenda.

## Out of scope

- New month features (heatmaps, week numbers, drag-create)
- Week/day RBC changes
- Fixing pre-existing eslint errors in unrelated calendar files
- Editing `AGENTS.md` dirty working-tree changes

## Done when

All five ship gates pass, `npm test` / `tsc` / `build` are green, and handoff.md reflects completed verification.
