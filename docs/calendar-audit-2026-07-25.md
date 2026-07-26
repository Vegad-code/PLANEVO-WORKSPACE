# Calendar Audit & Implementation Plan

**Date:** 2026-07-25
**Branch audited:** `codex/calendar-month-premium-hybrid`
**Scope:** full-stack — frontend, backend, data model, Tasks↔Calendar integration — plus market/demand research.
**Status:** audit only. No code was changed.

---

## 0. Verdict in one paragraph

The calendar is a **beautifully-built display surface sitting on a data model that isn't a calendar yet.** The month grid is genuinely excellent craft — real `role="grid"` keyboard semantics, lane layout, capacity-aware overflow, disciplined token usage. But `calendar_events` has no recurrence, no reminders, no attendees, no timezone binding, and no working external sync. Those four absences are not "polish later" items; they are the reason a person cannot move their real life into this calendar. Separately, the Tasks integration is **real at the database layer and cosmetic at the product layer**: dragging a task onto the grid writes a `task_id`, and then nothing in the UI ever reads it back, so the task and its block drift apart permanently from that moment on. Fix those two things — the event model and the task round-trip — and everything else on this list is finish work.

---

## 1. Method and sourcing honesty

Five parallel audits: frontend, backend/data, Tasks↔Calendar integration, community demand research, competitor/short-form-social research.

**Research limitation, stated up front because it changes how much weight to give Part B:**

- **Reddit is not reachable** from this environment. `reddit.com` and `old.reddit.com` are crawler-blocked for both search indexing and direct fetch. Thirteen varied queries confirmed a hard block, not a query problem.
- **X/Twitter returned 402** (auth-walled) for every attempt.
- **TikTok and Instagram have no queryable API here.** TikTok discovery/tag pages were reachable as titles only — no view counts, no engagement data, no comment content.

What Part B actually rests on: Hacker News threads fetched directly, crawlable community forums (Samsung Community, Lemmy), App Store listings, official product/pricing pages, and review/comparison articles that explicitly paraphrase Reddit sentiment second-hand. Frequency labels ("very common" / "common" / "niche") reflect **repetition across available secondary sources, not a tally of actual posts**. Treat Part B as directional, not measured. If first-party Reddit/X evidence matters for a funding or roadmap decision, it needs an authenticated Reddit/X API path — worth doing before betting the roadmap on any single demand claim below.

---

# PART A — What we actually have

## A1. Frontend

### Views

| View | Engine | State |
|---|---|---|
| Month | Bespoke CSS Grid (`month-grid.tsx`) | Most complete surface in the product |
| Week | `react-big-calendar` + drag-drop HOC | Functional, weaker a11y |
| Day | `react-big-calendar` | Functional, weaker a11y |
| Year | `year-view.tsx` | Minimal — 12 mini-months, click-to-drill only, no density indicators |

The Month/RBC split is **deliberate and documented** (`calendar-grid-engine.tsx:118-126` explains RBC's month renderer couldn't be overridden enough). That is a defensible call, not accidental duplication.

### The actual duplication problem

`week-grid.tsx` (384 lines) plus `event-block.tsx` and `CalendarNowIndicatorInline` are a **complete, dead, pre-RBC time-grid engine**. Nothing renders them. But `calendar-dnd-context.tsx:21,96` still imports the `SlotDropData` type from the dead file, which makes it look load-bearing to anyone reading the code.

Worse, this dead file has a live consequence. `calendar-dnd-context.tsx:96-108` has a `useDroppable` slot-drop branch (`type: "slot"`) that **only the dead `week-grid.tsx` ever registered**. The live RBC grid never registers those droppable zones. So every real task→slot drop silently falls through to the pointer-geometry fallback at lines 102-108. One branch of the drop handler is unreachable code.

Also: the one hardcoded-value violation of the token rule in the whole calendar surface is in this dead file (`week-grid.tsx:336`, a raw `bg-[color-mix(...)]` arbitrary value). Outside it, token discipline is clean — no stray hex, no arbitrary px, consistent `var(--color-calendar-*)` / `var(--radius-calendar-*)` / `var(--spacing-calendar-*)`.

### Interaction inventory

**Present:** click-drag slot select, NLP quick capture, popover detail card, structured edit panel, drag-move, resize, all-day row, multi-day bars, `+N more` overflow with day agenda popover, shortcuts (`c`/`t`/`d`/`w`/`m`/`?`/`/`/Esc), month-grid arrow/Home/End/PageUp/PageDown navigation.

**Absent:**

