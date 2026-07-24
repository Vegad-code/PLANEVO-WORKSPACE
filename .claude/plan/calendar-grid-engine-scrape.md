# Calendar Grid Engine Scrape — Synthesis

**Date:** 2026-07-24  
**Mode:** Research complete → Execute  
**Authority:** Founder GCal constraint + Grok scrape reports in `.claude/plan/scrape-reports/`

## GCal Fidelity Matrix

Scores 1–10 from Grok agents, weighted per plan.

| Criterion (weight) | RBC | FullCalendar | Schedule-X | Nextcloud (patterns) |
|--------------------|-----|--------------|------------|----------------------|
| Week time grid (30%) | 8 | **9** | 8 | 8 (via FC) |
| All-day row (15%) | 8 | **9** | 8 | 8 |
| Event drag/resize (20%) | 8 | **9** | 3 (Premium) | 9 (via FC) |
| Theming to tokens (15%) | 6 | **7** | 6 | 7 |
| @dnd-kit task-drop bridge (10%) | 5 | **8** | 4 | 8 (FC Draggable) |
| Already in repo / migration (10%) | **10** | 3 | 3 | 0 |
| **Weighted total** | **7.6** | **8.0** | **5.7** | n/a (not an engine) |

## Engine decision: FullCalendar (MIT v6 stack)

**Winner: `@fullcalendar/react` + `@fullcalendar/timegrid` + `@fullcalendar/interaction` (+ daygrid for all-day month cells as needed).**

### Why FullCalendar over RBC

1. **Founder constraint:** pick what is most like Google Calendar — FC scores highest on week/day grid, overlap, now-indicator, select-to-create, resize-from-start.
2. **Nextcloud production validation** (patterns only): ships FC timegrid + interaction for the same GCal-class surface.
3. **External drops:** first-class `eventReceive` + `ThirdPartyDraggable` / `Draggable` bridges Planning `@dnd-kit` better than RBC HTML5 `onDropFromOutside`.
4. **MIT, no Premium** for personal week/day.

### Why not Schedule-X

Drag/resize paywalled in v4; Temporal + Preact dual runtime fights date-fns stack.

### Why not RBC despite already installed

Within ~0.4 weighted points, but founder GCal priority outweighs “already in package.json.” RBC stays unused; can remove in a follow-up cleanup.

### Why not Nextcloud code

AGPL — ideas only. Confirms FC as the right engine.

## Implementation stack (Execute)

```bash
npm install @fullcalendar/react @fullcalendar/core @fullcalendar/timegrid @fullcalendar/daygrid @fullcalendar/interaction --workspace=apps/web
```

Use **v6** packages (separate plugins, React 19 peers, known Nextcloud pin family) rather than v7 Temporal-first API — lower impedance with Planevo `date-fns` + ISO strings.

### Files

| File | Action |
|------|--------|
| `apps/web/lib/calendar/calendar-event-adapter.ts` | Create — `CalendarEventRow` ↔ FC EventInput |
| `apps/web/features/calendar-product/calendar-grid-engine.tsx` | Create — FC client wrapper |
| `apps/web/features/calendar-product/calendar-product-view.tsx` | Mount engine; restore peek/create |
| `apps/web/features/calendar-product/calendar-dnd-context.tsx` | Bridge task drops (ThirdPartyDraggable or slot overlay) |
| `apps/web/app/globals.css` | `--fc-*` → Planevo tokens |
| `apps/web/app/design/calendar-product-preview.tsx` | Show engine in kitchen sink |

### SESSION_ID

- Grok agents used Cursor Task (no codeagent-wrapper) — no CODEX/GEMINI sessions.
- Reports: `.claude/plan/scrape-reports/{rbc,fullcalendar,schedule-x,nextcloud}.md`
