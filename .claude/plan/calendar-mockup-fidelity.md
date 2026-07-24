# Implementation Plan: Calendar Mockup Fidelity

> **Status:** Planning only — no production code written  
> **Date:** 2026-07-23  
> **Authority:** Founder screenshots + `docs/superpowers/specs/2026-07-19-phase-3-calendar-files-design.md` (layout override) + `AGENTS.md` (tokens, one marigold, app-shell owns global nav)  
> **Mode:** `/multi-plan` + `/multi-frontend` Research→Ideation→Plan (Execute blocked until approval)

---

## Design Read

Reading this as: **Planevo Calendar product redesign** for daily Work OS users, with a **calm dark enterprise / Sunsama-class** language, leaning toward **Planevo tokens + custom week craft** (not Notion/reference global nav, not taste-skill landing aesthetics).

**Dials (product UI, not marketing):** `DESIGN_VARIANCE: 4` · `MOTION_INTENSITY: 3` · `VISUAL_DENSITY: 6`

---

## Screenshot Mapping (pixel analysis)

| Image | Role |
|-------|------|
| `image-acc7304c…` (first) | **Current** — 2-pane glass: merged rail (mini-month + Today + Calendars) + RBC week grid |
| `image-87d2203f…` (second) | **Target craft/layout** — distinct Today column + richer week grid; **ignore** left global app nav (Essentials/Projects) |

### Current (image 1) — what ships today

- Outer dark gutter; two `rounded-xl` glass cards (`calendar-rail-glass` / `calendar-panel-glass`)
- Left ~320px: mini month (Mon-start, today ink circle) → Today h2 → To-do list / Events tabs → THIS WEEK / THIS MONTH / UNSCHEDULED → CALENDARS + New calendar
- Right: redundant “Calendar” meta + H1 → Today + chevrons + range → Day/Week/Month/Year → 7-col week with small uppercase headers (`19 Sun`) → thin tinted event chips with left color bar
- Events are chip-dense, not card-dense; `.calendar-event-glass` exists in CSS but is unused on RBC events
- Hardcoded `10px` on `.rbc-event-label` (token violation)

### Target (image 2) — craft to match (minus global nav)

- **Three product stages:** Today (middle) + Calendar grid (right); calendars/mini-month stay product-left (Phase 3 ASCII), not the mock’s Essentials sidebar
- Today: title + filter affordance; To-do List / Events; accordion sections with rounded checkboxes; `+` on section heads
- Grid: breadcrumb + large title optional; timezone pill; day headers as **large numeral + DOW**; all-day row; taller hour bands; **rich event cards** (icon, time, title, avatar stack, Join CTA)
- Deep charcoal surfaces; soft radii ~8–12px; hairline borders; high contrast white active states

### Hard deltas (current → target)

1. **IA:** 2-pane merged rail → **3-pane** Calendars | Today | Grid  
2. **Day headers:** tiny caps → monumental date number + DOW  
3. **Events:** left-border chips → elevated glass cards (title/time/location craft; Join disabled V1)  
4. **All-day:** empty → task due chips (`taskDues` already loaded, never passed to view)  
5. **DnD:** event move only → + task→grid via existing `scheduleTaskFromDragAction`  
6. **Toolbar:** missing timezone pill; marigold used in multiple places → one primary  
7. **Week start:** mini-month Monday vs grid Sunday — unify  
8. **Do not clone:** Courtney Henry nav, Projects list, real Zoom/Meet URLs, avatar stacks as real people

---

## Tooling Decision (skills / agents / commands)

### Use on execute

| Tool | Why |
|------|-----|
| `frontend-design-direction` | Product-density craft judgment |
| Planevo `AGENTS.md` + `docs/design-brief.md` | Tokens, one marigold, no competitor UI |
| Phase 3 calendar design spec | Founder 3-pane layout override |
| `accessibility` skill | Grid keyboard, landmarks, drawers |
| `@dnd-kit` patterns (existing Tasks) | Cross-pane task→slot |
| `react-reviewer` / `typescript-reviewer` | Post-impl review |
| `build-error-resolver` | If typecheck fails |
| `/design` kitchen-sink update | Every new component state before route |

### Do **not** use / deprioritize

| Tool | Why |
|------|-----|
| `taste-skill` (landing anti-slop) | Explicitly **out of scope** for dense product calendars; craft rules only where they don’t fight AGENTS |
| `/orch-build-mvp` | For greenfield SDD→vertical slice; Calendar product already exists |
| `codeagent-wrapper` (Gemini/Codex CCG) | **Missing** on this machine (`WRAPPER_MISSING`) — used Explore subagents as stand-in |
| Cloning reference global nav | App-shell owns IA |

