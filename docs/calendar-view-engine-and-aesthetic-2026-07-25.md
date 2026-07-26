# Calendar View Engine + Aesthetic System — Research & Architecture

**Date:** 2026-07-25
**Companion to:** `docs/calendar-audit-2026-07-25.md` (full-stack audit, same day)
**Status:** research and architecture only. No code written.

---

## 0. The short version

Three findings drive everything below.

1. **No calendar library on the market — free or commercial — treats "view paradigm" as a pluggable concept.** Every one of them hardcodes a family (grid-family or timeline-family) and calls custom cell renderers "custom views." What you're describing has to be built. The good news is it's ~150–300 lines of layout math plus a registry, not a platform.

2. **All 14 competitor views collapse into 8 config axes.** Sunsama, Structured, Google, Motion, Outlook Board are each a named point in the same small space. Presets are a schema, not five hand-built UIs. This is the single most important result in this document.

3. **The codebase is already ~65% ready for this** and doesn't know it. The data layer is fully renderer-agnostic, adapters are cleanly isolated, and the motion foundation is reusable. The blocker isn't the renderer seam — it's that view is a URL param for the whole page instead of a stored property of anything.

And one correction to your framing, offered before the plan depends on it: **a view should not be a property of a calendar, and there should be no "main" calendar.** See §1.

**Build order is answered in §7:** floors first, engine second, with one cheap piece of the engine running in parallel from day one.

---

## 1. The structural decision — view as a saved object, not a calendar property

You described it as: each calendar gets its own view. The research says model it one level up.

A Sunsama-style planner isn't a rendering of *one* calendar — it's a lens over your work, pulling from several calendars plus your task backlog. If view lives on `calendars.view_type`, then "show me Work + Personal together in the timeline" is unrepresentable, and every calendar you add multiplies the config burden.

**Recommended model — `calendar_views` as a first-class saved object:**

```
calendar_views (
  id, user_id, name,                    -- "My Day", "Work Grid", "Deep Work"
  config jsonb,                         -- the 8 axes from §2
  source_calendar_ids uuid[],           -- which calendars feed it
  include_task_dues boolean,
  is_default boolean,
  position int,
  created_at, updated_at
)
```

Why this wins on every dimension you named:

- **"Make a calendar exactly like Sunsama"** → create a view, pick the Sunsama preset, choose which calendars feed it. Done.
- **"Import that same view into Workspace"** → the embed block stores a `viewId`. One reference. The Workspace embed and the `/calendar` route render the *same* object through the *same* registry — no duplicate rendering path, no drift.
- **Sharing later** is a row you can copy, not a UI state you have to reconstruct.
- **Per-calendar view still works** as a degenerate case: a view whose `source_calendar_ids` has one entry.

Prior art confirms the shape. **Fantastical's "Calendar Sets"** are exactly this — named, saveable, switchable bundles (manually, by time, or by geofence). **Teamup** ships a catalog of ~12 named views over the same data, selectable by URL parameter — which is essentially the embed mechanism you described, already proven in production. **Notion's database views** save filter/sort/group per view but keep layout fixed per view-type; our axis model is strictly more granular than any of them.

> **This is decision #1 and everything downstream assumes it.** If you want view-on-calendar instead, say so — it's a smaller migration but it forecloses multi-calendar views and complicates the Workspace embed.

### 1.1 There is no "main" calendar — there is one event pool

The natural instinct is to make one calendar the master that owns the others. Design away from it. The correct primitive:

**A user has one timeline. Calendars are labels on it.**

```
        ┌─────────── EVENT POOL (one per user) ─────────┐
        │  9am  standup      [Work]                      │
        │  12pm lunch        [Personal]                  │
        │  2pm  investor     [Work]                      │
        │  6pm  gym          [Personal]                  │
        └────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
      "Work Grid"                      "My Day"
      sources: [Work]                  sources: [Work, Personal] + tasks
```

`Work` and `Personal` are not two datasets. They are a `calendar_id` on a row. Every event already shares a `user_id`, so the pool exists today — it simply isn't queried that way.