| Missing | Impact |
|---|---|
| Recurrence (UI *and* data) — `parse-event-capture.ts:38,180-240` detects recurrence phrases only to say "not supported yet" | **High** |
| Reminders / notifications | **High** |
| Guests / attendees / RSVP | **High** |
| Undo — zero `undo` hits across the entire calendar surface; drag, resize and delete are immediate and irreversible | **High** |
| Per-event timezone picker | High |
| Free/busy "find a time" | Medium |
| Duplicate-on-modifier-drag | Low |
| Per-event color override (color lives only on `calendars.color`, 5-value enum) | Medium |

### Accessibility

Genuinely strong in Month: `role="grid"`, `aria-rowcount`/`aria-colcount`, roving tabindex, full keyboard model (`month-grid.tsx:200-211`), proper `gridcell` semantics on days (`month-day-cell.tsx:81-96`). Reduced-motion handled centrally.

**The gap is inconsistency.** Week/Day (RBC) has **no equivalent keyboard model** — a keyboard-only or screen-reader user can navigate Month fully and Week/Day not at all. Same product, two different accessibility tiers. Also `event-detail-popover.tsx:131-132` is `role="dialog" aria-modal="false"` (reasonable, matches GCal) but focus is never explicitly moved into the panel on open, so opening via keyboard may strand focus.

Month event bars are deliberately `tabIndex={-1}` with a comment routing keyboard users to the day agenda instead — a documented tradeoff, not an oversight.

### Performance

No `React.memo` anywhere in `features/calendar-product/*.tsx`. `calendar-product-view.tsx:150-152` ticks `now` every 60 seconds, re-rendering the whole tree including all 42 month cells. The *layout math* is correctly memoized (`month-grid.tsx:64-94`, `calendar-grid-engine.tsx:152-181`) so this is render cost, not compute cost — invisible today, will surface as minute-tick jank once days get busy.

No virtualization anywhere. Month has a per-day cap (`MAX_MONTH_ITEMS_PER_DAY`); Week/Day has no cap at all on RBC's event list.

### Mobile — the honest assessment

**The calendar has not been designed below 768px.** It doesn't crash; that's the extent of it.

- The only mobile media query in the entire calendar CSS (`globals.css:1413-1418`) resizes the agenda popover. Nothing else adapts.
- Month is `repeat(7, minmax(0, 1fr))` with no collapse — at 375px each column is ~50px carrying a date, chips, and a `+N more` button.
- Week renders all 7 columns on mobile with no horizontal scroll container, falling back to RBC's own unstyled layout.
- What *does* work: the planning sidebar collapses to a slide-over drawer below `lg`.

Given that Part B's short-form-social audience is overwhelmingly mobile-native, this is the single widest gap between what's built and who the research says wants it.

## A2. Backend and data model

### Schema as built

`calendar_events` (`20260718120000_ecosystem_product_tables.sql:51-67`):
`id, calendar_id, user_id, title, starts_at timestamptz, ends_at timestamptz, all_day, location text, description_json jsonb, task_id, google_event_id text, source text check(planevo|google), created_at, updated_at` — plus `operation_key uuid` for idempotent writes (`20260718160000_phase2_final_integrity.sql:7`).

`calendars`: `id, user_id, name, color, is_visible, position, created_at`. No per-calendar timezone.

### What is missing, and why each one matters

| Field / capability | State | Impact |
|---|---|---|
| **Recurrence (RRULE)** | Absent from schema and types entirely | **High** — every event is a one-off row. This is the #1 reason a real calendar can't be adopted. |
| **Recurrence exceptions** | Absent (no `parent_event_id` / `recurrence_id`) | **High** — blocks recurrence even being added incrementally later without a second migration. |
| **Reminders / notifications** | No table, no column, no cron, no queue, no sender | **High** |
| **Attendees / guests** | No table, no RSVP, no invite delivery | **High** |
| **Timezone binding** | Absent — bare `timestamptz`, no IANA zone on event or calendar | **High** — see below |
| **Conferencing link** | No column; would have to hide in `description_json` | Medium |
| **Per-event color** | Absent; color only on the parent calendar | Medium |
| **Soft delete** | Absent — `deleteCalendarEvent` hard-`DELETE`s (`product-calendar.ts:87-98`) | Medium — no trash, no undo path |
| **External sync** | `google_event_id` and `source` exist as **inert placeholder columns** — grep confirms no mutation, webhook, or query ever sets or reads them outside the `/design` mock preview | **High** |
| **Optimistic concurrency token** | Absent — two concurrent edits silently last-write-win | Low |

### The timezone problem, stated precisely

Events store an instant with no bound timezone. `calendar-timezone.ts:1-20` only formats the *current viewer's machine offset* for the gutter label — it does not attach a zone to the event.