### Analysis sessions (this plan)

- Frontend gap: Explore agent → recommend **Option B** (3-pane)  
- Architecture: Explore agent → recommend **custom Week/Day** + wire `taskDues` / `scheduleTaskFromDrag`  
- **CODEX_SESSION / GEMINI_SESSION:** N/A (wrapper unavailable)

---

## Task Type

- [x] Frontend (visual + interaction)
- [x] Backend light (wire existing queries/actions; slim rail load optional)
- [ ] Fullstack greenfield

---

## Technical Solution (synthesized recommendation)

### Recommended: Option B — True 3-pane + custom Week/Day grid

**Layout**

```
app-shell (unchanged)
└── /calendar product
    ┌──────────────┬────────────────┬─────────────────────────────┐
    │ Calendars    │ Today          │ Toolbar + Week/Day grid     │
    │ mini-month   │ todos | events │ all-day due chips           │
    │ scope All|WS │ buckets        │ rich event blocks           │
    │ + New cal    │ drag sources   │ drop → scheduleTaskFromDrag │
    └──────────────┴────────────────┴─────────────────────────────┘
```

**Grid engine:** Revive custom week/day using `time-axis.tsx` geometry + `@dnd-kit`. Keep Month/Year as current custom/RBC thin views or hide Month behind stretch — do not block Week fidelity on RBC CSS treadmill.

**Why not Option A (skin RBC in 2-pane):** Fails founder three-pane override; Today stays cramped; RBC HTML5 DnD does not compose with dnd-kit task drag; pixel headers/cards fight library DOM.

**Why not fake avatars/Zoom:** No schema; lying UI. V1 cards = title + time + calendar color (+ location in peek). Join meeting stays disabled craft. Timezone pill = browser `Intl` chrome only.

**Accent:** Founder override (2026-07-23 execute): **zero marigold accent** on Calendar. Use ink/paper for Today/selected states; ocean-tint for drop hover. Calendar color token `marigold` may still appear as a user calendar color swatch only.

---

## Alternative: Option A — 2-pane craft polish (rejected unless founder picks it)

Keep merged `CalendarRail`. Custom RBC `components` for headers/events; timezone pill; apply `.calendar-event-glass`. Faster, fails Phase 3 ASCII / Today stage.

---

## Implementation Steps

### Slice 0 — Contracts (no visual yet)

1. Pass `taskDues` from `loadCalendarPageData` → `CalendarProductView` → grid all-day row  
2. Add single `WEEK_STARTS_ON` constant; align `calendar-range`, mini-month, `weekRange`  
3. Slim optional: rail tasks query to `id, title, status, due_at` only  

**Deliverable:** Types + props wired; no layout change yet.

### Slice 1 — 3-pane shell

1. Create `calendar-sidebar.tsx` (mini-month navigable + calendars + scope + new calendar)  
2. Create `today-column.tsx` (extract from `calendar-rail.tsx`)  
3. Restructure `calendar-product-view.tsx`: three glass columns; drop duplicate H1 stack (toolbar owns identity)  
4. Mobile: drawers/sheet for sidebar + Today (`md+` three-pane)  
5. Update `/design` calendar preview to 3-pane  

**Deliverable:** Spatial match to target middle Today column.

### Slice 2 — Custom Week/Day grid + craft

1. Restore `week-grid.tsx` / `day-grid.tsx` + `day-header.tsx` (large numeral + DOW)  
2. `event-block.tsx` using `.calendar-event-glass` + color tint (no avatar/Zoom invent)  
3. All-day row: events + distinct **task due chips**  
4. Now line (brick), slot click → create popover, event click → peek  
5. `calendar-toolbar.tsx`: Today / prev-next / range or `MMM yyyy · W##` / view tabs / timezone pill  
6. Retire or gate RBC for week/day; keep Year view  

**Deliverable:** Pixel-close week craft under Planevo tokens.

### Slice 3 — Continuity DnD

1. `calendar-dnd-context.tsx` with `@dnd-kit`  
2. `TodayTaskRow` draggable; grid slots droppable → `scheduleTaskFromDragAction`  
3. Keep event move/resize on custom grid (or temporary bridge)  
4. Optimistic UI; refresh on settle; toast errors  

**Deliverable:** Tasks ↔ Calendar handshake works.

### Slice 4 — Polish + law