**Consequence: calendars never need to know about each other.** A view *filtering* what it draws is not the system *forgetting* what exists. Availability is computed against the pool, not against the displayed subset — so booking 6pm in a Work-only view still reports the gym conflict, even though the gym isn't rendered.

This is one query, not an architecture. And it is a place to be correct where Google is sloppy: unchecking a calendar in Google Calendar lets you double-book against the hidden events.

**Display filtering ≠ availability. Never conflate them.** Any free/busy, conflict-detection, or auto-placement logic reads the pool. Only rendering reads `source_calendar_ids`.

### 1.2 What "main" actually decomposes into

Three real needs, none of which require hierarchy:

| Need | Implementation | Size |
|---|---|---|
| Default **write target** — where an unqualified new event lands | `calendars.is_default boolean` | One flag |
| Default **view** — what loads at `/calendar` | `calendar_views.is_default boolean` | One flag |
| Default **source set** for a newly created view | Setting, or "all visible" | Trivial |

**Existing bug this fixes:** `schedule_task_idempotent` currently targets the user's *oldest-created* calendar (`order by created_at, id limit 1`) — not a chosen default, just whichever was made first. Already logged as audit finding Phase 2.6; the `is_default` flag introduced here is the same fix. **Do them as one change.**

### 1.3 Hierarchy, done without hierarchy

```
User's timeline               ← one pool, everything, always
│
├─ Views (lenses)
│   ├─ "My Day"     → Flow preset    → Work + Personal + task dues
│   ├─ "Work Grid"  → Classic preset → Work only
│   └─ "Deep Work"  → Flow preset    → Work only, 06:00–14:00
│
└─ Calendars (labels/sources)
    ├─ Work
    ├─ Personal
    └─ Google (synced, read-only)
```

The nesting in the sidebar is **navigation, not data ownership**. Nothing owns anything, so nothing can drift out of sync with a parent.

A master-calendar-containing-sub-calendars model would instead require invented rules for: what happens when a child is hidden but the parent isn't, whether an event belongs to child or parent, what a view attached to a parent resolves to. All complexity solving a problem that doesn't exist.

---

## 2. The engine — 8 config axes

From tearing down Google Calendar, Notion Calendar, Sunsama, Structured, Amie, Motion, Vimcal, Akiflow, Fantastical, Morgen, TickTick, Reclaim, Apple Calendar, Outlook Board, and Trevor AI:

```ts
ViewConfig = {
  layout:       "grid-columns" | "single-timeline" | "month-cells" | "kanban-columns" | "list-agenda",
  timeAxis: {
    mode:       "fixed-24h" | "cropped-working-hours" | "auto-scale-to-content" | "none",
    rowHeight:  "fixed" | "proportional-to-duration",
  },
  dayCount:     1 | 3 | 4 | 5 | 7 | number | "month" | "year",
  sidebarMode:  "none" | "calendar-list" | "task-backlog" | "inbox-capture" | "command-palette",
  groupingKey:  "time" | "day" | "priority" | "project" | "calendar-source",
  colorSource:  "calendar" | "project" | "priority" | "category" | "none",
  cardDensity:  "minimal" | "standard" | "rich",
  interactionSet: Array<"drag-from-backlog" | "auto-schedule" | "natural-language-create"
                      | "command-bar" | "click-empty-to-create" | "swipe-nav" | "plan-wizard">,
}
```

They group into three meaningful clusters:

| Cluster | Axes | What it determines |
|---|---|---|
| **Skeleton** | `layout`, `timeAxis`, `dayCount` | The structural shape |
| **Workflow** | `sidebarMode`, `groupingKey`, `colorSource` | How you actually work in it |
| **Feel** | `cardDensity`, `interactionSet` | Density and gesture vocabulary |

### Preset mapping