Consequence: an event authored as "9am" is stored as whatever UTC instant 9am-local was **at creation time**, and rendered using the viewer's **current** offset. Cross a DST boundary, or travel, and the displayed time drifts from the authored intent. This is the single biggest structural defect in the data model, and it is invisible in testing until someone travels or October arrives.

### Server actions — the good news

Genuinely solid craft. Every mutation in `app/(workspace)/calendar/actions.ts` is `"use server"` with zod validation including cross-field `.refine()` (end > start), `requireMutationDataAccess()` on every action, ownership double-checked in app code on top of RLS, consistent `actionError()` wrapper with correlation IDs.

Issues:

- **No rate limiting** (`actions.ts`) — the Files product has a `check_rate_limit` RPC (`20260722120000_files_billing_and_ratelimit.sql:44`); Calendar has nothing. `createCalendarEventAction` and `quickAddTaskAction` can be hammered freely. **Medium.**
- **Unbounded task fetch** — `fetch-calendar-page-data.ts:67-75` → `product-tasks.ts:40-56` loads **every task the user owns**, with no date bound, on every calendar page load, purely to build the Today rail. Grows without ceiling. **Medium.**
- **Workspace-scope round trips** — `product-calendar.ts:56-67` calls `listWorkspaceResourceIds` twice sequentially, then two `.in(...)` queries: four round trips for one page load, with no `limit` on the id list. **Low/medium.**
- **Double-fetch** — every mutation calls `revalidatePath("/calendar")` *and* the client fires `invalidateCalendar`. Coarse but harmless. **Low.**

Events *are* range-bounded correctly (`loadCalendarWeek`, `product-calendar.ts:69-94`).

### Security — clean

RLS enabled on `calendars`, `calendar_events`, `workspace_links`, `file_links`, `tasks`, tightened further by the phase-2 migration's `calendar_events_both_endpoints` policy. Every calendar RPC is `security invoker`; a repo-wide grep for `security definer` returns **zero hits** — the house rule holds. Indexes match the real query shapes: `(calendar_id, starts_at)`, `(user_id, starts_at)`, `(workspace_id, resource_type)`. No missing-index gap found.

### Client cache

Query key is `[calendar, scope, view, startDate, endDate]` — correctly window-scoped. `staleTime: 60s`, `gcTime: 600s`.

Optimistic updates exist **only for month drag** (`use-month-mutations.ts:38-67`) with correct snapshot-and-rollback. Everything else — create, update, delete, task toggle, quick-add, week/day drag — is fire-and-invalidate. Self-documented as intentional. Reads as latency, not as a bug.

**No realtime.** Grep for `postgres_changes` / `channel(` / `realtime` across the calendar surface returns nothing. Two tabs, or a phone and a laptop, will not see each other's writes for up to 60 seconds. **Medium** — cross-device liveness is an unspoken expectation for anything called a calendar.

### Migrations

Three calendar-touching migrations, all committed: `20260718120000` (tables + RLS), `20260718160000` (operation_key, `schedule_task_idempotent`, `delete_task_cascade`, tightened RLS), `20260716100000` (legacy kernel range RPC, not on the product path). The only untracked migration in the tree is Files-related.

**Caveat:** per this repo's convention, migrations are applied via the hosted SQL Editor, not `supabase db push`. Git state therefore does **not** prove applied state. Verifying that requires checking the hosted project directly — not done in this read-only local audit.

## A3. Tasks × Calendar — where it breaks

### What's real today

- Month task-due chips (`month-items.ts:105-125`) with a working checkbox → `setTaskStatusAction`. Real.
- Day agenda popover renders the same, checkbox works. Real.
- Planning sidebar "Tasks" accordion buckets by `due_at` into This week / This month / Unscheduled, with per-bucket quick-add. Real — but it is a **due-date view, not a schedule view**. It has no relationship to what's actually time-blocked on the grid.
- Task-due chips are **Month-only** (`month-items.ts:127`). A task due today is **invisible on the Day and Week grids** unless someone separately scheduled it. Medium gap.

Nothing found is purely decorative — every visible affordance writes something real.

### The drag-to-schedule path, traced

`today-task-row.tsx:30-39` → `calendar-dnd-context.tsx:93-108` → `calendar-product-view.tsx:434-441` → `scheduleTaskFromDragAction` (`actions.ts:202-234`) → `scheduleTaskFromDrag` (`product-calendar.ts:154-172`, **hardcoded 1-hour duration**) → `scheduleTask` (`task-cross-links.ts:21-36`) → RPC `schedule_task_idempotent` (`20260718160000_phase2_final_integrity.sql:181-193`).

