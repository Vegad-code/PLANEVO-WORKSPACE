# Scrape Report: react-big-calendar

**Agent:** Grok-RBC (cursor-grok-4.5-high-fast)  
**Repo:** https://github.com/bigcalendar/react-big-calendar.git  
**Date:** 2026-07-24

## GCal fidelity score (1-10) + rationale

**7/10** for week/day mechanics; **~4/10** for Google Calendar product chrome out of the box.

`TimeGrid` + `DayColumn` + `TimeGutter` give a real timed week/day grid; all-day band; live current-time indicator; GCal-ish overlap stacking; slot click/drag-select; move/resize via `withDragAndDrop`. Gaps: default Bootstrap chrome; HTML5 DnD (not @dnd-kit); approximate stacking; no first-class create-popover or multi-calendar lanes.

## Dependencies (npm packages + peer deps + bundle estimate)

- **Direct (already in Planevo):** `react-big-calendar@^1.20.0`, `@types/react-big-calendar`, `date-fns@^4.4.0`
- **Peers:** `react` / `react-dom` ^16–^19
- **DnD addon:** bundled under `react-big-calendar/lib/addons/dragAndDrop` — no extra package
- **Bundle:** ~187 KB / ~53 KB gzip; ships moment/dayjs/luxon/globalize even if using date-fns
- **Localizer:** use `dateFnsLocalizer` only (never moment)

## Best components / modules to reuse (file paths in upstream repo)

- `src/Calendar.js`, `src/Week.js`, `src/Day.js`, `src/TimeGrid.js`, `src/DayColumn.js`
- `src/utils/layout-algorithms/overlap.js`, `src/utils/TimeSlots.js`
- `src/localizers/date-fns.js`
- `src/addons/dragAndDrop/withDragAndDrop.js`
- `src/sass/variables.scss` — theming

## View parity vs Google Calendar

| Capability | Support |
|---|---|
| Week / day time grid | Yes |
| All-day row | Yes |
| Current-time indicator | Yes (60s refresh) |
| Overlap stacking | Yes (`dayLayoutAlgorithm: 'overlap'`) |
| Drag-move / resize | Addon `onEventDrop` / `onEventResize` |
| Click empty slot | `selectable` + `onSelectSlot` |
| External drop | `onDropFromOutside` + `onDragOver` |

## DnD architecture

HOC `withDragAndDrop(Calendar)` — HTML5 / custom mouse tracking. Parallel to Planevo `@dnd-kit`. Bridge via `onDropFromOutside` or skip addon and keep @dnd-kit only.

## Theming strategy (how to avoid default library chrome)

`toolbar={false}`; import CSS once client-only; SASS variables or scoped `.planevo-rbc .rbc-*` overrides mapped to Planevo tokens; `components.event` + `eventPropGetter`.

## React 19 + Next.js App Router notes ('use client', SSR pitfalls)

`'use client'` leaf; controlled `date`/`view`; container must have height; optional `dynamic(..., { ssr: false })`.

## Planevo integration risks

Dual DnD; design-system collision; dependency weight (moment et al.); a11y weaker than custom; year view stays Planevo-owned.

## License + what we may legally reuse

**MIT** — may use/modify/distribute with copyright notice.

## Recommendation: adopt whole engine | cherry-pick patterns only

Adopt whole engine for week/day with `dateFnsLocalizer`, `toolbar={false}`, aggressive theming, bridge sidebar drops — **or** cherry-pick overlap algorithms if @dnd-kit must be sole DnD layer.
