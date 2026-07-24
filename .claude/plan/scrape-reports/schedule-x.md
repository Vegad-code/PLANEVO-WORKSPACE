# Scrape Report: Schedule-X

**Agent:** Grok-SX (cursor-grok-4.5-high-fast)  
**Repo:** https://github.com/schedule-x/schedule-x.git  
**Date:** 2026-07-24

## GCal fidelity score (1-10) + rationale

**7/10** (display + create click) · **4–5/10** MIT-only v4 (no drag/resize).

Strong week/day time grid, all-day row, concurrency stacking, current-time. Gaps: Material chrome; **drag-move/resize are Premium in v4**; Temporal + Preact dual runtime.

## Dependencies (npm packages + peer deps + bundle estimate)

- `@schedule-x/react`, `@schedule-x/calendar`, theme, `temporal-polyfill`, `preact` + `@preact/signals`
- MIT plugins: events-service, current-time, scroll-controller, calendar-controls
- Premium: `@sx-premium/drag-and-drop`, resize (~€479/year or €999 lifetime)
- Bundle: MIT week/day ≈ 100–120 KB gzip

## Best components / modules to reuse (file paths in upstream repo)

- `packages/calendar/src/views/week/`, `components/week-grid/*`
- `utils/stateless/events/event-concurrency.ts`, `position-in-time-grid.ts`
- `grid-click-to-datetime.ts`
- Theme CSS variables `--sx-color-*`

## View parity vs Google Calendar

Week/day/all-day/now-line: yes OSS. Drag-move/resize: **Premium v4**. Click empty: OSS callbacks.

## DnD architecture

Plugin-oriented Preact handlers — not @dnd-kit. Paying for Premium or DIY on custom shells.

## Theming strategy (how to avoid default library chrome)

Override `--sx-color-*`; null out `headerContent`; inject custom `timeGridEvent` / `dateGridEvent`.

## React 19 + Next.js App Router notes ('use client', SSR pitfalls)

`useNextCalendarApp`; client island; `calendarApp` null until mount; portals into Preact DOM.

## Planevo integration risks

Temporal vs date-fns; DnD paywall vs existing @dnd-kit; Material collision; Preact+React; license cliff.

## License + what we may legally reuse

OSS packages **MIT**. `@sx-premium/*` commercial per project.

## Recommendation: adopt whole engine | cherry-pick patterns only

**Cherry-pick patterns only** — concurrency packing, time-grid composition, snap intervals. Do not adopt whole engine (Premium cliff + Temporal + Material).