The RPC inserts a **new `calendar_events` row** on the user's *oldest* calendar (`order by created_at, id limit 1` — there is no real "default calendar" concept, just first-created), with `task_id` set. It does **not** touch `tasks.due_at` or `tasks.status`.

So dragging a task onto the grid does not schedule the task. It creates an independent event that happens to remember a task id. The original due-date chip stays exactly where it was, in its old bucket. Nothing reconciles the two.

### The four ways state silently diverges

1. **Move or resize the block** → `updateEventTimesAction` patches only `calendar_events.starts_at/ends_at`. `tasks.due_at` goes stale silently. **High.**
2. **Complete the task** → `updateTaskStatus` patches only `tasks.status/completed_at`. The linked event stays on the grid looking live and undone. **High.**
3. **Delete the task** → `delete_task_cascade` clears `file_links` and `workspace_links`, but `calendar_events.task_id` is `ON DELETE SET NULL` (`20260718120000_ecosystem_product_tables.sql:61`). The event **survives as an orphan**, frozen at its creation-time title, with no trace it was ever task-linked. **High.**
4. **Edit or complete the event** → nothing writes back to `tasks`, ever.

The delete-confirm dialog even says so out loud: "Linked tasks stay in Tasks" (`event-detail-panel.tsx:313`). The one-way link is known and shipped.

### Cross-links: plumbing built, UI never surfaces it

`workspace_links` genuinely works — `linkResourceToWorkspace` for `calendar_event`/`task`/`file`, and `listWorkspaceResourceIds` really does drive the "This workspace" scope filter. `EventCrossLinkDialogs` performs three real writes: attach file (`file_links`), link task (sets `calendar_events.task_id`), add to workspace (`workspace_links`).

**None of it is ever shown back.** `rbc-event-content.tsx` has zero references to `task_id` — no task badge, no attachment glyph, no link indicator on any event card. `event-detail-panel.tsx` opens the dialog to *add* a link but never displays existing ones. The dialog queries already-linked ids only to grey out options. A task link, once made, has **no unlink control and no display anywhere in the product**. **High** — this is the exact point where the integration stops being a feature and becomes a hidden database column.

### Capture friction, measured

| Action | Cost | Note |
|---|---|---|
| Quick-add a task (sidebar) | 1 field + Enter | Best flow in the codebase |
| Reschedule an event (week/day) | 1 gesture | Real, works |
| Schedule a task | 1 gesture | But fixed 1h, always lands on oldest calendar, no duration or calendar choice at drop |
| Create an event | Open + full form + save | Full structured form, not 1-click |
| Unschedule a task | **No path exists** | Only deleting the event, which by its own dialog copy doesn't touch the task |

One more structural seam: Month drag moves `due_at` (`month-drag.ts` → `updateTaskDueDateAction`), while Week/Day drag moves event times. **Two different mental models of "scheduling" under one UI**, depending on which view you happen to be in.

---

# PART B — What people want

## B1. Demand signals

Ranked by repetition across the sources that were reachable. Read with the Section 1 caveat.

1. **Natural-language quick add** — common. The feature people notice missing when they leave Fantastical or Google.
2. **Task + calendar unification / see tasks as time blocks** — very common. An entire product category (Motion, Sunsama, Akiflow, Reclaim) exists solely because Google and Apple don't do this.
3. **Keyboard-driven command bar** — common among power users; Akiflow's `Cmd+E` is its headline pitch, Vimcal's vim bindings are its entire wedge.
4. **Multi-account overlay** (Outlook + Google + iCloud in one view) — very common; the recurring Notion Calendar complaint is that it can't.
5. **Notifications that actually fire** — common and platform-level. Documented Samsung/Android 15 breakage with alerts delayed 8 minutes or silently not firing.
6. **"Show as busy" / hide details on shared calendars** — common in professional contexts.
7. **Self-hosted / CalDAV / privacy-respecting sync** — common in privacy-conscious circles (Radicale, Baïkal, EteSync).
8. **Time-blocking with visual now-line feedback** — niche but loud; explicitly ADHD-framed.
9. **A guided daily planning ritual, not a blank grid** — common among Sunsama's audience specifically, and cited as its core value even by people who balk at the price.
10. **AI auto-scheduling that respects deadlines** — common demand, held in direct tension with the anti-pattern below.
11. **Conferencing links auto-attached; scheduling links** — now table stakes, not a delighter.
12. **Mobile that isn't a downgrade** — common. Both Akiflow and Sunsama are criticized for weak or read-only mobile.
13. **Travel-time and buffer awareness; "fuzzy" non-fixed-time events** — niche, conceptually sharp, raised as a limitation of the event object itself.
14. **Timezone display that is useful rather than merely correct** — the cited example is a flight showing departure time converted to the destination timezone: technically right, practically useless.
15. **A free tier that lets you actually try it** — common, and tightly coupled to the pricing anger below.