| Preset | layout | timeAxis | dayCount | sidebar | color | signature interaction |
|---|---|---|---|---|---|---|
| **Classic** (Google) | grid-columns | fixed-24h | 7 (toggle 1/4/7/month) | calendar-list | calendar | click-drag-create |
| **Planner** (Sunsama) | single-timeline | fixed + workload overlay | 1 | task-backlog | project | drag-from-backlog |
| **Flow** (Structured) | single-timeline | proportional-to-duration | 1 | inbox-capture | category | drag-from-inbox + plan-wizard |
| **Compact** (Notion Cal) | grid-columns | fixed-24h | 7 | calendar-list | calendar | drag-to-timestamp |
| **Board** (Outlook) | kanban-columns | none | n/a | none | category | pin/drag-card |
| **Command** (Vimcal/Akiflow) | grid-columns | cropped-working-hours | custom-N | command-palette | project | natural-language-create |

Six presets, one schema. Users who want to tune further get the axes; users who don't never see them.

### Renderer registry

```
ViewConfig ──► registry.resolve(config.layout) ──► Renderer
                                                     │
   shared, renderer-agnostic ────────────────────────┤
   • event data (already agnostic — use-calendar-data.ts)
   • layout math (interval partitioning)
   • DnD context, detail panel, quick capture, hotkeys, motion
```

Each renderer implements one narrow interface: take `{ events, taskDues, calendars, anchor, config }`, render, emit the same interaction events. The existing adapters (`rbc-event-adapter.ts`, `month-items.ts`) are already exactly this pattern — a third one for the timeline renderer is *additive*, not a rewrite.

---

## 3. Open-source tooling — what to take, what to avoid

### Verdict: go headless. Buy nothing.

| Library | License | Custom view registration? | Verdict |
|---|---|---|---|
| react-big-calendar | MIT | **No** — views are hardcoded components | Keep as the "Classic" renderer only |
| FullCalendar | Core MIT; **Premium is AGPL-or-pay** | Yes, real plugin system | Reject — licensing + still grid-family only |
| Schedule-X | MIT (core) | Limited — fixed view set | **Read the code.** Only MIT project worth borrowing from |
| @event-calendar/core | MIT, ~35kB, zero deps | Configure built-ins only | Good layout-math reference |
| Toast UI Calendar | MIT | No | Maintenance slowing |
| Bryntum | Commercial, $600+/dev, OEM for redistribution | Yes, marketed | Reject — cost + still won't cover a Sunsama column |
| Mobiscroll | Commercial ~$395+ | Not documented | Reject |
| react-aria / @internationalized/date | Apache-2.0 | N/A — date *picker*, not event engine | Not applicable |
| Radix / Base UI | MIT | No calendar primitive exists | Not applicable |

**Nothing off the shelf gives you peer implementations of grid / planner-column / vertical-timeline behind one interface. That abstraction doesn't exist. Building it is the work.**

### What to actually depend on

| Need | Package | License | Note |
|---|---|---|---|
| Recurrence | **`rrule`** | BSD-3-Clause | Use the object API, not string parsing (open bug drops EXDATE/RDATE from raw `RRULE:` strings) |
| ICS parse/expand | `ical.js` or `node-ical` | MPL / MIT | Boundary only — not the live engine |
| ICS generate | `ical-generator` | MIT | Export/invites |
| Timezone math | **Luxon** now, **Temporal** later | MIT / spec | Temporal hit Stage 4 (ES2026), native in Chrome 144 + Firefox 139; **Safari still flagged** — polyfill is ~100kB |
| CalDAV (later) | `tsdav` | MIT | Cal.com forks this — strong signal for a TS stack |
| Drag/drop | **dnd-kit** (already in repo) | MIT | Every calendar lib ships its own DnD; adopting one means running two systems |
| Virtualization | `@tanstack/react-virtual` | MIT | List/agenda; time-grid axis needs custom windowing |

### License gate — state this plainly to anyone who touches it

