# Calendar Shortcuts & Feature Wishlist Research

**Date:** 2026-07-24  
**Status:** Research / design input — awaiting founder review before implementation plan  
**Scope:** Keyboard shortcuts parity audit, community wishlist synthesis, **Tasks ↔ Calendar continuity design (separate products, seamless handshake)**, open-source tooling, and phased build plan for Planevo Calendar (F-04) and Tasks (F-03)  
**Research method:** Three Grok 4.5 research agents — [Google Calendar shortcuts scrape](b9abcc8e-ef03-43b2-84d5-8dcf56482b30), [Wished-for calendar shortcuts](241ce422-d29c-4d6c-8b35-851067588f3a), [Wished-for calendar features](ad8742cd-1734-4ae6-94c7-4acdd2b2a22d) — plus controller verification against Planevo codebase.

---

## Executive summary

Power users expect **Google Calendar's vim-inspired single-key layer** (`c` create, `d/w/m` views, `j/k` navigate, `g` go-to-date, `?` cheat sheet) as the baseline — not a nice-to-have. Community wishlists go further: **global quick-add**, **duplicate/copy-paste events** (Collison → Pichai shipped Cmd-drag in GCal), **keyboard nudge/resize**, and **`⌘N` discoverability** (Notion Calendar's hidden `C` is a cautionary tale). Feature wishes cluster around **tasks + calendar unification**, **multi-account visibility**, **natural language create**, **travel/buffer time**, and **AI that proposes — never silently reshuffles**.

**V1 product decision:** **Join meeting / join-next-meeting is not a V1 feature** (UI may keep a disabled placeholder). Treat community demand as research-only — do not build shortcuts, URL parsing, or join flows for V1.

Planevo today has **strong month-grid roving tabindex** (arrows, Home/End, PageUp/Down) but **no global shortcut layer**, no cheat-sheet overlay, and no Google-parity create/view/search keys. **Tasks and Calendar are correctly separate products** (F-03 / F-04) linked via `task_id` and cross-link actions — but the UI does not yet close the loop (scheduled blocks invisible in Tasks, linked tasks invisible in event peek, due vs scheduled undifferentiated). This doc inventories the full reference set, ranks community demand, audits gaps, recommends OSS libraries, defines **continuity without merger**, and proposes a phased build aligned with `AGENTS.md` (manual-first, calm UI, ecosystem products — not a Fantastical clone).

---

## Part 1 — Google Calendar shortcuts (official reference)

*Primary research: [Google Calendar shortcuts scrape](b9abcc8e-ef03-43b2-84d5-8dcf56482b30).*