## B2. What people hate

1. **Subscription pricing for what feels basic** — very common and the loudest signal in the set. Akiflow ($228–408/yr) and Sunsama (~$240–300/yr) are named repeatedly.
2. **Mobile apps worse than desktop** — common. "Basically a read-only companion" is the Sunsama critique.
3. **Notification unreliability** — common, and it destroys trust faster than any missing feature.
4. **Single-provider lock-in** — common. Notion Calendar syncs one Google account even on paid tiers.
5. **Stale interfaces** — "Google Calendar's mobile web app hasn't changed since 2010."
6. **Outages.**
7. **Data-first rather than utility-first decisions** — the timezone example above.
8. **Booking links that don't reflect real availability.**
9. **Learning curves that don't pay off fast** — Akiflow's own docs admit the first few days feel slower.
10. **No trial before a premium commitment.**

## B3. Short-form social (TikTok / IG / Shorts) — directional only

Sourcing caveat from Section 1 applies in full; this rests on secondary coverage and app-store listings.

- **Time blocking is a named ritual, not a feature.** Mainstream press covers it as a recurring TikTok trend: chunk the day, colour-code by category, build tomorrow's plan tonight.
- **Structured is the visible standard-bearer** for that audience — explicitly positioned as ADHD-friendly, built on a **vertical timeline rather than a grid**.
- **ADHD framing is explicit and repeated.** "Time blindness" is the operative phrase. A whole cluster of single-purpose apps (Latered, See Time, Timeful, DuePal) sells persistent lock-screen countdowns, ambient time-awareness nudges, and **start times rather than due dates** — clear evidence of demand general calendars don't serve.
- **Aesthetic density drives adoption.** "Day in my life" content packages a time-blocked schedule as identity content; per-category colour coding is the specific recurring pattern.
- **Widgets and lock-screen presence** function as always-on identity signals, not just utilities.
- **A named tension worth designing around:** commentary explicitly separates "productivity aesthetic" from productivity — the audience wants a tool that *visually signals discipline* as much as one that imposes it.

## B4. Competitive matrix

Verified from official product/pricing pages; "unverified" means not confirmed this session.

