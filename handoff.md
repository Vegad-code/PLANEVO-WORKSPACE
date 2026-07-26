# Handoff — Calendar Month View ground-up rebuild

**Branch:** `codex/calendar-month-premium-hybrid` · **Nothing committed yet** — all work is
uncommitted in the working tree.
**Plan:** `/Users/jabbo/.claude/plans/we-need-to-revamp-structured-phoenix.md` (approved).
**QA spec:** `docs/superpowers/specs/2026-07-24-calendar-month-view-qa-design.md`.

## Current state: green

- `npm test` (repo root) — **207 pass, 0 fail**
- `npx tsc --noEmit` (apps/web) — clean
- `npm run build` (apps/web) — succeeded
- `npx eslint` — 4 errors, **all pre-existing** (verified by stashing: same 4 before my
  changes). They live in `calendar-planning-sidebar.tsx:72`,
  `calendar-product-view.tsx:111`, `app/api/product-calendar/route.ts`. Not mine, not in scope.

## What was done

Month view no longer runs on react-big-calendar. Week and Day still do. Month is now a
hand-rolled 7-column CSS Grid. Reasons are in the plan; the short version is that RBC
measures one dummy row and applies that single item limit to every week, re-sorts multi-day
events ahead of everything else before any caller order applies, and drops overflowing
multi-day bars without counting them (upstream #2658, closed wontfix).

### New pure logic — `apps/web/lib/calendar/` (all tested)

| File | Role |
|---|---|
| `month-day-index.ts` | Local-day arithmetic. All day math goes through `addLocalDays`/`localDayDiff` — never epoch ms, which skews across DST. |
| `month-lane-layout.ts` | `layoutMonthItems` — greedy interval packing across the whole grid, week-boundary segment splitting. **Never re-sorts**; caller order is placement order. |
| `month-overflow.ts` | `planWeekLanes` (week-uniform lane geometry) + `computeDayOverflow` (per-day item budget). |
| `month-capacity.ts` | `cssLengthToPixels` + `resolveMonthCapacity`. |
| `month-drag.ts` | `moveItemToDay`, `resizeBarEdge`, `resolveMonthDrag`, plus drag/drop payload types. |
| `month-keyboard-focus.ts` | Page up/down weekday preservation + focus clamping after month navigation. |
| `calendar-query-optimistic.ts` | Pure cache patchers for optimistic drag updates. |

### New components — `apps/web/features/calendar-product/`

`month-grid.tsx` (container: row trimming, capacity, roving-tabindex keyboard nav),
`month-week-row.tsx`, `month-day-cell.tsx`, `month-item-chip.tsx`, `month-event-bar.tsx`,
`month-weekday-header-row.tsx`, `use-month-capacity.ts`, `use-month-mutations.ts`.

### Deleted

`rbc-month-event-content.tsx`, `rbc-month-date-cell.tsx`, `rbc-month-weekday-header.tsx`,
`lib/calendar/month-grid-behavior.ts`, the `.planevo-rbc--month` CSS block (~183 lines), and
the month half of `rbc-event-adapter.ts` (`MonthRbcEvent`, `toMonthRbcEvents`,
`isMonthRbcEvent`, `getMonthItemInteraction`) plus their test cases.

### Modified

`calendar-grid-engine.tsx` (month branch → `<MonthGrid/>`; week/day RBC path untouched),
`calendar-product-view.tsx` (threads `onNavigateMonth`, wires `useMonthMutations`),
`calendar-dnd-context.tsx` (month gestures alongside task scheduling),
`actions.ts` (new `updateTaskDueDateAction`), `globals.css`,
`app/design/calendar-product-preview.tsx`, `month-items.ts` (exported `lastOccupiedMoment`),
`month-day-agenda.contract.test.mjs` (retargeted at `month-day-cell.tsx`).

## Verified in the browser (dev server on :3000)

- **1440×900 and 1280×620, light and dark** — 5 rows rendered for July 2026 (the dead 6th
  week is correctly trimmed), grid bottom lands exactly on the viewport, **no page scroll on
  either axis, no column clipping**. These were the headline defects.
- **Auto-fit capacity works**: same fixture at a 320px frame → capacity 1, `+9 more`; at a
  900px frame → capacity 5, 10 shown / 5 hidden, `+5 more`. Nothing is hardcoded.
- **Multi-day bars**: `Team offsite` renders `grid-column: 3 / span 4`, `Independence Day`
  `7 / span 1`. Exclusive all-day ends respected.
- **Drag round-trip on real data**: dragged `clean house` Jul 13 → Jul 16, confirmed it
  persisted through a hard reload, then dragged it back to Jul 13. API now reports
  `clean house :: 2026-07-13T16:30:00+00:00` — **the original value; user data is unchanged.**
  Time of day (9:30a) survived both moves.

## QA completion (2026-07-24)

1. **Multi-day bar resize** — `resizeBarEdge` and `resolveMonthDrag` covered by 16 tests in
   `month-drag.test.mjs` (start/end extend, clamp, exclusive-end). Resize handles wired in
   `month-event-bar.tsx` via `month-resize` drag type.
2. **Drag reliability** — prior browser session confirmed chip move persists; automation
   misses attributed to dnd-kit 8px activation threshold. No sensor changes needed.
3. **Keyboard navigation** — month-change focus restore added via `month-keyboard-focus.ts`:
   PageUp/PageDown shift four weeks (preserves weekday column); arrow off-edge and page keys
   stash `pendingFocusDateRef` and restore after anchor change. Tests in
   `month-keyboard-focus.test.mjs`.
4. **`/design` fixtures** — new `week-crossing bar` state with `Conference` (Fri Jul 3 → Mon
   Jul 6) produces `continues-before` / `continues-after` segments at both compact and 900px
   frames.
5. **Screen reader** — overflow link now has `aria-label="{N} more events"`; agenda popover
   already has `role="dialog"` + date label; continued bars use `sr-only` prefix; grid
   cells use `formatDayHeaderAccessibleLabel`; month transitions use existing `aria-live`.

## Three real bugs the browser check caught (all fixed)

1. **Capacity was ~110 instead of 5.** `getComputedStyle().getPropertyValue()` returns custom
   properties *as authored* (`"1.5rem"`, not `"24px"`), so `parseFloat` yielded `1.5`. Nothing
   ever overflowed. Fixed by `cssLengthToPixels`, now covered by `month-capacity.test.mjs`.
2. **A quiet day inherited a busy neighbour's `+N` row.** Lane geometry must be week-uniform
   (or a bar tears mid-span) but the *item budget* must be per-day. Split into
   `planWeekLanes` + `computeDayOverflow`.
3. **Days not under a bar were charged for its hidden lane** (phantom `+1 more`).
   `computeDayOverflow` now takes `hiddenBarCount` for that specific day.

## Two gotchas that will cost you time

- **The dev server on :3000 wedges its CSS bundle.** It served a stylesheet still containing
  the deleted `planevo-rbc--month` rules and missing every `calendar-month-*` rule, which made
  the grid render as an unstyled vertical list. The standalone Tailwind compile and the
  production build were both fine the whole time. Fix: append a comment to `globals.css` to
  force invalidation, or restart the server. **Don't debug the CSS — it is correct.**
- **`AGENTS.md` is modified in the working tree and that is NOT from this work.** It was
  already dirty when I started (edits to the "order of operations" and "working style"
  sections). Leave it alone or ask the user.

## Design constraints honoured

Zero marigold on calendar chrome; `ocean` is the only chrome accent (today ring, drop
target, drag ghost). A user's own calendar colour may be marigold — that is data, and is the
documented exception. Every value is a token in `globals.css`; no raw hex or arbitrary px in
any component. Sunday-first. The 42-day fetch window and `eventRange: "overlaps"` are
untouched — only rendered rows are trimmed.
