# Scrape Report: FullCalendar React

**Agent:** Grok-FC (cursor-grok-4.5-high-fast)  
**Repo:** https://github.com/fullcalendar/fullcalendar-react.git (+ fullcalendar ecosystem)  
**Date:** 2026-07-24

## GCal fidelity score (1-10) + rationale

**8/10** for week/day grid behavior; **5–6/10** including Google product chrome.

MIT `timeGridWeek` / `timeGridDay` is the closest production-proven open engine to Google Calendar’s timed grid: vertical time axis, multi-day columns, all-day row, now-indicator, overlap stacking, drag-move, duration resize, click/select empty slots, external drops via `eventReceive`. Nextcloud ships this in production. Gaps are product UX (quick-create, conference chips) — Planevo chrome.

## Dependencies (npm packages + peer deps + bundle estimate)

### v7 (current)
- `@fullcalendar/react@7` + peer `temporal-polyfill`
- Plugins as subpath: `@fullcalendar/react/timegrid`, `/interaction`, `/daygrid`
- Bundle planning: ~150–300 KB gzip all-in

### v6 (Nextcloud pin; safer known React path)
```
@fullcalendar/react @fullcalendar/core @fullcalendar/timegrid
@fullcalendar/daygrid @fullcalendar/interaction
```
- ~90–150 KB gzip for week/day stack
- React 17–19 peers

**Skip Premium** (`resource-timeline`, scheduler) — not needed for personal week/day.

## Best components / modules to reuse (file paths in upstream repo)

- `@fullcalendar/react` connector
- timegrid + interaction plugins
- `ThirdPartyDraggable` / `Draggable` for external drops
- `eventContent` for custom React event chrome
- Themes/CSS variables (`--fc-*`)

## View parity vs Google Calendar

| Capability | Support |
|---|---|
| Week / day | `timeGridWeek` / `timeGridDay` |
| All-day row | `allDaySlot: true` |
| Now indicator | `nowIndicator: true` |
| Overlap | `slotEventOverlap` |
| Drag-move / resize | `editable` + `eventDrop` / `eventResize` |
| Click empty | `dateClick` / `selectable` + `select` |
| External drop | `droppable` + `eventReceive` |
| Hide toolbar | `headerToolbar: false` |

## DnD architecture

In-grid: FC interaction owns move/resize. External: `Draggable` or `ThirdPartyDraggable` → `eventReceive`. Keep `info.revert()` on failed server actions. Prefer FC for event move; bridge @dnd-kit for Planning task drops via `ThirdPartyDraggable`.

## Theming strategy (how to avoid default library chrome)

`headerToolbar: false`; `eventContent` JSX; map `--fc-*` to Planevo tokens; no stock purple palettes; flat craft.

## React 19 + Next.js App Router notes ('use client', SSR pitfalls)

Client leaf required; RSC fetches → pass props; optional `dynamic(..., { ssr: false })`; CSS imported from client module; `ref.getApi()` for imperative nav.

## Planevo integration risks

Dual DnD; date-fns ↔ ISO conversion; design-system clash without hard theming; bundle size; Premium creep (avoid).

## License + what we may legally reuse

Standard plugins **MIT**. Premium commercial — do not need. Nextcloud app AGPL — patterns only.

## Recommendation: adopt whole engine | cherry-pick patterns only

**Adopt whole MIT engine** (`@fullcalendar/react` + timegrid + interaction). Keep Planevo Planning sidebar, toolbar, peek, year view. Theme aggressively. Bridge sidebar with `ThirdPartyDraggable` or FC `Draggable`.