| App | NL add | Task/time-block | Multi-account | AI scheduling | Booking links | Mobile+widgets | Keyboard-first | Pricing (verified) |
|---|---|---|---|---|---|---|---|---|
| Google Calendar | Gemini-assisted | Tasks integration | Yes | Gemini | Booking pages + Stripe | Yes | No | Free / in Workspace |
| Apple Calendar | unverified | Reminders shown | Yes | unverified | unverified | Yes | Shortcuts | Free |
| Notion Calendar | unverified | Notion DB drag | Yes, auto-blocks busy | unverified | Yes | Yes, widgets | Command menu | Free |
| Fantastical | **Yes** | Integrated tasks | Google/M365/Exchange/iCloud/**CalDAV** | Email→event extraction | Yes ("Openings") | 14 widgets | unverified | Free + Premium |
| Amie | unverified | AI-prioritised | Google + Apple | Yes | unverified | Mac/Win/iOS | unverified | Pro/Business, price not shown |
| Motion | Via capture | Yes, AI-built | Outlook/Google/iCloud | **Yes** | Yes | Yes, offline | Shortcuts | $19–29/seat/mo |
| Sunsama | unverified | **Core timebox** | Google/Outlook/Apple | AI + MCP (Pro) | unverified | iOS/Android/desktop | unverified | $17–22/mo |
| Akiflow | **Yes** | Yes | 10+ integrations | "Aki" | unverified | iOS/Android | **Cmd+K** | $19–34/mo |
| Vimcal | Yes | Lists only, weak | Google + Outlook | Free Time Finder | Yes | Mobile + browser | **vim j/k/h/l** | $20/mo, $200/yr |
| Structured | unverified | **Vertical timeline** | Import (Pro) | "Plan with AI" | unverified | **Widgets + Watch** | unverified | ~$6.49/mo, ~$19.99/yr |
| TickTick | **Yes** | Tasks + Kanban + Eisenhower | Multi-device | unverified | unverified | Yes | Shortcuts | Free + Premium |
| Morgen | unverified | Notion/ClickUp/Linear/Todoist | Google/Outlook/Apple/Fastmail | AI Planner | Yes | All platforms | unverified | $15–30/mo |

### Table stakes (in nearly all of them)

Multi-account sync · colour-coded calendars · native mobile · task integration of some kind · free tier or trial · **recurring events** · **timezone handling** · conferencing detection.

**Planevo currently has: colour-coded calendars, a form of task integration. It is missing five of the eight.**

### Real differentiators in 2026

1. AI auto-scheduling that actually moves things (Motion, Akiflow, Morgen)
2. Booking/availability links (Fantastical, Motion, Vimcal, Morgen, Notion Cal)
3. Keyboard-first sub-100ms UX as a distinct wedge (Vimcal, Akiflow)
4. AI meeting notes folded into the calendar (Amie, Motion)
5. **ADHD-first vertical timeline as the core metaphor, not a mode** (Structured)
6. Pricing posture — consumer flat ($6–20/mo) vs. seat-based AI-work-OS ($19–34/seat/mo)

### Where the market is heading

Convergence on AI-planned time-blocking as the new baseline, and calendar-as-meeting-hub (notetaking bundled in). Pricing is bifurcating. The visible gap: general calendars have not built for the ADHD-specific, visually expressive, widget-native experience the short-form audience keeps asking for.

---

# PART C — Gap analysis

## C1. Against the product's own spec

`docs/planevo-feature-spec.md` F-04 already commits to: multiple calendars, week-at-a-glance, **task due dates auto-feeding the calendar**, **drag task → creates `calendar_events` row with `task_id`**, **Google read sync into `source = google` / `google_event_id`**, and V1 explicitly deferring recurrence.

Measured against its own spec:

| F-04 commitment | Built? |
|---|---|
| Multi-calendar with visibility toggles | ✅ |
| Week + today | ✅ (plus Month, Day, Year — ahead of spec) |
| Task due dates auto-feed via read query, not duplicated storage | ✅ correct, and correctly *not* copied |
| Drag task → event with `task_id` | ⚠️ Writes correctly, **never read back** |
| Google read sync | ❌ Columns exist; **zero implementation** |
| Recurring events (explicitly "Later") | ❌ As specified — but see below |

The spec's deferral of recurrence was a reasonable V1 call. Part B says the market treats it as table stakes. **This is the one place where the spec and the evidence disagree, and it needs a founder decision** (Section E).

## C2. Blocking gaps — a person cannot live in this calendar without these

1. **Recurrence.** No standing meeting, no weekly class, no gym schedule. Every real week contains repeating events.
2. **Reminders.** A calendar that cannot tell you about the thing is a record, not a calendar.
3. **Timezone binding.** Currently correct-looking and quietly wrong across DST and travel.
4. **External sync.** Nobody abandons an existing calendar. They overlay it first, then migrate. Without read sync there is no adoption ramp at all.
5. **Undo.** Drag, resize, and delete are all irreversible. This is a trust defect, not a convenience one.

## C3. Credibility gaps — usable, but it reads as unfinished

6. Task↔event round-trip (the four divergences in A3)
7. No task badge on event cards — the linked state is invisible
8. Mobile below 768px
9. Week/Day keyboard accessibility parity with Month
10. No realtime / cross-device liveness
11. No rate limiting on calendar mutations
12. Unbounded Today-rail task fetch
13. No soft delete / trash

## C4. Where Planevo could actually win

The research points at one opening more clearly than any other. The **ADHD / time-blindness / vertical-timeline** audience is loud, underserved by Google and Apple, currently served by single-purpose apps that do *only* that — and it maps almost exactly onto capabilities this codebase already has half-built (a now-indicator, a planning sidebar, task chips, capacity measurement).

It also sits naturally with the house rules: **manual-first** (the user blocks their own time; AI is additive), **present-not-pushy AI** (no auto-mover shuffling your day — which Part B shows people actively resent), and **signature law** (line-art scaffolding filling with the colour of a real life is *precisely* the "colour-coded day" aesthetic the short-form audience already performs voluntarily).

The differentiator is not another AI auto-scheduler. It is **the calm, manual, visually expressive time-blocking calendar that respects that you plan your own day** — with the task round-trip actually closed, which is the thing Motion and Sunsama charge $200–400/yr for and which this codebase is one honest refactor away from.

---

# PART D — Implementation plan

Ordered by *unblocks-the-most-next*, not by size. No code written yet; every item names its real target files.

## Phase 0 — Clear the ground (half a day)

| # | Task | Files |
|---|---|---|
| 0.1 | Delete the dead pre-RBC engine. Move `SlotDropData` to a live module first. | `week-grid.tsx`, `event-block.tsx`, `CalendarNowIndicatorInline` in `calendar-now-indicator.tsx:87-114`, importer at `calendar-dnd-context.tsx:21` |
| 0.2 | Delete the unreachable `type: "slot"` droppable branch — the geometry fallback is the only live path. | `calendar-dnd-context.tsx:96-108` |
| 0.3 | Confirm the token violation dies with 0.1. | `week-grid.tsx:336` |
| 0.4 | Verify applied state of the three calendar migrations against the **hosted** project. Git does not prove this. | Supabase SQL Editor |

Do this first. Every later change is safer once there is one time-grid engine and one drop path.

## Phase 1 — Make the data model a calendar (the big one)

One migration. Design it once, correctly, because retrofitting recurrence later is a rewrite.

| # | Task | Notes |
|---|---|---|
| 1.1 | **Timezone binding.** Add `timezone text` (IANA) to `calendar_events`, and a default on `calendars`. Store authored wall-clock intent alongside the instant. | Fixes the DST/travel drift silently present today. Do this even if recurrence is deferred — it gets strictly harder with more rows. |
| 1.2 | **Recurrence.** `rrule text` + `recurrence_end`, plus an exceptions story: `parent_event_id` + `recurrence_id` + `is_exception`. Expansion server-side in `product-calendar.ts` range loads. | Add the exception columns **now** even if the UI ships single-rule-only. Adding them later means migrating existing series. |
| 1.3 | **Soft delete.** `deleted_at`, filtered in every query path. | Prerequisite for undo (2.3) and for a trash view. |
| 1.4 | **Per-event colour override.** Nullable `color`, falling back to `calendars.color`. | Directly serves the colour-coded-day behaviour in B3. |
| 1.5 | **Conferencing.** `conference_url text`. | Cheap; table stakes per B4. |
| 1.6 | **Reminders.** `event_reminders (event_id, offset_minutes, method)` + delivery. Browser Notification API first; push/email later. | Schema and local delivery are a day. Reliable *push* is its own project — see risks. |

**Deliberately deferred:** attendees/RSVP. It requires identity, invite delivery, and free/busy — a project, not a field. Note it in the spec and move on.

## Phase 2 — Close the Tasks loop (the actual differentiator)

This is the highest product value per line of code in the whole plan.

| # | Task | Files |
|---|---|---|
| 2.1 | **Show the link.** Task badge on event cards, so a scheduled task is visibly a task. | `rbc-event-content.tsx`, `month-event-bar.tsx` |
| 2.2 | **Round-trip the four divergences:** moving the block updates `tasks.due_at`; completing either completes both (with the event styled done); deleting the task offers to delete or keep the block instead of silently orphaning it. | `product-calendar.ts`, `product-tasks.ts`, `task-cross-links.ts`, `delete_task_cascade` |
| 2.3 | **Undo.** Toast-with-undo on drag, resize, delete. Depends on 1.3. | `calendar-product-view.tsx`, mutation handlers |
| 2.4 | **Unschedule.** Drag a block off the grid → back to the backlog. There is no path today. | `calendar-dnd-context.tsx`, new action |
| 2.5 | **Task duration.** Stop hardcoding 60 minutes; honour a task's estimate, and allow duration choice at drop. | `product-calendar.ts:154-172` (`DRAG_SCHEDULE_DURATION_MS`) |
| 2.6 | **Real default calendar.** Replace `order by created_at limit 1` with an explicit `is_default` flag. | `schedule_task_idempotent`, `calendars` |
| 2.7 | **Task dues in Week/Day.** They are Month-only today. | `month-items.ts:127` → generalise |
| 2.8 | **Unify the two scheduling models.** Month-drag moves `due_at`, Week-drag moves event times. Pick one mental model and make both views express it. | `month-drag.ts`, `calendar-grid-engine.tsx` |

## Phase 3 — Adoption ramp: Google read sync

Nobody switches cold. `google_event_id` and `source` already exist for exactly this.

| # | Task |
|---|---|
| 3.1 | OAuth connect flow + token storage |
| 3.2 | Read-only pull → `calendar_events` with `source = 'google'` |
| 3.3 | Render external events as read-only (distinct treatment, no edit affordances) |
| 3.4 | Incremental sync (sync tokens) + a webhook receiver |
| 3.5 | **ICS import/export** — much cheaper than OAuth, covers Apple/Outlook, and satisfies the CalDAV/portability demand in B1 #7 |

Consider shipping 3.5 *before* 3.1. It's a fraction of the work and unblocks every non-Google user.

## Phase 4 — Mobile and accessibility parity

| # | Task |
|---|---|
| 4.1 | Month below 768px → agenda/list view instead of seven ~50px columns |
| 4.2 | Week on mobile → 1–3 day window, or a real horizontal scroll container |
| 4.3 | Week/Day keyboard model to match Month's `role="grid"` quality — the a11y tier gap |
| 4.4 | Focus into the detail popover on open (`event-detail-popover.tsx:131`) |
| 4.5 | `React.memo` on `MonthDayCell` / `MonthWeekRow`, or move the 60s `now` tick to a context so it stops re-rendering 42 cells a minute |

## Phase 5 — Hardening

| # | Task |
|---|---|
| 5.1 | Rate limit calendar mutations — reuse the Files `check_rate_limit` RPC |
| 5.2 | Bound the Today-rail task fetch by date (`product-tasks.ts:40-56`) |
| 5.3 | Supabase realtime on `calendar_events` for cross-tab/device liveness |
| 5.4 | Collapse the four-round-trip workspace-scope load (`product-calendar.ts:56-67`) |
| 5.5 | Optimistic updates for create/update/delete, matching the month-drag pattern that already works |

## Phase 6 — The wedge (only after 0–2 land)

Not features to bolt on — the identity the research points at.

| # | Task |
|---|---|
| 6.1 | **Vertical timeline day view** — Structured's core metaphor, and better suited to mobile than a grid |
| 6.2 | **Time-blindness affordances** — start times not just due times, elapsed/remaining on the now-indicator, next-block-in-N-minutes |
| 6.3 | **Daily plan ritual** — the planning sidebar becomes "plan your day against real available hours," with committed-hours and overcommitment feedback. `use-month-capacity.ts` already measures capacity; this is the natural extension. |
| 6.4 | **Shareable day view** — export the day as an image. B3 says this audience already performs this behaviour manually. |
| 6.5 | **Buffers and travel time** between blocks |
| 6.6 | **Natural-language add, finished** — the parser exists (`parse-event-capture.ts`); it already detects recurrence phrases and declines. After 1.2, it can accept them. |

## Sequencing

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 6
              │            │
              └──► Phase 3 └──► Phase 4 ──► Phase 5
```

Phase 1 gates everything (recurrence and timezone touch every query). Phase 2 is the differentiator and should not wait for Phase 3. Phase 6 only makes sense on a foundation that already round-trips tasks correctly.

---

# PART E — Decisions needed before implementation

1. **Recurrence in V1 — yes or no?** F-04 explicitly defers it. Part B says it is table stakes and its absence blocks real adoption. My read: build the *schema* in Phase 1 regardless (retrofitting is a rewrite), and treat the UI as a separate call. **This is a founder decision and the plan branches on it.**

2. **Reminders — how far?** Browser Notification API is a day's work and covers desktop-open cases. Reliable mobile push is its own project, and B2 #3 says unreliable notifications destroy trust faster than missing ones. Shipping *half* a reminder system may be worse than shipping none.

3. **Mobile — product or afterthought?** The research audience is mobile-native; the current surface is desktop-only in practice. Phase 4 is scoped as responsive-web. A real mobile answer might be larger than that.

4. **AI posture.** Part B shows AI auto-scheduling is simultaneously the most-marketed feature and a thing people resent when it moves their day without asking. The house rule ("present, not pushy," manual-first) is *already* the correctly differentiated position. Recommend holding it explicitly rather than chasing Motion.

5. **Attendees — in or out of scope for the year?** Currently out. It changes the data model substantially (identity, invites, free/busy) and determines whether this is a personal calendar or a meeting calendar.

6. **Research confidence.** Reddit and X could not be reached. Before betting roadmap priority on any single Part B claim, get first-party data through an authenticated API path — or accept these as directional and validate with your own users.

---

## Appendix — Findings register

**High**
`week-grid.tsx` dead engine still type-exported into live DnD · `calendar-dnd-context.tsx:96-108` unreachable slot branch · no recurrence (schema + UI) · no reminders · no attendees · no timezone binding on events · `google_event_id`/`source` inert · no undo anywhere · task↔event never reconciled (4 paths) · task delete orphans events silently · `task_id` invisible in all event UI · Week/Day has no keyboard model

**Medium**
No rate limiting on calendar actions · unbounded Today-rail task fetch · no realtime sync · no soft delete · mobile essentially undesigned <768px · task dues Month-only · no unschedule path · fixed 1h drag duration · "oldest calendar" masquerading as default · no per-event colour · no conferencing field · no `React.memo`, 60s tick re-renders 42 cells

**Low**
Year view has no density indicators · toolbar "Filter" overpromises · double revalidate + invalidate · no optimistic concurrency token · four round trips on workspace-scope load · ownership checks duplicated over RLS

**Clean — do not touch**
RLS coverage · zero `security definer` (house rule holds) · index coverage matches real query shapes · zod validation on every action · `actionError` correlation IDs · idempotent writes via `operation_key` · token discipline outside the dead file · reduced-motion handling · Month grid a11y · month-drag optimistic rollback