**Sources (authoritative):**
- [Use keyboard shortcuts in Google Calendar](https://support.google.com/calendar/answer/37034) — primary shortcut table
- [Use Google Calendar with a screen reader](https://support.google.com/calendar/answer/6101541) — extended navigation + view-specific shortcuts
- In-app overlay: press `?` (or `⌘/` / `Ctrl+/` per a11y doc) when shortcuts are enabled

**Prerequisite:** Settings → General → **Enable keyboard shortcuts** (off by default). Web/desktop only; mobile touch has no shortcuts unless external keyboard attached.

**Authoritative complete list:** in-app overlay via `?` or `Ctrl+/` / `⌘+/`. Help article [37034](https://support.google.com/calendar/answer/37034) is **partial**; [6101541](https://support.google.com/calendar/answer/6101541) documents the richest set including year view, RSVP keys, and view-internal navigation.

### 1.1 Navigation shortcuts

| Action | Shortcut | Mac | Windows / ChromeOS | Context |
|--------|----------|-----|-------------------|---------|
| Next date range | `j` or `n` | same | same | Global — period depends on view (day/week/month) |
| Previous date range | `k` or `p` | same | same | Global |
| Jump to today | `t` | same | same | Global |
| Go to specific date | `g` | same | same | Opens date dialog; `g` + today = same as `t` |
| Refresh calendar | `r` | same | same | Global |
| Focus search box | `/` | same | same | Global (Banner area) |
| Open Settings | `s` | same | same | Global — **conflicts with Save in event editor** |
| Add calendar / people search section | `+` or `Shift`+`=` | same | same | Expands main drawer |

**View-specific navigation (from screen reader doc):**

| View | Action | Shortcut |
|------|--------|----------|
| Schedule/agenda | Next/prior day | `n` / `p` |
| Schedule/agenda | Move between days | `←` `→` |
| Schedule/agenda | Move between events in day | `↑` `↓` |
| Day | Next/prior day | `n` / `p` |
| Day | Move between all-day vs timed sections | `↑` `↓` |
| Day | Move between events in section | `Tab` |
| Week | Next/prior week | `n` / `p` (then `w` to focus week start) |
| Week | Move between days | `←` `→` |
| Month | Next/prior month | `n` / `p` (then `m` to focus month start) |
| Month | Move between weeks | `↑` `↓` |
| Month | Move between days | `←` `→` |
| Month | Move between events | `Tab` (overflow → "More" button) |
| Year | Next/prior year | `n` / `p` (then `y` to focus year start) |
| Year | Open day's event list | `Enter` |
| Year | Enter month view for day | `Space` |

### 1.2 View switching shortcuts

| View | Shortcut | Notes |
|------|----------|-------|
| Day | `1` or `d` | |
| Week | `2` or `w` | |
| Month | `3` or `m` | |
| Custom (e.g. 4-day) | `4` or `x` | |
| Agenda / Schedule | `5` or `a` | Recommended for screen readers |
| Year | `6` or `y` | Documented in a11y guide; some third-party lists omit |

### 1.3 Event creation & editing shortcuts

| Action | Shortcut | Mac | Windows | Context |
|--------|----------|-----|---------|---------|
| Create new event | `c` | same | same | Global |
| Quick create dialog (OOO / task / reminder) | `Shift`+`C` | same | same | Official [72143](https://support.google.com/calendar/answer/72143), 6101541 |
| Quick create alias | `q` | same | same | Overlay-reported; not in primary help tables |
| View/edit event details | `e` | same | same | Requires event selected/focused |
| Delete event | `Backspace` or `Delete` | Delete | Delete/Backspace | Event selected |
| Undo last action | `z` | same | same | Global |
| Save event | `⌘`+`s` or `⌘`+`Enter` | ⌘ | Ctrl+s / Ctrl+Enter | Event details page |
| Close / return to grid | `Esc` | same | same | Event details or popover |

### 1.4 Search & command shortcuts

| Action | Shortcut |
|--------|----------|
| Focus search | `/` |
| Show all shortcuts | `?` |
| Show shortcuts (a11y alt) | `⌘`+`/` (Mac) · `Ctrl`+`/` (Win/ChromeOS) |
| Print | `⌘`+`p` / `Ctrl`+`p` |

### 1.5 Calendar management & side panel

| Action | Shortcut |
|--------|----------|
| Side panel next (Keep, Tasks, Contacts) | Mac: `⌘`+`Option`+`.` or `,` · Win: `Ctrl`+`Alt`+`.` or `,` · Chromebook: `Alt`+`Shift`+`.` or `,` |
| Small calendar in drawer | `Shift`+`Tab` from people search; arrow keys + `Enter` |

### 1.6 Accessibility shortcuts

- Screen reader mode: treat Calendar as **web application** (not webpage)
- Skip to main content → keyboard shortcuts button → `Enter` for cheat sheet
- `aria-keyshortcuts` patterns documented for create, search, today, views
- Month overflow: navigate to **More** button for hidden events (`Tab` + `Enter`)

**Announce Shortcuts** (screen reader — announces field without moving focus; [Workspace Updates 2022-09](https://workspaceupdates.googleblog.com/2022/09/google-calendar-announce-shortcuts%20.html)):

| Field | Mac | Windows | ChromeOS |
|-------|-----|---------|----------|
| Title | `Option`+`1` | `Alt`+`1` | `Alt`+`Shift`+`1` |
| Date/time | `Option`+`2` | `Alt`+`2` | `Alt`+`Shift`+`2` |
| Guests | `Option`+`3` | `Alt`+`3` | `Alt`+`Shift`+`3` |
| Location | `Option`+`4` | `Alt`+`4` | `Alt`+`Shift`+`4` |
| Description | `Option`+`5` | `Alt`+`5` | `Alt`+`Shift`+`5` |
| Attachments | `Option`+`6` | `Alt`+`6` | `Alt`+`Shift`+`6` |
| Notifications | `Option`+`7` | `Alt`+`7` | `Alt`+`Shift`+`7` |

**RSVP from event context menu** (6101541 — after opening context menu via Shift+F10 / Application key):

| Response | Key |
|----------|-----|
| Yes | `y` |
| Yes, meet room | `r` (collides with refresh globally) |
| Yes, virtual | `v` |
| No | `n` (collides with next-period globally) |
| Maybe | `m` (collides with month view globally) |

### 1.7 Platform differences

| Concern | Mac | Windows / ChromeOS |
|---------|-----|-------------------|
| Save event | `⌘`+`s`, `⌘`+`Enter` | `Ctrl`+`s`, `Ctrl`+`Enter` |
| Side panel | `⌘`+`Option`+`.`/`,` | `Ctrl`+`Alt`+`.`/`,` |
| Delete event | `Delete` | `Delete` or `Backspace` |
| Shortcut help | `?` or `⌘`+`/` | `?` or `Ctrl`+`/` |

**Otherwise identical:** single-letter view/nav keys (`c`, `t`, `d`, `w`, `m`, `j`, `k`, `g`, `/`) work cross-platform in browser.

**Android (external keyboard)** — [37034 Android](https://support.google.com/calendar/answer/37034?co=GENIE.Platform%3DAndroid):

| Action | Shortcut |
|--------|----------|
| Next / previous period | `Ctrl`+`J` / `Ctrl`+`K` |
| Today | `Ctrl`+`T` |
| Go to date | `Ctrl`+`G` |
| Search | `Ctrl`+`F` |
| Settings | `Ctrl`+`,` |
| Schedule / Day / Week / Month / 3-day | `Ctrl`+`1` / `2` / `3` / `4` / `0` |
| New event / Edit | `Ctrl`+`N` / `Ctrl`+`E` |
| Save / Delete | `Ctrl`+`S` / Backspace·Delete |

**iPhone/iPad:** VoiceOver gestures only; no desktop letter shortcuts.

**Context collisions (power-user awareness):** RSVP letters (`y`, `n`, `m`, `r`) conflict with global nav/view keys when context menu is open. Planevo should avoid single-letter overload in modal contexts.

### 1.8 Hidden / power-user shortcuts (documented or widely cited)

| Shortcut | Action | Source confidence |
|----------|--------|-------------------|
| `q` | Quick-add all-day event | Third-party lists + productivity blogs; not in primary Google table |
| `Shift`+`c` | Timed quick-create dialog | Official screen reader doc |
| `6` / `y` | Year view | Official screen reader doc |
| `r` | Refresh | Official primary table |
| After `g` + date in week/month/year | Press `a` or `d` to move focus to exact date | Screen reader "Go to date" tips |

---

## Part 2 — What people wish were shortcuts

*Primary research: [Wished-for calendar shortcuts](241ce422-d29c-4d6c-8b35-851067588f3a).*

**TikTok / Instagram / X** mostly repackage the same themes (enable GCal shortcuts, press `C`/`T`/`G`, `cal.new` hacks) — durable wish threads live on HN, MPU Talk, Microsoft Q&A, Morgen feedback, and App Store reviews.

### 2.1 Top wished-for shortcuts (ranked)

| Rank | Wish | What it would do | Example user voice | Frequency |
|------|------|------------------|-------------------|-----------|
| 1 | **Global quick-add / NLP capture** | System hotkey → mini console; type event without app switch | HN: "open… keyboard shortcut and typing a natural language description" (Fantastical envy on Linux) | Very high |
| 2 | **Duplicate / copy-paste event** | `⌘D`, modifier-drag, or `Ctrl+C`/`V` clone to slot | Collison (X) → Pichai: Ctrl-click duplicate; Outlook users beg copy/paste back | Extremely high |
| 3 | **Join next meeting** | 1–2 keys open Zoom/Meet/Teams for current/next event | HN Grila/Itsycal: "jump into upcoming meeting…"; NextMeeting `⌘⇧J` | Very high — **not V1 for Planevo** (research only) |
| 4 | **Go to date + today** | `Ctrl/Cmd+G`, `t` / `Ctrl+T` | Outlook PA: "I use Ctrl+G all day"; New Outlook dropped these — rage | Very high |
| 5 | **Keyboard nudge / resize** | `⇧↑↓` or `⌃⌘` arrows ±15min / ±1 day on selected event | Morgen FR: "Shift + Up/Down to shift event"; Fantastical gold standard | High |
| 6 | **Discoverable `⌘N` create** | Familiar new-event key, not secret `c`/`C` | Notion Calendar: "CMD+N doesn't work… since 1982? LOLZ Nope" | High |
| 7 | **Google vim parity** | `d`/`w`/`m`, `j`/`k`, `c`, `/`, `?` | Proton UserVoice baseline expectation | Very high |
| 8 | **Share availability** | `S` → paint free slots → copy link | Cron/Notion Calendar praised; Raycast `⌃⌥A` pattern | High |
| 9 | **Calendar set toggles** | `⌃1`–`9` or `⌘⌃1`–`n` filter Work/Personal | MPU time-blockers; BusyCal Smart Filters | High (Mac power users) |
| 10 | **Remappable shortcuts** | Resolve OS/app conflicts | Morgen feedback (44↑): "opt+c opens other apps" | Med–high |
| 11 | **Multi-select keyboard-only** | Shift-range select for bulk move/delete | SuperUser: unanswered Apple Calendar ask | Medium |
| 12 | **Shortcuts on by default + `?` overlay** | Don't bury enablement | Repeated "I didn't know this!" for GCal | High (discoverability) |
| 13 | **Week view shift by one day** | Slide 7-day window ±1 day | macOS Tahoe broke `⌘⌥←/→`; users rebuild with Keyboard Maestro | Medium |
| 14 | **Schedule focused task** | `S` on hovered task/event | Morgen hover+key (Linear/Sunsama style) | High |
| 15 | **Command palette** | `⌘K` calendar-scoped actions | Proton shipped; Planevo shell has `⌘K` but not calendar-scoped | High |

### 2.2 By calendar app

| App | Shortcut gaps / regressions |
|-----|----------------------------|
| **Google Calendar** | Off by default; no keyboard nudge; duplicate not in all views; mobile no shortcuts; `cal.new` as browser workaround |
| **New Outlook** | **Ctrl+G**, **Ctrl+T**, **Ctrl+C/V** event copy, Scheduling Assistant keys dropped — PAs report major productivity loss |
| **Apple Calendar** | No keyboard multi-select; week-shift-by-day remapped in Tahoe; thin vs Fantastical |
| **Fantastical** | Gold standard: Mini Window, `⌃⌘` nudge, set number keys, Option-drag duplicate |
| **Notion Calendar** | Loved `S` availability, `⌘K`, `p` teammate peek; hated hidden `C` create, no `⌘N` |
| **Morgen** | FRs: Shift+arrow nudge, hover+quick actions, remappable keys |
| **Proton Calendar** | Shipped `N`, `T`, `1`–`3`, `⌘K`; still want full GCal set + delete/esc |

### 2.3 Pain points driving shortcut requests

- **Context-switch tax** — full app open just to capture one event or join one call  
- **Mouse-only surgery** — reschedule, resize, duplicate require drag or deep menus  
- **Regression trauma** — New Outlook dropping decades of muscle memory  
- **Discoverability** — GCal shortcuts disabled; Notion create key hidden; incomplete `?` overlays  
- **Time-blocking overload** — one-key toggles between "meetings only" and full blocks  
- **Far-future scheduling** — missing jump-to-date → endless next-clicking  
- **Cross-app conflicts** — OS steals calendar keys; remapping demanded  

### 2.4 Novel / creative shortcut ideas from community

| Idea | Description |
|------|-------------|
| **Live preview while typing create** | Grila: global bar types event; calendar behind jumps to that date for conflict check |
| **Hover + key chord** | Morgen: hover task → `S` schedule, `W` estimate, `X` delete (Linear/Sunsama) |
| **Number-key calendar picker in create** | `1`–`9` choose target calendar while editing |
| **Hyper-key join** | Caps Lock → Hyper → one key opens next meeting URL |
| **Availability paint mode** | Cron `S` — share free/busy as first-class key beside create |
| **Option-drag multi-day repeat** | Fantastical pattern: drag across days for repeating blocks |
| **Workspace link** | `⌘L` → "Add to [Workspace]?" (Planevo-specific) |
| **Buffer insertion** | `b` after select → insert 15m travel block |

---

## Part 3 — What people wish calendar apps had (features)

*Primary research: [Wished-for calendar features](ad8742cd-1734-4ae6-94c7-4acdd2b2a22d).*

### 3.1 Top wished-for features (ranked)

| Rank | Feature | Why | Often missing in | Frequency |
|------|---------|-----|------------------|-----------|
| 1 | **Calendar ↔ tasks unification** | One day view for meetings + work | GCal Tasks silo; Notion Calendar no schedule-todo | Very high |
| 2 | **Multi-calendar single pane** | Work + personal + family without double-book | Manual toggle hell | Very high |
| 3 | **Natural language create** | Sentence → event with location/attendees | GCal form-first | Very high |
| 4 | **Calendar sets / focus filters** | Work vs home contexts | GCal, web calendars | High |
| 5 | **Travel time + time-to-leave** | Commute-aware scheduling | GCal weak vs Fantastical | High |
| 6 | **Universal task inbox → calendar** | Slack/Jira/Notion → time blocks | Most native calendars | High |
| 7 | **Booking / availability without Calendly** | Share openings in-app | Basic calendars | High |
| 8 | **Fast keyboard-first desktop** | Superhuman-for-calendar | Browser GCal tab | High |
| 9 | **Focus / maker-mode defense** | Protect deep work from meeting creep | Personal GCal | High |
| 10 | **AI suggests, human approves** | Plan around meetings without autopilot | Motion-style tools | High (polarized) |
| 11 | **Timezone UX** | City search, dual TZ, no silent TZ flip | GCal historical pain | High |
| 12 | **Mobile parity** | Month view, widgets, create focus time on phone | Notion Calendar mobile | High |
| 13 | **Search past events** | "When was my last dentist?" | GCal mobile search gaps | Med–high |
| 14 | **Weather + glance widgets** | Outdoor plans | GCal widgets | Medium |
| 15 | **Offline / privacy / CalDAV** | No cloud hostage | Notion, Google-only apps | Medium niche |

### 3.2 Feature categories (compressed)

- **Scheduling:** drag tasks to grid; recurring focus frames; buffers; conflict across accounts  
- **Tasks:** two-way completion; duration + busy flag; auto-decline when overcommitted  
- **NLP:** one-sentence create; forward-email-to-event; must not silently mis-parse  
- **Travel/TZ:** traffic-aware blocks; favorite zones; consent before TZ changes  
- **Collaboration:** find-a-time; proposal polls; shared color semantics; busy-only mirroring  
- **UI/UX:** speed; split agenda+week; calm craft (Planevo lane); stable nav defaults  
- **AI wanted:** suggest plan, explain moves, local meeting notes — **not** overnight reshuffle  
- **AI rejected:** opaque autopilot, override fights, bot-on-call, paywall-only "smart"  
- **Mobile:** month + widgets; remember schedule-as-default; Android parity for household mixed OS  
- **Privacy:** offline-first, CalDAV, no forced Google OAuth for "third-party" calendars  

### 3.3 Competitive insights (what users love)

| App | Loved for |
|-----|-----------|
| **Fantastical** | NLP, Calendar Sets, travel time, weather, Openings |
| **Amie** | Joyful UI, schedule-todos, bot-free notes |
| **Morgen** | Multi-provider, AI planner with approval, Frames |
| **Akiflow** | Universal inbox, keyboard speed, 2-way task sync |
| **Notion Calendar** | Speed, keyboard, availability links, Notion DB dates |
| **BusyCal** | Tags, alerts, travel, one-time purchase |
| **Reclaim/Clockwise** | Focus defense, team meeting optimization |

### 3.4 Anti-features (explicit rejections)

1. Autopilot reshuffle without consent  
2. Subscription bait-and-switch after paid upfront  
3. Ecosystem lock-in (Google-only, Notion-pushy)  
4. Meeting bots on calls  
5. Desktop-only core features on phone-first workflows  
6. Laggy mobile that loses half-written events  
7. UI regressions (removed month nav, wrong default view)  
8. Shallow one-way sync → duplicate events  
9. AI blind to secondary/shared calendars  
10. "$30/mo frontend on free backend" price fatigue  

---

## Part 4 — Planevo Calendar audit (current vs reference)

### 4.1 What Planevo has today

| Capability | Status | Location / notes |
|------------|--------|------------------|
| Month grid arrow navigation | ✅ | `month-grid.tsx` — `←→↑↓`, Home/End week bounds |
| Month PageUp/PageDown | ✅ | 4-week jump with weekday preservation (`month-keyboard-focus.ts`) |
| Enter → day agenda popover | ✅ per spec | `month-day-cell.tsx` |
| Escape closes popover | ✅ | `month-day-agenda-popover.tsx` |
| Roving tabindex on month cells | ✅ | `role="grid"` + `aria-label` |
| Drag/drop month items | ✅ | dnd-kit + `month-drag.ts` |
| View menu (Day/Week/Month) | ✅ UI only | `calendar-view-menu.tsx` — mouse, no `d`/`w`/`m` keys |
| Global `⌘K` spotlight | ✅ shell | `sidebar-primary-nav.tsx` — not calendar-scoped |
| Tasks `N` shortcut | 📋 planned | `docs/superpowers/plans/2026-07-17-ecosystem-phase-2-tasks-product.md` |
| `T` today, `c` create, `/` search, `g` go-to-date | ❌ | Not implemented in calendar product |
| Shortcut cheat sheet `?` | ❌ | |
| Event `e` / Delete on selection | ❌ | Week/day via RBC — unclear keyboard selection model |
| Year view / custom view | ❌ | Post-V1 per F-04 |
| NLP quick create | ❌ | |
| Calendar sets | ❌ | Multi-calendar list exists; no focus filters |

### 4.2 Gap summary (shortcut parity)

| Tier | Shortcuts | Priority for Planevo |
|------|-----------|---------------------|
| **P0 — Ship blockers for "feels like a calendar"** | `?` help, `c` create, `t` today, `d`/`w`/`m` views, `/` search (or delegate to `⌘K`), `Esc` dismiss | High — low engineering, high perceived quality |
| **P1 — Google parity** | `j`/`k` or `n`/`p` period nav, `g` go-to-date, `e` edit selected, `Delete` remove, `z` undo, `⌘N`/`c` create | High |
| **P2 — Power user** | Duplicate (`⌘D`/modifier-drag), keyboard nudge/resize, `q` quick add, calendar-scoped `⌘K` | Medium–high |
| **P3 — Differentiation** | `S` schedule task, `⌘L` workspace link, buffer/travel helpers | Medium — aligns with ecosystem |
| **Defer** | Year view keys, side-panel keys, print, menubar global hotkey | Low / platform-specific |

### 4.3 Gap summary (features vs community top 15)

| Community rank | Planevo F-04 alignment | Gap |
|--------------|-------------------------|-----|
| Tasks on calendar | ✅ spec + partial build (task chips, drag schedule) | Deepen: keyboard schedule, two-way done state |
| Multi-calendar | ✅ calendars table | Sets/filters not built |
| NLP create | ❌ | Later — consider chrono-node or provider |
| Travel/buffer | ❌ | Later |
| Booking links | ❌ | Later (Cal.com OSS reference) |
| Keyboard-first | ⚠️ month only | Global layer missing |
| AI approve-plan | ❌ | Align with present-not-pushy AI (`AGENTS.md`) |

---

## Part 5 — Open-source tools for building shortcuts & features

### 5.1 Keyboard shortcut libraries (recommended)

| Library | License | Size | Best for Planevo | Notes |
|---------|---------|------|------------------|-------|
| **[react-hotkeys-hook](https://github.com/JohannesKlauss/react-hotkeys-hook)** | MIT | ~small | **Primary recommendation** | Scopes for modal vs grid vs global; `HotkeysProvider`; 2.6M weekly downloads; fits React 19 |
| **[tinykeys](https://github.com/jamiebuilds/tinykeys)** | MIT | ~650B | Pure utilities / non-React modules | `$mod` cross-platform; manual scope gating |
| **[hotkeys-js](https://github.com/jaywcjlove/hotkeys)** | MIT | small | Legacy/vanilla patterns | Built-in scope tags; less React-native |
| **Native `onKeyDown` + roving tabindex** | — | 0 deps | Grid-local keys (already used) | Keep for month grid arrows — don't double-fire with global layer |

**Recommendation:** `react-hotkeys-hook` at `CalendarProductView` root with scopes:

- `calendar-global` — `c`, `t`, `d`, `w`, `m`, `/`, `g`, `?`  
- `calendar-month-grid` — arrows, Enter (existing; suppress global when grid focused)  
- `calendar-event-peek` — `e`, Delete, Esc  
- `calendar-dialog` — disable global when modal open (forms, create event)

Use **`enableOnFormTags: false`** by default; opt in for quick-add composer only.

### 5.2 Command palette

| Library | Notes |
|---------|-------|
| **[cmdk](https://github.com/pacocoursey/cmdk)** | Already referenced in Planevo spotlight CSS patterns; extend spotlight or calendar-scoped palette |
| **Planevo spotlight (`⌘K`)** | Reuse for calendar actions: "Go to date…", "Create event", "Switch to week" — avoids second palette UX |

### 5.3 Date parsing / NLP (separate design)

**Moved to:** [`2026-07-24-natural-language-capture-engine-design.md`](./2026-07-24-natural-language-capture-engine-design.md) — shared Capture Engine, chrono-node parse, Whisper-style STT port for web → desktop → mobile.

### 5.4 Scheduling / booking (feature backlog)

| Project | License | Use |
|---------|---------|-----|
| **[Cal.com](https://github.com/calcom/cal.com)** | AGPL | Reference for availability slots, buffers API patterns |
| **[calendso](https://cal.com)** | AGPL | Self-host booking — overkill V1 |

### 5.5 Drag-and-drop (already in use)

| Library | Status |
|---------|--------|
| **@dnd-kit** | ✅ month + week scheduling — keep |

### 5.6 Accessibility

| Approach | Notes |
|----------|-------|
| **`aria-keyshortcuts`** | Already on spotlight; add to calendar toolbar buttons |
| **`?` modal** | `role="dialog"`, focus trap, searchable table — mirror Google overlay |
| **Don't override browser chrome** | Avoid binding bare `⌘w`, `⌘t`, etc. |

---

## Part 6 — Build plan (phased)

Aligned with `AGENTS.md`: manual-first, one accent per view, ecosystem products, no AI mascot. **No implementation until this spec is approved** (brainstorming gate).

### Phase A — Shortcut foundation (1–2 days)

**Goal:** Calendar feels keyboard-native for daily navigation.

1. Add `react-hotkeys-hook` + `HotkeysProvider` scoped to `/calendar` route  
2. Implement P0 shortcuts: `?`, `c`, `t`, `d`, `w`, `m`, `Esc`  
3. Wire `/` to focus calendar search OR open spotlight pre-scoped to Calendar  
4. Cheat sheet modal — token-themed, lists Mac/Win columns, link to Planevo docs  
5. Unit tests: shortcut handler pure functions (view map, date jump); no key spam in RTL  

**Acceptance:** User never touches view menu for week/month/day; `?` discoverable on first visit tooltip.

### Phase B — Google parity (2–3 days)

1. `j`/`k` (or `n`/`p`) — previous/next period per active view  
2. `g` — go-to-date dialog (reuse date picker primitives)  
3. Selection model for week/day — roving or click-to-select event → `e` edit peek, `Delete` with confirm  
4. `z` undo — wire to existing optimistic mutation rollback where safe  
5. Support **`⌘N` and `c`** for create (Notion Calendar lesson: don't hide create behind undocumented key)  
6. Avoid binding bare `s` to Settings — use `⌘S` only in event editor (Google collision)  

**Acceptance:** GCal/Outlook migrants can navigate a full week without mouse; go-to-date works.

### Phase B2 — High-demand power shortcuts (2 days, can follow B)

1. **Duplicate** — `⌘D` or modifier-drag (GCal shipped Cmd-drag after public ask)  
2. **Keyboard nudge** — `⇧↑↓` or `⌃⌘` arrows on selected event (±15min default)  
3. Share availability — defer unless booking spec exists; note Cron `S` as reference  

**Not V1:** Join next meeting / conference URL shortcuts — post-V1 only (disabled “Join meeting” placeholder may remain in event peek).

### Phase C — Ecosystem shortcuts (2 days)

1. `S` — schedule focused task (from Tasks sidebar selection)  
2. `⌘L` / **Add to workspace** keyboard path when workspace context active  
3. Calendar list toggles — number keys `1`–`9` visibility when sidebar focused (optional)  
4. Integrate with Tasks `N` — scope so `N` creates task only when Tasks panel focused, `c` when grid focused  

**Acceptance:** Cross-product flows match F-02/F-03/F-04 without breaking single-key create.

### Phase D — Power features (backlog — separate specs)

| Item | Depends on | OSS |
|------|------------|-----|
| Quick add `q` + NLP bar | Event composer | chrono-node |
| Join next meeting | **Post-V1** — not in V1 build | — |
| Calendar sets / filters | `calendars` UI | — |
| Travel/buffer blocks | Event model extension | Morgen patterns as reference |
| Booking links | New tables + API | Cal.com patterns |
| AI suggest-day | Planevo AI layer | Human-approve UI |

### Phase E — QA gates

- [ ] Shortcuts disabled when typing in inputs (except quick-add)  
- [ ] Month grid arrows don't double-trigger global `j`/`k`  
- [ ] Screen reader announces shortcut help  
- [ ] `/design` calendar preview documents shortcut states  
- [ ] No raw hex/arbitrary px in cheat sheet modal  
- [ ] 80%+ coverage on shortcut routing pure functions  

### Phase F — Tasks ↔ Calendar continuity (2–4 days)

**Goal:** Users feel Tasks and Calendar work together without merging products or tables.

Aligned with F-04 founder decision (all three link modes) and `AGENTS.md` ecosystem model. **Do not** collapse into one UI or one database.

**Product framing (user-facing):**

> **Tasks** = what you need to do  
> **Calendar** = when things happen  
> **Schedule** = one tap that connects them — two products, one handshake  

#### F1 — Tier 1: “They talk to each other” (ship first)

| # | Deliverable | Owner product | Mechanism |
|---|-------------|---------------|-----------|
| 1 | **Linked-task affordances on events** — when `calendar_events.task_id` is set, event peek shows linked task title, checkbox (complete), **Open in Tasks** | Calendar UI | Read `task_id`; call existing task toggle action |
| 2 | **Scheduled time on task rows/peek** — “Scheduled · Tue 2:00–3:00 PM” with **Open in Calendar** / **Change** / **Clear block** | Tasks UI | Query `calendar_events` where `task_id = ?` (read-only from Tasks) |
| 3 | **Dedup in calendar render** — if task has linked event in visible range, suppress due chip or merge badge onto block | Calendar render | `toMonthItems` / week merge layer |
| 4 | **Deep links after actions** — “Scheduled” toast → **View on calendar**; complete from calendar → optional **Open task** | Both | `/calendar?date=…`, `/tasks?highlight=…` (spotlight pattern exists) |

**Acceptance:** Schedule from Tasks → see block on calendar and scheduled line on task. Complete from either surface. No duplicate chip + block for same task in same window.

#### F2 — Tier 2: “One workflow, two apps”

| # | Deliverable | Notes |
|---|-------------|-------|
| 5 | **Lighter schedule from Tasks** — quick actions: next free hour, due-day 9am, 1h default; full modal on “Custom” | Reduces `cross-link-actions.tsx` modal friction |
| 6 | **Visual distinction** — task-linked blocks vs meetings (icon, token, no meeting chrome) | `event-block.tsx`, month bars |
| 7 | **`S` schedules focused planning-rail task** | Ties to Phase C shortcut work |
| 8 | **Due vs scheduled copy** — month chip “Due”; week block “Scheduled”; drag hints on first use | Labels only; no schema change |

#### F3 — Tier 3: Power user (backlog)

| # | Deliverable | Notes |
|---|-------------|-------|
| 9 | Add task due from calendar empty cell | `updateTaskDueDateAction` exists |
| 10 | Spotlight: “Schedule [task] tomorrow 2pm” | Routes to `scheduleProductTaskAction` |
| 11 | Schedule duration from task estimate | `description_json.estimateMinutes` |
| 12 | F-15 capture → task + optional “also block time” step | Natural capture; manual-first |

#### Explicitly out of scope (would blur product boundary)

- Single combined task-event table or universal kernel row  
- Task title/status edited only inside calendar event editor  
- Auto-link every task to active workspace  
- Motion-style autopilot reshuffling tasks and events without approval  

#### Codebase map (implementation anchors)

| Concern | Path |
|---------|------|
| Schedule write (shared) | `packages/core/src/mutations/task-cross-links.ts`, RPC `schedule_task_idempotent` |
| Drag schedule | `packages/core/src/mutations/product-calendar.ts`, `calendar-dnd-context.tsx` |
| Task schedule UI | `apps/web/features/tasks-product/cross-link-actions.tsx` |
| Calendar task dues | `apps/web/lib/calendar/month-items.ts`, `packages/core/src/queries/product-calendar.ts` |
| Event peek | `apps/web/features/calendar-product/event-peek.tsx` |
| Task metadata | `apps/web/features/tasks-product/task-metadata-strip.tsx`, `task-peek.tsx` |
| Due date mutation | `apps/web/app/(workspace)/calendar/actions.ts` (`updateTaskDueDateAction`) |
| Cross-link event ↔ task | `apps/web/features/calendar-product/event-cross-links.tsx` |

---

## Part 8 — Tasks ↔ Calendar continuity (separate products, less friction)

*Codebase audit (2026-07-24). Implements user research Part 3 #1 (task ↔ calendar unification) **without** merging F-03 and F-04.*

### 8.1 Architecture principle (non-negotiable)

Planevo is an **ecosystem**, not a kernel:

| Product | Owns | Route |
|---------|------|-------|
| **Tasks (F-03)** | `tasks` — title, status, priority, `due_at`, subtasks | `/tasks` |
| **Calendar (F-04)** | `calendars`, `calendar_events` — time blocks, meetings | `/calendar` |
| **Handshake** | `calendar_events.task_id` → `tasks.id`; F-02 `workspace_links` optional | Cross-link actions |

Community “unification” means **one mental model for the day**, not one database. Amie/Akiflow merge the UI; Planevo merges the **workflow** through links, composition, and closed loops.

**Two explicit time concepts (must stay distinct in UI):**

| Concept | Field / row | Meaning | Typical gesture |
|---------|-------------|---------|-----------------|
| **Due** | `tasks.due_at` | “Finish by this day” | Month task chip; drag in month moves due date |
| **Scheduled** | `calendar_events` + `task_id` | “I blocked time to do this” | Drag from planning rail → week grid; Tasks **Schedule** button |

Scheduling via `schedule_task_idempotent` creates a **calendar event**; it does **not** automatically update `due_at`. That is correct separation — the bug is missing UI that explains both.

### 8.2 What is already built

| User expectation | Planevo today | Implementation |
|------------------|---------------|----------------|
| See tasks on calendar | ✅ | `taskDues` merged in `loadCalendarWeek`; month chips via `taskDueToMonthItem` |
| Mark done from calendar | ✅ | `month-item-chip.tsx`, `month-day-agenda-popover.tsx` → `onToggleTask` |
| Move due date on calendar | ✅ | Month drag → `moveItemToDay` → `updateTaskDueDateAction` |
| Block time for task | ✅ | Planning rail drag → `scheduleTaskFromDrag` → `schedule_task_idempotent` |
| Schedule from Tasks | ✅ | `TaskCrossLinkActions` → `scheduleProductTaskAction` (modal: date + times) |
| Link event ↔ task | ✅ | `EventCrossLinkDialogs` / `linkTaskToEventAction` |
| Link to workspace | ✅ | Both products via F-02 helpers |
| Global search | ✅ | Spotlight scopes `tasks` / `calendar` |
| Quick add in calendar context | ✅ | `calendar-tasks-section.tsx` buckets (week / month / unscheduled) |

The **data model and RPC layer are sound.** Gaps are almost entirely **UI closure** and **render rules**.

### 8.3 Where it still feels like two apps

#### Gap 1 — Two meanings of “on the calendar” are invisible

Users may not distinguish **due** vs **scheduled**. A task can appear as a due chip and separately as a timed event (or only one). Nothing in Tasks explains the difference.

**Fix:** Always label — **Due** on month chips; **Scheduled** on linked event blocks. Task peek shows both lines when applicable.

#### Gap 2 — Calendar → Tasks loop is incomplete

`task_id` is stored on events but **not used in calendar UI**:

- `event-block.tsx` — no task styling  
- `event-peek.tsx` — “Link task” only; no **Open task** / complete when linked  
- No grep hits for `task_id` under `calendar-product/`

**Fix:** Event peek becomes the calendar-side mirror of task peek: show linked task, toggle done, deep link to `/tasks`.

#### Gap 3 — Tasks → Calendar loop is buried

Schedule lives under **Connect** in task peek behind a full modal. Research ranks **drag-to-schedule** and **one-gesture schedule** as top wishes.

**Fix:** Inline scheduled summary on task card/row; quick schedule presets; toast with **View on calendar**.

#### Gap 4 — Month vs week gestures differ (confusing)

| Surface | Drag task | Effect |
|---------|-----------|--------|
| Month | Task chip | Updates **`due_at`** |
| Week | Planning rail task | Creates **scheduled block** |

Power users may understand; most will not.

**Fix:** Copy and first-run hints. Optional: drop task chip on week grid → chooser “Set due date” / “Schedule time block.”

#### Gap 5 — Tasks never show calendar state

Task list/card/peek shows `due_at` only — not “2:00 PM block exists.”

**Fix:** Read `calendar_events` by `task_id` in task queries or a small companion query; display read-only scheduled line.

#### Gap 6 — Duplicate display

`toMonthItems` merges `taskDues` and `events` with no rule: if task has linked event in range, user may see **chip + block**.

**Fix:** Render-layer dedup (Part 6 Phase F1 #3).

#### Gap 7 — Weak cross-navigation

Toasts say “Scheduled on your calendar” with no jump. Task chips don’t open task peek from calendar (month opens agenda, not task detail).

**Fix:** Deep links; optional task peek from calendar chip click (secondary to checkbox).

### 8.4 Mapping research to separate-product solutions

| Research rank (Part 3) | User want | Planevo answer (no merger) |
|------------------------|-----------|----------------------------|
| #1 Task ↔ calendar unification | See work + meetings together | Composed calendar view + planning rail; Tasks stays `/tasks` |
| #1 Drag-to-time-block | Block time | ✅ Week drag; expose + lighten from Tasks |
| #1 Mark done on calendar | ✅ Checkbox exists; extend to linked events |
| #2 Multi-calendar pane | Calendar product scope | Unchanged |
| #3 NLP create | Later F-15; optional “also schedule” step | Tasks insert + optional Calendar RPC |
| #8 Keyboard-first | Phase A–C shortcuts | Includes `S` schedule task |
| #10 AI suggests, human approves | Present-not-pushy AI | Suggest slots; user confirms schedule RPC |

**Anti-patterns to avoid:** single task-event row; editing task canonical fields only in calendar; autopilot reshuffle across both products.

### 8.5 Tier summary (priority)

**Tier 1 — They talk to each other** (Phase F1): linked event affordances, scheduled line on tasks, dedup, deep links.

**Tier 2 — One workflow** (Phase F2): quick schedule, visual distinction, `S` shortcut, due/scheduled copy.

**Tier 3 — Power** (Phase F3): due-from-calendar cell, spotlight schedule, estimate duration, capture + block.

See **Part 6 — Phase F** for acceptance criteria and file map.

---

## Part 7 — Research sources index

### Official Google
- https://support.google.com/calendar/answer/37034  
- https://support.google.com/calendar/answer/37034?co=GENIE.Platform%3DAndroid  
- https://support.google.com/calendar/answer/6101541  
- https://support.google.com/calendar/answer/72143  
- https://support.google.com/calendar/answer/16271522  
- https://workspaceupdates.googleblog.com/2022/09/google-calendar-announce-shortcuts%20.html  

### Forums & community (shortcuts)
- https://learn.microsoft.com/en-us/answers/questions/5580285/new-outlook-hasnt-ported-over-old-outlook-shortcut  
- https://techcrunch.com/2025/08/13/google-ceo-adds-a-new-calendar-feature-at-stripe-co-founders-request/ (duplicate shortcut)  
- https://feedback.morgen.so/p/have-a-keyboard-shortcut-for-moving-or-resizing-selected-eventscalendar  
- https://feedback.morgen.so/p/customizable-keyboard-shortcuts  
- https://medium.com/@iampariah/love-notion-hate-notion-calendar-c78c76ecf2ad  
- https://flexibits.com/fantastical/help/keyboard-shortcuts  
- https://protonmail.uservoice.com/forums/932842-proton-calendar/suggestions/42356536-keyboard-shortcuts  
- https://news.ycombinator.com/item?id=34335821 (Grila)  
- https://news.ycombinator.com/item?id=29307245 (Linux quick-add)  
- https://news.ycombinator.com/item?id=36428797 (template week wish)  
- https://news.ycombinator.com/item?id=39030375 (Notion Calendar)  
- https://community.notionapps.com/t/monthly-view-on-notion-calendar-mobile/909  
- https://community.getmailspring.com/t/keyboard-shortcuts-menubar-buttons-for-contacts-and-calendar/893  
- https://talk.macpowerusers.com/t/grila-a-calendar-for-keyboard-adicts-always-one-keypress-away/31581  

### Comparisons & reviews
- https://www.morgen.so/blog-posts/fantastical-vs-google-calendar  
- https://toolfinder.com/comparisons/google-calendar-vs-fantastical  
- https://temporal.day/blog/ai-scheduling-out-of-control  
- https://temporal.day/blog/morgen-vs-akiflow-2026  

### Open source
- https://github.com/JohannesKlauss/react-hotkeys-hook  
- https://github.com/jamiebuilds/tinykeys  
- https://github.com/wanasit/chrono  
- https://github.com/calcom/cal.com  

### Planevo internal
- `docs/planevo-feature-spec.md` § F-03, F-04, F-02  
- `docs/superpowers/specs/2026-07-24-calendar-month-view-design.md` § Interactions  
- `apps/web/features/calendar-product/month-grid.tsx`  
- `apps/web/features/tasks-product/cross-link-actions.tsx`  
- `packages/core/src/mutations/task-cross-links.ts`  
- `handoff.md` (month view rebuild status)  

---

## Appendix A — Planevo shortcut proposal (target state)

*Not shipped — design target after Phase A+B.*

| Key | Action | Scope |
|-----|--------|-------|
| `?` | Open shortcut cheat sheet | Global |
| `c` or `⌘N` | Create event at selection / now | Global |
| `t` | Go to today | Global |
| `d` / `w` / `m` | Day / week / month view | Global |
| `j` / `k` | Next / previous period | Global |
| `g` | Go to date… | Global |
| `/` | Focus search / spotlight (Calendar) | Global |
| `e` | Edit focused event | Event selected |
| `Delete` | Delete focused event (confirm) | Event selected |
| `Esc` | Close peek / popover / dialog | Context |
| `Enter` | Open day agenda (month) | Month grid |
| `←→↑↓` | Move day focus | Month grid |
| `PgUp`/`PgDn` | ±1 month | Month grid |
| `S` | Schedule selected task | Tasks sidebar focused |
| `N` | New task | Tasks sidebar focused |
| `⌘D` | Duplicate selected event | Event selected |
| `⌘K` | Planevo spotlight | Shell (existing) |

*No join-meeting shortcut in V1 target keymap.*

---

## Appendix B — Agent execution log

| Agent | ID | Status | Output |
|-------|-----|--------|--------|
| Google Calendar shortcuts scrape | [b9abcc8e-ef03-43b2-84d5-8dcf56482b30](b9abcc8e-ef03-43b2-84d5-8dcf56482b30) | ✅ Complete | Part 1 (incl. Android map, RSVP, Announce Shortcuts) |
| Wished-for calendar shortcuts | [241ce422-d29c-4d6c-8b35-851067588f3a](241ce422-d29c-4d6c-8b35-851067588f3a) | ✅ Complete | Part 2 |
| Wished-for calendar features | [ad8742cd-1734-4ae6-94c7-4acdd2b2a22d](ad8742cd-1734-4ae6-94c7-4acdd2b2a22d) | ✅ Complete | Part 3 |

*Earlier duplicate agent dispatches hit API limits; final successful runs above.*

---

*Next step after approval:*

1. **Keyboard shortcuts** — invoke **writing-plans** → `docs/superpowers/plans/2026-07-24-calendar-keyboard-shortcuts.md`  
2. **Tasks ↔ Calendar continuity** — invoke **writing-plans** → `docs/superpowers/plans/2026-07-24-tasks-calendar-continuity.md` (Phase F)
