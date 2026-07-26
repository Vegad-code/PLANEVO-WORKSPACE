# Calendar Trajectory — where this has been and where it's going

**Living status document.** Update the status markers as work lands.
**Last updated:** 2026-07-25
**Branch:** `codex/calendar-month-premium-hybrid`

---

## The arc in one page

| Stage | What happened | Status |
|---|---|---|
| 1. Audit | Full-stack audit of the calendar — frontend, backend, data, Tasks integration | ✅ Done → `calendar-audit-2026-07-25.md` |
| 2. Research | View-engine architecture + aesthetic direction, 5 parallel research agents | ✅ Done → `calendar-view-engine-and-aesthetic-2026-07-25.md` |
| 3. Foundation slice | Dead-code removal, `calendar_views` schema, renderer registry | ✅ Code written · ⏳ **migration not yet applied** |
| 4. Floors | Timezone, recurrence, task round-trip, undo, sync, reminders | ⬜ Next → `calendar-engine-build-spec.md` |
| 5. Engine | Timeline renderer, view management UI, Workspace embed | ⬜ After floors |
| 6. Aesthetic | Two-layer tokens, Japandi palette, motion system | ⬜ Last |

---

## Stage 1 — What the audit found

Three structural problems, all still open:

1. **The data model isn't a calendar yet.** No recurrence, no reminders, no attendees, and no timezone binding — events are bare `timestamptz`, so an event authored as "9am" drifts across DST and travel. `google_event_id` and `source` exist as inert placeholder columns with zero read/write paths.

2. **The Tasks integration is real in the database and cosmetic in the product.** `schedule_task_idempotent` writes `calendar_events.task_id` correctly, and nothing in the UI ever reads it back. Move the block → the task's due date goes stale. Complete the task → the block still looks live. Delete the task → the event survives as an orphan.

3. **Dead code with a live consequence.** A complete pre-RBC engine nothing rendered, still exporting a type the live drag path imported, with an unreachable drop branch. *(Resolved in stage 3.)*

Clean and worth preserving: RLS coverage, zero `security definer`, index coverage matching real query shapes, zod on every server action, idempotent writes via `operation_key`, token discipline, Month-grid accessibility.

## Stage 2 — What the research settled

- **Nothing on the market does pluggable view paradigms.** Every library hardcodes one family. FullCalendar has real view registration but its premium tier is AGPL-or-pay. **Build headless; buy nothing.**
- **All 14 competitor views collapse into 8 config axes.** Presets became a schema instead of five hand-built UIs. This is the load-bearing result.
- **View is a saved object, not a property of a calendar.** A planner view spans several calendars; the Workspace embed stores a view id.
- **There is no "main" calendar.** One event pool per user; calendars are labels. Availability reads the pool, never the view's filtered subset.
- **License gate:** Cal.com, Nextcloud, Radicale, Baïkal, EteSync, Etar, Fossify are GPL/AGPL — readable, **not copyable**. Schedule-X (MIT) is the only safe source.
- **Palette:** Dark Wood `#685C54` (≈6.5:1) and Dusty Sky `#616F84` (≈5.1:1) pass AA. **Wood `#917E71` (≈3.9:1) fails** and must never become a text token.

## Stage 3 — What is actually built right now

**Deleted**
- `apps/web/features/calendar-product/week-grid.tsx`
- `apps/web/features/calendar-product/event-block.tsx`
- `CalendarNowIndicatorInline` from `calendar-now-indicator.tsx`

**Added**
- `supabase/migrations/20260725120000_calendar_views_and_defaults.sql` — `calendars.is_default` (partial unique index, backfilled to oldest so nothing moves), `calendar_views` table + RLS + grants, `schedule_task_idempotent` reordered to prefer the default calendar
- `apps/web/lib/calendar/view-config.ts` — 8 axes as zod, presets Classic/Planner/Flow, `resolveViewConfig` (partial override merge, degrades to Classic on bad input)
- `apps/web/lib/calendar/view-registry.ts` — layout → renderer descriptor, unbuilt layouts resolve to fallback
- `apps/web/lib/calendar/view-config.test.mjs` — 5 tests
- `CalendarViewRow` + `CalendarRow.is_default` in `packages/core/src/types/calendar.ts`

**Edited**
- `calendar-dnd-context.tsx` — unreachable slot branch removed
- `calendar-grid-engine.tsx` — renderer now resolved through the registry
- `app/design/calendar-product-preview.tsx` — fixtures updated for `is_default`
- `lib/calendar/slot-from-point.ts` — stale comment corrected

**Verification state:** `tsc --noEmit` clean · 173/174 calendar tests pass · not browser-verified.

### ⚠️ Two things that are true right now and will bite

1. **The migration has not been applied.** Repo convention is the hosted Supabase SQL Editor, not `supabase db push`. Until someone runs `20260725120000_calendar_views_and_defaults.sql`, `calendars.is_default` and `calendar_views` do not exist in the database, even though the TypeScript types say they do.
2. **`lib/calendar/format-now-indicator-time.test.mjs` fails, and it is not related to any of this work.** Both that test and its source are untracked files from an earlier session. It is an ICU spacing difference (`'11 :10 AM'` vs `'11 : 10 AM'`). **Do not chase it as a regression.**

---

## Stage 4+ — The road ahead

Build order and reasoning live in `calendar-view-engine-and-aesthetic-2026-07-25.md` §7.3. Implementation detail lives in `calendar-engine-build-spec.md`.

```
✅ Phase 0   dead engine removed
✅ slice     calendar_views + registry        ← code done, migration pending
⬜ WO-1      timezone + recurrence + soft delete migration
⬜ WO-2      recurrence expansion + UI
⬜ WO-3      task round-trip
⬜ WO-4      undo
⬜ WO-5      view CRUD + management UI
⬜ WO-6      timeline renderer (unlocks Planner + Flow)
⬜ WO-7      Workspace embed block
⬜ WO-8      ICS subscribe → Google read sync
⬜ WO-9      reminders
⬜ later     aesthetic system, mobile, virtualization
```

**Two hard ordering constraints:**
- Recurrence (WO-1/WO-2) must precede the timeline renderer (WO-6), or the renderer gets built twice.
- The timezone migration is cheapest now and gets strictly harder with every row.

---

## Decision log

**Settled**
- View is a saved object (`calendar_views`), not a calendar property
- No master calendar — one event pool, calendars are labels
- Availability reads the whole pool, not the view's sources
- Headless engine; `rrule` for recurrence, Luxon for timezones, keep dnd-kit
- react-big-calendar stays as the "Classic" renderer for now
- Presets-first UX; the 8 axes live behind a "customize" affordance
- Floors before engine, with the registry slice running in parallel

**Open**
- Recurrence in V1? (F-04 defers it; the market treats it as table stakes)
- Reminders scope — browser Notification API only, or real push?
- Attendees — in or out for the year?
- Theme library — curated palettes only, or user-defined hex?
- **Is there an external deadline?** The only thing that would justify inverting the build order.
