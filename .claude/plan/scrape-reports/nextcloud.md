# Scrape Report: Nextcloud Calendar (patterns only)

**Agent:** Grok-NC (cursor-grok-4.5-high-fast)  
**Repo:** https://github.com/nextcloud/calendar.git  
**Date:** 2026-07-24  
**License constraint:** AGPL-3.0 — patterns/IA only, no source copy

## GCal fidelity score (1-10) + rationale

**6.5/10** grid mechanics; **~5/10** Google Calendar product feel.

CalDAV-first Vue groupware client. Grid closeness comes from FullCalendar timegrid + interaction, not Nextcloud chrome. Valuable lesson: engine choice + interaction contract.

## Dependencies (npm packages + peer deps + bundle estimate)

Pins FullCalendar **6.1.21**: core, daygrid, timegrid, list, multimonth, interaction, vue3. Premium resource-timeline for rooms. CalDAV via AGPL `@nextcloud/*` — **do not add to Planevo**.

If Planevo adopts FC: MIT `@fullcalendar/react` + timegrid + interaction (~90–150 KB gzip).

## Best components / modules to reuse (file paths in upstream repo)

Study only: `src/components/CalendarGrid.vue`, `src/fullcalendar/interaction/*`, eventSources, FreeBusy UX, UnscheduledTasksList + FC `Draggable`, `css/fullcalendar.scss`.

## View parity vs Google Calendar

timeGridWeek/Day, all-day, nowIndicator, eventDrop/Resize (`eventResizableFromStart: true`), select → create, external task drop → VTODO due.

## DnD architecture

FC Interaction for in-grid; `Draggable` + `eventReceive` for sidebar tasks; guards when editor open; ResizeObserver → `updateSize()`.

## Theming strategy (how to avoid default library chrome)

`headerToolbar: false`; map `--fc-*` to tokens; thick left accent; opaque overlap fills; own toolbar.

## React 19 + Next.js App Router notes ('use client', SSR pitfalls)

NC is Vue SPA — no App Router lessons. Planevo: client leaf + `@fullcalendar/react`, RSC data fetch.

## Planevo integration risks

AGPL contamination; FC Premium creep; CalDAV/VEVENT model ≠ Planevo ecosystem; Tasks-as-calendar-events conflicts with product separation.

## License + what we may legally reuse

Nextcloud app / `@nextcloud/*`: **AGPL — ideas only**. FullCalendar standard plugins: **MIT OK**. Premium: commercial.

## Recommendation: adopt whole engine | cherry-pick patterns only

**Cherry-pick patterns only from Nextcloud.** Optionally adopt MIT FullCalendar (what NC uses) as Planevo’s grid engine. Reimplement clean-room: all-day + task dues, select-to-create, free/busy “find a slot” (no premium timeline).
