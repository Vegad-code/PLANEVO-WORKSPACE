# Calendar Month View Design

**Date:** 2026-07-24  
**Status:** Approved — implemented (2026-07-24)  
**Authority:** `AGENTS.md`, `docs/design-build-sheet.md` Screen 8, Maximal soft craft spec (`2026-07-24-calendar-maximal-soft-craft-design.md`), community UX research (MPU, Google 2025 backlash, RBC/MUI GitHub issues)

## Summary

Ship a **native Month view** in the Planevo Calendar product using the existing **react-big-calendar** engine, skinned with Planevo tokens (24px shell, ocean today disc, pill event chips). Month sits between Week and Year in the view menu.

**Day click stays in month:** single click opens a **day agenda popover** (that day's events listed in place). **"Open day"** in the popover (or double-click the cell) navigates to Day view. This follows the stronger industry signal (Outlook side panel, Apple List mode, pre-2025 Google Schedule) and avoids the 2025 Google anti-pattern of hijacking month context on every tap.

## Amendments from research passes

| Finding | Action |
|---------|--------|
| Event query is **start-in-range only** (`product-calendar.ts`) — multi-day events starting before the month window are omitted | **V1 blocker:** overlap query when `view === 'month'` |
| `calendar-nav-motion.ts` has no month transition key | Add `month-YYYY-MM` key |
| `calendar-query-keys.test.mjs` lacks month | Add month key tests |
| RBC month a11y is weak | Planevo adds `aria-current`, keyboard grid nav, focus management on popover |
| Google 2025 day-tap → day view caused sustained backlash | Revise drill-down: popover first, explicit open for day view |
| Spanning bars vanish under overflow (RBC #2658, MUI #22735) | QA gate + optional continuation stub in hidden cells |

## Research synthesis

### Widespread likes

- Month as macro scanning lens (busy vs light weeks at a glance)
- Colored event chips with readable titles (not dots-only)
- Continuous multi-day spanning bars
- Strong today treatment
- "+N more" overflow with a trustworthy popover
- Click day to drill into detail view

### Widespread dislikes

- Events hidden behind overflow with no clear recovery path
- Multi-day bars that break mid-week when "+more" triggers (documented in RBC #2658, MUI X #22735)
- Dots-only month views (Fantastical criticism — users keep a second app for month)
- Per-day duplicate chips instead of one spanning bar
- Long titles breaking overflow popovers

### Common wishes (multiple sources)

| Wish | Sources | V1 |
|------|---------|-----|
| Reliable spanning bars | RBC, MUI, Bryntum, Play Store reviews | **Yes — QA gate** |
| Title chips + optional time prefix | GCal, Android widgets, KashCal | **Yes** |
| Trustworthy "+more" popover | FullCalendar, RBC, Nextcloud | **Yes** |
| Month → detail without leaving grid | Outlook side panel, Apple List, Google Schedule (pre-2025) | **Yes → popover** |
| Explicit open day view | YearView drill-down, power users | **Yes → "Open day" / dbl-click** |
| Configurable rows per cell (1–4) | KashCal, FullCalendar | Defer (fixed `dayMaxEvents`) |
| Density heatmap in month | Prisma Calendar, Calendar Plus | Defer |
| Week numbers | CalenGoo, Android widgets | Defer |
| Month drag-create / drag-move | GCal partial | Defer |

### Competitor gaps Planevo can answer calmly

- **Notion Calendar:** weaker mobile month parity, sync gaps — Planevo ships a real month grid on web first
- **Fantastical:** dots-only month — Planevo shows **titles in chips**
- **All engines:** multi-day + overflow bugs — Planevo tests this explicitly before ship

## Locked decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Engine | **react-big-calendar `month` view** | Week/day already on RBC; `calendar-range.ts` month window exists |
| View menu order | Day · Week · **Month** · Year | Macro between meso (week) and annual (year) |
| Day click | **Day agenda popover** (month stays visible) | Strongest multi-source signal; avoids Google 2025 trap |
| Open day view | **"Open day" in popover** or double-click cell | Explicit drill-down; `YearView` still jumps straight to day |
| Event click | **EventPeek** (unchanged) | Consistent with week/day |
| Today treatment | **Ocean filled disc** on date number in cell | Same craft as week headers; one accent |
| Accent rule | Ocean on today only; toolbar ink; **zero marigold** on chrome | `AGENTS.md` one-accent |
| Week start | Sunday (matches `calendar-range.ts`, GCal craft ref) | Already locked |
| Grid size | 6 weeks (42 days) incl. leading/trailing | Matches `calendarRange('month')` |
| Month DnD | **Out of V1** | Reduces risk; week/day retain move/resize |

## Visual language

### Tokens (reuse + month-scoped additions in `globals.css`)

| Token / class | Use |
|---------------|-----|
| `--radius-calendar-shell` | Panel clip |
| `--radius-calendar-event` | Event chips in month cells |
| `--size-calendar-today-disc` | Today date number circle |
| `--color-calendar-today-disc` | Ocean fill |
| `--text-calendar-month-date` | Smaller date number in month cells |
| `--size-calendar-month-row-min` | Even 6-row grid min height |
| `--size-calendar-month-event-row` | Single-line event bar height |
| `--spacing-calendar-month-cell-padding` | Cell inner padding |
| `.planevo-rbc--month` | Month-specific overrides (cell min-height, outside-month mute) |

No hardcoded hex in components.

### Month grid layout

```
┌──────────────────────────────────────────────────────────────┐
│  SUN    MON    TUE    WED    THU    FRI    SAT               │  ← weekday row (muted caps)
├────────┬────────┬────────┬────────┬────────┬────────┬────────┤
│   29   │   30   │    1   │    2   │    3   │    4   │    5   │
│        │        │ ▬ evt  │ ▬▬▬▬▬  │        │        │        │
│        │        │ +1 more│        │        │        │        │
├────────┴────────┴────────┴────────┴────────┴────────┴────────┤
│  … 5 more week rows …                                        │
└──────────────────────────────────────────────────────────────┘
```

- **Outside-month days:** muted date number; `May 1` / `Jun 1` labels on 1sts of any month
- **Today:** ocean disc behind date number only on today (not all cells), `aria-current="date"`
- **Weekday header:** weekday labels only (`SUN MON TUE…`) — no date numbers in header row (`RbcMonthWeekdayHeader`)
- **Event chips:** left color bar, single-line layout; timed events use compact time prefix (`9a`, `9:30a`, `12p`) via `formatCompactMonthTime`
- **Multi-day:** horizontal bars across cells (RBC month row layout)
- **Overflow:** "+N more" link; popover lists all events for that day with truncation

### Toolbar

- Title: `July 2026` (full month + year)
- Prev/Next: step one calendar month
- Today: jump to current month, scroll today into view if needed

## Components & wiring

```
calendar-product-view
├── CalendarToolbar          ← add Month to CALENDAR_VIEWS + nav labels
├── CalendarViewTransition
└── CalendarGridEngine       ← views={['month','week','day']}; month branch
    ├── RbcMonthWeekdayHeader ← weekday-only header row
    ├── RbcMonthDateCell     ← day number + today disc in cell
    ├── RbcMonthEventContent ← compact single-line month event bars
    ├── RbcDayHeader         ← week/day column headers (unchanged)
    ├── RbcEventContent      ← week/day timed events (unchanged)
    └── .planevo-rbc--month  ← globals.css month skin
```

| File | Change |
|------|--------|
| `apps/web/features/calendar-product/calendar-toolbar.tsx` | Add `month` to views + labels; prev/next aria-labels for month |
| `apps/web/features/calendar-product/use-calendar-navigation.ts` | `view` parser includes `month` |
| `apps/web/lib/calendar/calendar-navigation.ts` | `stepAnchor`, `formatToolbarTitle` for month |
| `apps/web/lib/calendar/calendar-nav-motion.ts` | `calendarTransitionKey` branch for month |
| `apps/web/features/calendar-product/calendar-grid-engine.tsx` | `views` includes `month`; `popup`; `onShowMore`; disable default drill-down |
| `apps/web/features/calendar-product/rbc-month-weekday-header.tsx` | **Create** — weekday-only month header |
| `apps/web/features/calendar-product/rbc-month-event-content.tsx` | **Create** — compact single-line month chips |
| `apps/web/features/calendar-product/rbc-month-date-cell.tsx` | **Create** — date number + today styling |
| `apps/web/features/calendar-product/month-day-agenda-popover.tsx` | **Create** — day event list + "Open day" CTA |
| `apps/web/app/globals.css` | `.planevo-rbc--month` rules |
| `packages/core/src/queries/product-calendar.ts` | Overlap query when range is month-sized (or flag) |
| `apps/web/lib/calendar/calendar-navigation.test.mjs` | Month step + title tests |
| `apps/web/lib/calendar/calendar-query-keys.test.mjs` | Month query key assertions |

`calendar-range.ts` — **no change** (month 42-day window already defined).

### Data layer (blocker)

Current loader filters `starts_at >= start AND starts_at < end`. Month view must also include events that **start before** the window but **end inside** it (multi-day / spanning).

```
Overlap rule: starts_at < range.end AND ends_at > range.start
```

Apply when loading month range (or always — overlap is correct for all views but week/day rarely need it). Add test in `product-calendar` or loader tests.

## Interactions

| Gesture | Result |
|---------|--------|
| Click day cell (empty or date number) | **Day agenda popover** — list events for that day; month grid stays |
| Click **"Open day"** in popover | `handleSelectDay` → Day view |
| Double-click day cell | Day view (power-user shortcut) |
| Click event chip | EventPeek |
| Click "+N more" | Same day agenda popover (or RBC `popup` styled to match) |
| Prev / Next | ±1 month on anchor |
| Today | Current month |
| View menu → Month | `switchView` keeps anchor date |
| Keyboard | Arrow keys move selected day; Enter opens popover; `T` today; PgUp/PgDn month |

## Accessibility

- Day cells: `aria-label` full date (e.g. "Friday, July 24, 2026")
- Today: `aria-current="date"`
- Overflow popover: focusable list, Escape closes, click-outside dismisses
- Contrast: ocean disc uses `--color-calendar-today-disc-foreground`

## QA gates (ship blockers)

1. Multi-day event spans a full week without vanishing when another day in that week has 4+ events; if bar hidden in a cell, continuation stub or popover still lists it
2. "+more" popover shows every event for that day; long titles ellipsis, no layout blowout
3. **Overlap query:** event starting last week of prior month and ending in current month renders in month grid
4. Outside-month days visually distinct; events on padding days inside loaded 42-day window render correctly
5. Month ↔ Week ↔ Day navigation preserves sensible anchor
6. Day click opens popover **without** changing `view=` URL; "Open day" does
7. Dark mode: chips and today disc pass contrast check
8. No marigold on calendar chrome
9. Title chips visible by default — not dots-only
10. Weekday header row shows labels only — no date numbers in header
11. Month date cells show `May 1` / `Jun 1` on 1sts; compact `9a Title` single-line bars

## Out of scope

- Month drag-create, drag-move, resize
- Density heatmap / activity shading
- Week number column
- All-day row in month (N/A)
- Planning rail changes
- Mobile-specific month gestures (follow responsive collapse only)
- Removing `react-big-calendar` dependency

## Verification

- `/calendar?view=month` renders 6-week grid with soft shell
- Today ocean disc visible in month and week views
- Click July 15 → day agenda popover; "Open day" → `/calendar?view=day&date=2026-07-15`
- Multi-day event from prior month visible in first week of grid
- Event peek + create popover still work from week/day
- `node --test apps/web/lib/calendar/calendar-navigation.test.mjs` passes

## Done when

Month view is selectable in the toolbar, reads as Planevo (not generic RBC), passes QA gates above, and matches the calm manual-first Calendar product — not a marketing page, not agent-first.