1. One marigold audit  
2. Token audit (kill `10px`, raw rgba where replaceable with token mixes)  
3. A11y: landmarks, keyboard slots, focus rings, reduced-transparency already present  
4. Empty/loading states for Today + grid  
5. Code review agents  

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `apps/web/features/calendar-product/calendar-product-view.tsx` | Modify | 3-pane shell; wire taskDues + DnD |
| `apps/web/features/calendar-product/calendar-rail.tsx` | Split/Delete | Become sidebar + today-column |
| `apps/web/features/calendar-product/calendar-sidebar.tsx` | Create | Left pane |
| `apps/web/features/calendar-product/today-column.tsx` | Create | Middle pane |
| `apps/web/features/calendar-product/calendar-toolbar.tsx` | Create | Nav + views + TZ |
| `apps/web/features/calendar-product/week-grid.tsx` | Create | Custom week |
| `apps/web/features/calendar-product/day-header.tsx` | Create | Monumental headers |
| `apps/web/features/calendar-product/event-block.tsx` | Create | Glass event cards |
| `apps/web/features/calendar-product/calendar-dnd-context.tsx` | Create | Task→slot |
| `apps/web/features/calendar-product/calendar-grid.tsx` | Modify | Delegate week/day; month/year |
| `apps/web/features/calendar-product/today-task-row.tsx` | Modify | Draggable + checkbox craft |
| `apps/web/app/globals.css` | Modify | 3-pane helpers; event glass on blocks; remove RBC debt as week leaves |
| `apps/web/app/(workspace)/calendar/page.tsx` | Modify | Pass taskDues if not via spread already consumed |
| `apps/web/lib/calendar/calendar-range.ts` | Modify | Unified week start |
| `apps/web/app/design/calendar-product-preview.tsx` | Modify | Preview all states |
| `apps/web/app/(workspace)/calendar/actions.ts` | Keep | Already has schedule drag |

---

## Pseudo-code (shell)

```
CalendarProductView(props):
  return section.fullHeight
    div.gutter.flex.gap-4
      aside.sidebarGlass.w-56 → CalendarSidebar(...)
      aside.todayGlass.w-72 → TodayColumn(tasks, events, onToggle, dragIds)
      main.panelGlass.flex-1
        CalendarToolbar(date, view, tz, onChange)
        if view in {week, day}:
          WeekOrDayGrid(events, taskDues, onSlot, onEvent, onDropTask)
        else if view == month: MonthView...
        else: YearView...
```

```
onDropTask(taskId, slotStart):
  ends = slotStart + 1h
  result = scheduleTaskFromDragAction({ taskId, startsAt, endsAt, calendarId })
  if ok: toast + refresh else: toast error
```

---

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| RBC + dnd-kit conflict | Custom week/day; one DnD system |
| Week-start Sun vs Mon | Single constant before slice 2 |
| Rich-card expectation creep | V1 cut table; Join disabled; no fake avatars |
| Width crush at 1280px | Sidebar ~200–220, Today ~260–280, grid flex-1; collapse drawers &lt; md |
| `revalidatePath` thrash | Optimistic check/drag; refresh on settle |
| Marigold multiplicity | Explicit accent audit checklist |
| Token law regressions | No hex/px in components; CSS vars only |

---

## V1 Done Criteria (measurable)

1. `/calendar` reads as **three columns** on desktop (Calendars | Today | Grid)  
2. Week headers show **large date number + DOW**; today column visually distinct  
3. Events use **glass card** treatment (not 3px chip only)  
4. All-day row shows **task due chips** from `taskDues`  
5. Drag task from Today onto grid creates timed event via existing action  
6. Timezone pill shows browser offset  
7. Exactly **one** marigold accent on the view  
8. No reference global nav cloned; no competitor names  
9. `/design` shows Calendar 3-pane + event card + empty Today states  
10. Keyboard: tabs in Today, focusable create slot, Escape closes peek  

---

## SESSION_ID (for /ccg:execute)

- CODEX_SESSION: N/A — `~/.claude/bin/codeagent-wrapper` missing  
- GEMINI_SESSION: N/A — same  
- Explore stand-ins: frontend `bc94b1fd-7c97-469c-b730-649319d6bc0d`, architecture `0eef8fbb-e920-4a9c-b271-708ff60e320e`

---

## Out of scope (this plan)

- Google Calendar sync (Phase 6)  
- Real conference URLs / RSVP / attendees  
- Recurrence  
- Shipping Option A unless founder selects it  
- Any production code until plan approval + execute command  