**Cal.com (AGPL-3.0), Nextcloud Calendar (AGPL), Radicale (GPL-3), Baïkal (GPL-3), Xandikos (GPL-3), EteSync/Etebase (AGPL), Etar (GPL-3), Fossify Calendar (GPL-3)** — all readable for schema and algorithm *ideas*, **none copyable into Planevo**. AGPL in particular triggers network-use disclosure. **Schedule-X (MIT) is the only project on the list you can take code from.**

### Layout math — write it, don't import it

It's a textbook **interval-partitioning / interval-graph-coloring** problem: sort by start, greedily assign each event to the first free column, track max concurrent columns per collision cluster, width = container ÷ maxColumns.

Reference implementations to read (and to mine for edge cases):
- `react-big-calendar/src/utils/layout-algorithms/overlap.js` (MIT) — plus its known bugs: hardcoded 30-min same-line threshold, issues #1530, #2240, #1843. Read it as a **bug catalog**, not a black box.
- FullCalendar `packages/core` segment placement (MIT even though premium plugins aren't) — mature multi-day lane packing.
- `@event-calendar/core` TimeGrid/DayGrid sources — compact, whole lib is 35kB.

---

## 4. What the codebase already gives you

Measured, not estimated.

**View state today:** a `nuqs` URL query param (`use-calendar-navigation.ts:23-28`), defaulting to `week`, folded into the TanStack cache key (`calendar-query-keys.ts:5-18`). **Never persisted to DB, never per-calendar, never even in localStorage** (only `scope` is, `scope-prefs.ts:1-28`). One `view` drives one engine instance for the whole page. There is no code path today where two calendars could render differently — `is_visible` and `color` are the only per-calendar knobs.

**Coupling — better than feared.** Of 48 files in `features/calendar-product/`:

| Category | Count | Note |
|---|---|---|
| Month-only | ~8 | Bespoke grid, bypasses RBC entirely by design |
| RBC-only | ~6 | Week/Day |
| Year-only | 1 | |
| **Dead** (pre-RBC engine) | 2 | `week-grid.tsx`, `event-block.tsx` — delete first |
| **Shared chrome** | **~31 (65%)** | Toolbar, DnD, detail panel, quick capture, hotkeys, motion, query provider |

The data layer (`use-calendar-data.ts` → `product-calendar.ts`) is **already fully renderer-agnostic**. Both adapters consume identical upstream shapes. A `timeline-items.ts` adapter is additive.

**The real work** is that `CalendarGridEngine` takes one `view` for the whole dataset. Making views pluggable needs: (a) group events by view's source calendars, (b) a registry keyed by `config.layout`, (c) reconcile one shared `anchor` across renderers whose natural navigation unit differs (a timeline's "day" vs a month grid's "month"). **Medium refactor. Not a rewrite.**

**Motion foundation is genuinely reusable.** `framer-motion@12.42.2` is the only motion dep (no GSAP). `calendar-nav-motion.ts:1-93` produces pure `Transition`/`Variants`; `calendar-view-transition.tsx:23-70` is an `AnimatePresence` wrapper already keyed by transition intent and already reduced-motion aware. **A new renderer gets its enter/exit animation for free.**

**Theming is the awkward one.** Calendar colors are *not* separate tokens — they reuse the app-wide 5-color palette (`--color-slate/marigold/meadow/brick/ocean`). The mapping is **compile-time Tailwind**: static `Record<CalendarColor, string>` maps (`calendar-color-dot.tsx:5-27`, with a comment explaining it exists so Tailwind sees every literal) and literal class names matched to hardcoded CSS. *But* underneath, each color class only sets two custom properties (`--planevo-rbc-event-bg`, `--planevo-rbc-event-accent`) which the event rule consumes. **That inner layer is already runtime-swappable.** Arbitrary per-calendar hex = set those two vars inline instead of applying a class. The outer layer (enum → Postgres check constraint → core type → color maps) is what has to become "named enum OR arbitrary hex."

**Workspace embed:** `calendar_embed` / `calendar_strip_embed` **do not exist** — spec-only (`planevo-feature-spec.md:73`). But `database_view` (`features/editor/schema.tsx:11-47`) is a **working end-to-end template**: `createReactBlockSpec` + propSchema + self-fetching render component (`/api/embedded-database`) + `toExternalHTML` + `planevoSchema.extend`. Copying that pattern for `calendar_embed` is small-to-medium. **The embed mechanism is not the bottleneck — having a renderer registry to embed is the prerequisite.**

---

## 5. Aesthetic system

### 5.1 What "aesthetic" actually names

Your palette sits squarely in **Japandi / warm minimalism** — greige base, earthy accents, natural-material texture reference, generous negative space (*ma*). Described across 2026 design coverage as the dominant residential aesthetic, and the closest interior analog to what you pasted.

Adjacent movements sharing the same logic: **soft life** (sensory comfort over hustle), **quiet luxury** (restraint as status signal — no logos, no saturation spikes), **clean girl** (warm taupe, "quietly, consistently, expensively"), **calm tech / digital detox** (explicitly: "beige, sage, clay, cream, and soft gray slow the pulse... avoid sharp contrasts and artificial brights that mimic digital screens"), and **analog nostalgia** (grain/risograph as a human counter-signal to AI polish).

The through-line across all of them: **warm-tinted neutrals, low saturation, tactile material reference, restraint as the status signal.** One relevant business note — "minimalism is now a retention strategy: when an app feels calm to use, users stay longer."

*Sourcing caveat:* TikTok/Instagram/Reddit are not reachable from this environment (no API access; Reddit is crawler-blocked, X returns 402). The "#plannertok" behavior described below comes from secondary aggregator coverage, not primary platform data. One frequently-cited stat — grain overlays driving 15–30% higher engagement — traces to a single secondary source and should be treated as directional, not proven.

### 5.2 Your palette, extended into a system

Base: Dusty Sky `#616F84` · Skintone `#DCD1C7` · Wood `#917E71` · Dark Wood `#685C54`

**Surfaces (light):**
| Role | Hex |
|---|---|
| App canvas | `#FAF7F3` |
| Card / surface | `#F1EAE2` |
| Elevated / popover | `#F7F2ED` |
| Border / divider | `#E4D8CC` |

**Text — measured, not eyeballed:**
| Role | Hex | Contrast | Verdict |
|---|---|---|---|
| Primary text | Dark Wood `#685C54` | **≈6.5:1** | ✅ AA body |
| Secondary text | Dusty Sky `#616F84` | **≈5.1:1** | ✅ AA body |
| Wood `#917E71` | | **≈3.9:1** | ❌ **fails AA body** — headings ≥24px, icons, borders only |

Wood is the trap: it reads most "on brand" and will be reached for constantly. It must be structurally prevented from becoming body text.

**Event categories** (low-saturation, warm-tinted, mutually distinguishable):

| Color | Hex | Suggested role |
|---|---|---|
| Dusty Sky | `#616F84` | Work / Focus |
| Sage | `#7A8871` | Health / Personal |
| Clay | `#B07A5E` | Social / Events |
| Dusty Plum | `#8B7089` | Admin / Errands |
| Muted Ochre | `#B69A5C` | Deadlines |
| Wood | `#917E71` | Default / Misc |

### 5.3 The four accessibility problems this palette *will* cause

Named now so they're designed around rather than discovered in QA. Contrast is the most common accessibility failure on the web (83.6% of sites per WebAIM), 4,605 ADA digital suits were filed in 2024, and the EU Accessibility Act has been in force since June 2025. **A muted palette and WCAG AA are not automatically compatible.**

1. **Category color as sole differentiator fails WCAG 1.4.1.** Sage/Wood and Clay/Ochre sit close in hue and lightness. → Every category pairs with an icon or label. Never color alone.
2. **Category chips likely fail 3:1 UI-component contrast** against `#F1EAE2` — especially Sage and Plum. → Use these hues as small fills, dots, or left-borders beside dark text. Never as text color. Measure each against both canvas tones.
3. **Wood-as-body-text** (see above). → Enforce at the token layer: don't expose Wood as a text token at all.
4. **Dark mode does not invert mechanically.** Dark Wood as a dark-mode *background* crushes all four accents. → Build dark as its own token set: canvas `#211D1A`, surface `#2B2521`, with Dusty Sky and Skintone becoming the light accents against it.

### 5.4 Motion — "aesthetic" is mostly this

Concrete values, since "make it feel calm" isn't buildable:

| Property | Value |
|---|---|
| Duration ladder | 150ms (micro) / 250ms (standard) / 350ms (view transition) |
| Entrances | `ease-out` — fast start, gentle settle |
| Exits | `ease-in` |
| Same-element state change | `ease-in-out` |
| Curve budget | ~60% ease-out workhorse · ~30% secondary · ~10% spring, reserved for emphasis |
| Springs | **damping 1.0 (critically damped, no bounce) by default** |
| Bounce (~0.8 damping) | **Only** when the gesture carried momentum — flick, throw, drag-release |

The rule that matters: *overshoot on a menu that just faded in feels wrong; overshoot on a card you flicked feels right.* Springs for anything the user is touching (they respond to input mid-flight); fixed-duration beziers for non-interruptible reveals.

**`prefers-reduced-motion` is a hard requirement, not a toggle** — WCAG 2.3.3 exists because vestibular-disorder users can experience real physical harm. Pattern: keep opacity fades, strip transforms/parallax/scale. Already centralized in `use-prefers-reduced-motion.ts` — keep it that way.

### 5.5 Type and texture

**Pairing:** **Fraunces** (warm, optical-size display serif — matches your reference exactly) + a clean sans for UI. Body serif alternative: **Source Serif 4** or **Lora**. All Google Fonts under **SIL OFL 1.1 / Apache 2.0 — free commercial use, no attribution.** No licensing review needed.

**Texture:** subtle grain/paper noise behind surfaces, not as a dominant effect. Soft shadows over hard. Blur used sparingly — the existing house rule (glass on chrome only) is already correct and consistent with the *ma* principle.

### 5.6 Theme architecture

Standard two-layer token system, which is also what unlocks the "library of palettes" you described:

```
primitive tokens   →   semantic tokens   →   components
#DCD1C7                --surface-raised       bg-[var(--surface-raised)]
#685C54                --text-primary
```

Swap a skin by remapping semantic → primitive under a `data-theme` attribute on the root. Components never change. This is the same pattern already used for `--planevo-rbc-event-bg` — extend it rather than invent a second system.

**What "share your day as an image" needs:** the secondary research suggests the shareable moment is *instant visual legibility of a day at a glance via consistent color-coding* — not any single hero color. That's a rendering requirement (clean day view, exportable), not a palette requirement.

---

## 6. Phased plan

Depends on `docs/calendar-audit-2026-07-25.md` Phase 0 (delete the dead engine — the new registry needs real droppable-slot registration, which today only the dead file implements).

### Phase A — Foundation
- `calendar_views` table + `ViewConfig` zod schema + the 6 presets as seed data
- Renderer registry keyed by `config.layout`
- Register existing renderers as-is: RBC → "Classic", bespoke month grid → month-cells. **No rendering rewrite.**
- Extract layout math into a standalone, unit-tested module

### Phase B — First new paradigm
- Vertical-timeline renderer (`single-timeline`, proportional rows) → unlocks the **Flow** and **Planner** presets
- `timeline-items.ts` adapter alongside the existing two
- Wire `sidebarMode: task-backlog` to the planning sidebar that already exists

### Phase C — View management UI
- Create/edit/duplicate views; preset picker; per-view calendar source selection
- **Note:** there is *no* calendar edit surface today (`calendar-sources-section.tsx` is create + visibility only). This UI is net-new and is the larger half of the phase.

### Phase D — Workspace embed
- `calendar_embed` block, copying the `database_view` template
- `/api/embedded-calendar` route mirroring `/api/embedded-database`
- Block stores `viewId` → renders through the same registry in compact mode

### Phase E — Aesthetic system
- Two-layer tokens; migrate the 5-color enum to "named preset OR arbitrary hex"
- Ship the Japandi palette as the default theme + a starter theme library
- Motion spec applied across renderers
- Contrast audit gate — every text/surface pair measured before merge

### Phase F — Density and polish
- Virtualization for dense days
- Per-view `dayCount` / `timeAxis` tuning UI
- Day-view image export

**Sequencing:** A gates everything. B proves the registry with a genuinely different paradigm — do it before C, so the management UI is designed against two real renderers rather than one. D and E are independent of each other and can run in parallel after B.

---

## 7. Build order — engine vs. audit findings

The audit (`calendar-audit-2026-07-25.md`) and this engine plan are two separate bodies of work competing for the same weeks. This section answers which goes first.

### 7.1 Is the engine a winning feature? Yes, with one condition

**Why it wins:**
- **Nobody ships it.** Verified across every library and every major product. Fantastical's Calendar Sets come closest and only switch calendar *visibility*, not layout. The market has opinionated single-view apps and nothing else.
- **It collapses a stack of subscriptions.** "Stop paying $17/mo for Sunsama and $20/mo for Vimcal — your calendar becomes whichever one you need today."
- **It compounds into Workspace.** A view is a saved object, so the embed stores an ID. Competitors can clone a timeline renderer in two weeks; they cannot clone "your planner lives inside your docs" without building the whole ecosystem.
- **Switching cost is real.** Three tuned views is a personal investment that doesn't transfer to a competitor.

**The condition — and it is not negotiable:**

A configurable view engine on a calendar that cannot do a recurring weekly standup, cannot remind you of anything, cannot overlay your existing Google Calendar, and cannot undo a mistaken drag is a beautiful thing **nobody can move into**. Views are a layer. Layers need floors.

**The second risk, subtler:** the loudest churn signal in the demand research was people abandoning powerful planners and returning to Google Calendar *because they were too complicated*. Configurability is precisely that failure mode. Mitigation is the framing already recommended in §2 and decision #4: **presets, not settings.** Three named looks; the eight axes live behind a "customize" affordance most users never open. This also happens to be what makes it match the calm/aesthetic positioning — choosing a look should feel like picking a filter, not configuring software.

### 7.2 Do the two tracks conflict? Mostly no — and that matters

| Work | Layer | Conflicts with engine? |
|---|---|---|
| Timezone + recurrence schema | Data | **No** — data layer is already renderer-agnostic |
| Reminders | Data + delivery | No |
| Google / ICS read sync | Data | No |
| Task round-trip (audit Phase 2) | Data + shared chrome | No |
| Undo | Shared chrome | No — build once, every renderer inherits it |
| Rate limiting, bounded fetch, realtime | Backend | No |
| Mobile responsive | Renderer-specific | **Partially** — redo per renderer if done first |

The data layer being renderer-agnostic (§4) is what makes this clean: floors work and engine work touch largely different files.

**But two real ordering constraints exist:**

1. **Recurrence must precede any new renderer.** Recurrence changes what a renderer draws (expanded instances) and what it must offer ("edit this occurrence or the whole series?"). Build the timeline renderer first and you build it twice.
2. **The timezone migration gets harder with every row.** It is strictly cheapest today.

And one shared prerequisite: **audit Phase 0** (delete the dead pre-RBC engine, remove the unreachable drop branch) blocks both tracks, since any new renderer needs real droppable-slot registration and today only the dead file implements it.

### 7.3 Recommended order

```
NOW      Phase 0 cleanup ─────────────────┐  (~1 day, unblocks everything)
                                          │
FIRST    Floors                           │  Engine, cheap parallel slice
         ├─ timezone + recurrence schema  │  └─ calendar_views table
         ├─ recurrence UI                 │     + is_default flags
         ├─ undo (shared chrome)          │     + registry
         ├─ task round-trip               │     + register existing
         ├─ ICS subscribe → Google sync   │       renderers as "Classic"
         └─ reminders                     │
                                          │
THEN     Engine proper ───────────────────┘
         ├─ timeline renderer (Planner + Flow presets)
         ├─ view management UI
         └─ Workspace embed block

LAST     Aesthetic system + mobile + density
```

**Floors first.** Specifically, in this order, because each unblocks the next:

1. **Phase 0 cleanup** — one day, and both tracks are safer after it.
2. **Timezone + recurrence + soft-delete migration** — one migration, designed once. Cheapest now, and gates the renderer work.
3. **Task round-trip** — highest product value per line of code in either document, and independent of everything else.
4. **Undo** — depends on soft delete; built in shared chrome so all future renderers inherit it.
5. **ICS subscription, then Google read sync** — the adoption ramp. Nobody switches cold.
6. **Reminders** — with the caveat from the audit that half a reminder system may be worse than none.

**Run one engine slice in parallel from day one:** the `calendar_views` table, the `is_default` flags, the registry, and registering the two existing renderers behind it. This is cheap, purely additive, breaks nothing (the current calendar simply becomes "Classic"), and it means every floor built afterward lands in a codebase already shaped for multiple views. It also folds in the default-calendar bug fix (§1.2).

**What this costs:** the visible, demo-able, differentiating thing arrives later than it could. That is a real tradeoff, and if there is an external deadline — a demo, a raise, a launch — it deserves to be weighed rather than assumed away.

**Why it is still the right call:** the engine is what makes people *switch*. Floors are what stop them leaving two weeks later. Shipping the engine onto today's data model produces a calendar that demos beautifully and churns completely.

---

## 8. Open decisions

1. **View as saved object vs. property of a calendar** (§1). Recommend the saved object. Everything above assumes it. **This is the one that changes the schema.**
2. **Retire react-big-calendar, or keep it as the "Classic" renderer?** Recommend keeping it initially — it works, and rewriting week/day buys nothing on day one. Revisit once two custom renderers exist and the shared interface has proven itself.
3. **How many presets ship first?** Recommend three (Classic, Planner, Flow) rather than six. Each preset is a support surface.
4. **Do users get raw axis control, or presets only?** Recommend presets-first with axes behind an "customize" affordance — matches the calm-tech positioning, and avoids shipping a config panel as the product's first impression.
5. **Theme library scope** — curated set only, or user-defined hex? The runtime custom-property layer already supports arbitrary hex; the enum and its Postgres check constraint are what block it.
6. **Temporal now or Luxon now?** Recommend Luxon — Safari still has Temporal behind a flag, and a ~100kB polyfill on a calendar page is a poor trade. Revisit when Safari ships.
7. **Is there an external deadline?** The §7.3 order optimizes for a product people keep. If a demo, raise, or launch date exists, the tradeoff changes and should be decided explicitly rather than discovered. **This is the only thing that would justify inverting the order.**
8. **Availability semantics** (§1.1) — confirm that conflict detection reads the whole pool including calendars hidden from the current view. Recommended yes. It is the correct behavior and the one Google gets wrong, but it means a Work-only view can surface a Personal-event conflict, which is a deliberate privacy-adjacent choice worth making consciously.

---

## Appendix — research sourcing

Five parallel Sonnet agents: OSS rendering engines, OSS calendar apps + sync infra, competitor view teardown, aesthetic direction, codebase pluggability. ~430k subagent tokens.

**Reachable:** official product docs and pricing pages, GitHub LICENSE files, Hacker News, Google/Apple/Fantastical/Teamup/Notion help centers, WCAG/WebAIM accessibility sources, Google Fonts licensing.

**Not reachable:** Reddit (crawler-blocked), X (402 auth wall), TikTok/Instagram (no API — page titles only, no engagement data). Short-form social findings rest on secondary coverage and are flagged as directional throughout §5.1.

**Explicitly unverified:** the grain-engagement stat; "vanilla girl" as a standalone movement; Cal.com's internal timezone schema field names; exact column defaults for Vimcal/Akiflow multi-day grids; Planby's free-tier license text (treat as non-permissive until confirmed).
