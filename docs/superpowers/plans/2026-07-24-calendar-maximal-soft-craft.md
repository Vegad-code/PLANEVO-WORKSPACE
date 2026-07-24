# Calendar Maximal Soft Craft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply Maximal soft GCal-like craft to the Calendar week/day grid — 24px shell, stacked day headers with ocean today disc, pill toolbar controls, and pill event blocks — without changing create/persist behavior.

**Architecture:** Extract a pure day-header model helper (testable). Skin FullCalendar via custom `dayHeaderContent` + `.planevo-fc` token CSS. Soften toolbar radii with `rounded-full` / ink active state. Keep all-day Union Council rules (thin unlabeled band, `selectAllow: !allDay`).

**Tech Stack:** Next.js App Router, React 19, FullCalendar 6.1.x (`@fullcalendar/react` + timegrid), Tailwind + CSS custom properties in `globals.css`, Node test runner (`node --test`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-24-calendar-maximal-soft-craft-design.md`
- Tokens only — no hardcoded hex / arbitrary px in components
- Today accent = `ocean` only; toolbar = ink/neutral; **zero marigold** on calendar chrome
- Shell radius `24px`; control/event radii `999px`; today disc `1.75rem`
- Craft-only — no all-day create/persist, no year-view redesign, no Planning rail layout changes
- Preserve ResizeObserver → `updateSize()` and all-day `sr-only` / `selectAllow` behavior
- No competitor names in UI copy

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/web/lib/calendar/day-header-model.ts` | Pure helpers: weekday label, date number, is-today, accessible label |
| `apps/web/lib/calendar/day-header-model.test.mjs` | Unit tests for header model |
| `apps/web/app/globals.css` | Calendar radius/size tokens + `.planevo-fc` shell/header/event skin |
| `apps/web/features/calendar-product/calendar-grid-engine.tsx` | `dayHeaderContent`, event pill class |
| `apps/web/features/calendar-product/calendar-toolbar.tsx` | Pill control radii |
| `apps/web/features/calendar-product/calendar-product-view.tsx` | Inset so 24px shell reads |

---

### Task 1: Union Council gate (Craft / Critic / Pragmatist)

**Files:**
- Modify: none (decision log only — append to spec Build gate section if council amends)

**Interfaces:**
- Consumes: locked decisions in the Maximal soft craft spec
- Produces: go / no-go to implement Tasks 2–6 as written

- [ ] **Step 1: Convene three voices against the spec**

Run a short council (subagents or same-session roles) with this brief:

```
Ratify Maximal soft calendar craft:
- --radius-calendar-shell: 24px; control/event 999px; today disc 1.75rem ocean
- Stacked SUN / 24 headers via dayHeaderContent
- Toolbar pills ink-active; ocean only on today
- Preserve all-day Union Council (sr-only, selectAllow !allDay, no :has collapse)
Reject if: marigold on chrome, hex in components, or create-flow scope creep.
Return: APPROVE or REQUEST_CHANGES with exact amendments.
```

- [ ] **Step 2: Record verdict**

If `APPROVE`, proceed. If `REQUEST_CHANGES`, amend the spec + this plan before Task 2 (do not implement rejected items).

- [ ] **Step 3: Commit only if spec/plan amended**

```bash
git add docs/superpowers/specs/2026-07-24-calendar-maximal-soft-craft-design.md \
  docs/superpowers/plans/2026-07-24-calendar-maximal-soft-craft.md
git commit -m "docs: ratify maximal soft craft after Union Council"
```

If no amendments, skip commit and continue.

---

### Task 2: Day header model + unit tests

**Files:**
- Create: `apps/web/lib/calendar/day-header-model.ts`
- Create: `apps/web/lib/calendar/day-header-model.test.mjs`
- Test: `apps/web/lib/calendar/day-header-model.test.mjs`

**Interfaces:**
- Consumes: none
- Produces:
  - `isSameCalendarDay(a: Date, b: Date): boolean`
  - `formatDayHeaderWeekday(date: Date, locale?: string): string` — uppercase short weekday (`SUN`)
  - `formatDayHeaderDayNumber(date: Date): string` — date of month (`24`)
  - `formatDayHeaderAccessibleLabel(date: Date, locale?: string): string` — long weekday + month + day + year
  - `isCalendarToday(date: Date, now?: Date): boolean`

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/calendar/day-header-model.test.mjs`:

```js
import assert from "node:assert/strict"
import test from "node:test"
import {
  formatDayHeaderAccessibleLabel,
  formatDayHeaderDayNumber,
  formatDayHeaderWeekday,
  isCalendarToday,
  isSameCalendarDay,
} from "./day-header-model.ts"

test("isSameCalendarDay ignores time-of-day", () => {
  const a = new Date(2026, 6, 24, 9, 0, 0)
  const b = new Date(2026, 6, 24, 23, 59, 59)
  assert.equal(isSameCalendarDay(a, b), true)
  assert.equal(isSameCalendarDay(a, new Date(2026, 6, 25)), false)
})

test("formatDayHeaderWeekday returns uppercase short weekday", () => {
  assert.equal(formatDayHeaderWeekday(new Date(2026, 6, 24), "en-US"), "FRI")
})

test("formatDayHeaderDayNumber returns day of month", () => {
  assert.equal(formatDayHeaderDayNumber(new Date(2026, 6, 24)), "24")
})

test("isCalendarToday uses local calendar day", () => {
  const now = new Date(2026, 6, 24, 15, 0, 0)
  assert.equal(isCalendarToday(new Date(2026, 6, 24, 0, 0, 0), now), true)
  assert.equal(isCalendarToday(new Date(2026, 6, 23), now), false)
})

test("formatDayHeaderAccessibleLabel includes weekday and date parts", () => {
  const label = formatDayHeaderAccessibleLabel(new Date(2026, 6, 24), "en-US")
  assert.match(label, /Friday/i)
  assert.match(label, /July/i)
  assert.match(label, /24/)
  assert.match(label, /2026/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && node --no-warnings --experimental-strip-types --test lib/calendar/day-header-model.test.mjs`

Expected: FAIL — module not found / exports missing

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/lib/calendar/day-header-model.ts`:

```ts
export const isSameCalendarDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

export const isCalendarToday = (
  date: Date,
  now: Date = new Date(),
): boolean => isSameCalendarDay(date, now)

export const formatDayHeaderWeekday = (
  date: Date,
  locale = "en-US",
): string =>
  date
    .toLocaleDateString(locale, { weekday: "short" })
    .replace(/\./g, "")
    .toUpperCase()

export const formatDayHeaderDayNumber = (date: Date): string =>
  String(date.getDate())

export const formatDayHeaderAccessibleLabel = (
  date: Date,
  locale = "en-US",
): string =>
  date.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && node --no-warnings --experimental-strip-types --test lib/calendar/day-header-model.test.mjs`

Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/calendar/day-header-model.ts \
  apps/web/lib/calendar/day-header-model.test.mjs
git commit -m "feat(web): add calendar day header model helpers"
```

---

### Task 3: Calendar radius tokens + `.planevo-fc` shell skin

**Files:**
- Modify: `apps/web/app/globals.css` (token block near `--radius-card` / `--radius-files-modal`; `.planevo-fc` section)

**Interfaces:**
- Consumes: Maximal soft token table from spec
- Produces: CSS variables + shell/header/event rules used by Tasks 4–5

- [ ] **Step 1: Add tokens next to existing radius tokens**

In `:root` (same block as `--radius-card` / `--radius-files-modal`), add:

```css
  /* Calendar product — Maximal soft (GCal-adjacent craft) */
  --radius-calendar-shell: 24px;
  --radius-calendar-control: 999px;
  --radius-calendar-event: 999px;
  --size-calendar-today-disc: 1.75rem;
```

- [ ] **Step 2: Extend `.planevo-fc` shell + header + event rules**

Append / merge into the existing `.planevo-fc` section (do not remove all-day Union Council rules):

```css
.planevo-fc {
  /* keep existing --fc-* vars and --fc-planevo-allday-min-height */
  border-radius: var(--radius-calendar-shell);
  overflow: hidden;
  border: 1px solid var(--color-border);
  background: var(--color-surface-raised);
}

.planevo-fc .fc-scrollgrid {
  border-radius: inherit;
}

.planevo-fc .fc-col-header-cell-cushion {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  padding-top: 0.5rem;
  padding-bottom: 0.35rem;
  text-decoration: none;
}

.planevo-fc .fc-planevo-day-weekday {
  font-size: var(--text-product-meta);
  font-weight: 500;
  letter-spacing: 0.04em;
  line-height: 1.2;
  color: var(--color-text-muted);
  text-transform: uppercase;
}

.planevo-fc .fc-planevo-day-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--size-calendar-today-disc);
  min-height: var(--size-calendar-today-disc);
  padding-inline: 0.2rem;
  font-size: var(--text-product-body);
  font-weight: 600;
  line-height: 1;
  color: var(--color-ink);
  border-radius: var(--radius-calendar-control);
}

.planevo-fc .fc-col-header-cell.fc-day-today .fc-planevo-day-weekday {
  color: var(--color-ocean);
}

.planevo-fc .fc-col-header-cell.fc-day-today .fc-planevo-day-number {
  background: var(--color-ocean);
  color: var(--color-paper);
}

.planevo-fc .fc-planevo-event-inner {
  border-radius: var(--radius-calendar-event);
}
```

Remove or override any prior rule that forced today header to plain ink weight without the disc (e.g. old `.fc-col-header-cell.fc-day-today .fc-col-header-cell-cushion` color-only rule) so it does not fight the new classes.

- [ ] **Step 3: Visual smoke (manual)**

Run the web app, open `/calendar` week view. Expect: rounded panel clip even before custom headers land (default “19 Sun” may still show until Task 4).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "feat(web): add maximal soft calendar radius shell tokens"
```

---

### Task 4: Custom `dayHeaderContent` in grid engine

**Files:**
- Modify: `apps/web/features/calendar-product/calendar-grid-engine.tsx`
- Consumes: `apps/web/lib/calendar/day-header-model.ts`

**Interfaces:**
- Consumes: `formatDayHeaderWeekday`, `formatDayHeaderDayNumber`, `formatDayHeaderAccessibleLabel`, `isCalendarToday`
- Produces: GCal-like stacked headers with ocean today disc (CSS from Task 3)

- [ ] **Step 1: Import helpers and add header renderer**

Near top of `calendar-grid-engine.tsx`, add imports:

```ts
import type { DayHeaderContentArg } from "@fullcalendar/core"
import {
  formatDayHeaderAccessibleLabel,
  formatDayHeaderDayNumber,
  formatDayHeaderWeekday,
} from "@/lib/calendar/day-header-model"
```

Add component (above `CalendarGridEngine`):

```tsx
function PlanevoDayHeader({ arg }: { arg: DayHeaderContentArg }) {
  const date = arg.date
  const label = formatDayHeaderAccessibleLabel(date)
  return (
    <span
      className="fc-planevo-day-header flex flex-col items-center gap-0.5"
      aria-label={label}
      aria-current={arg.isToday ? "date" : undefined}
    >
      <span className="fc-planevo-day-weekday" aria-hidden="true">
        {formatDayHeaderWeekday(date)}
      </span>
      <span className="fc-planevo-day-number" aria-hidden="true">
        {formatDayHeaderDayNumber(date)}
      </span>
    </span>
  )
}
```

- [ ] **Step 2: Wire FullCalendar props**

On `<FullCalendar />`:

- Set `dayHeaderContent={(arg) => <PlanevoDayHeader arg={arg} />}`
- Remove `dayHeaderFormat={{ weekday: "short", day: "numeric" }}` (custom content replaces it)

Keep: `allDaySlot`, `allDayContent` sr-only, `selectAllow={(arg) => !arg.allDay}`, `stickyHeaderDates`, ResizeObserver effect.

- [ ] **Step 3: Soften event inner radius class**

In `PlanevoEventContent`, change `rounded-md` to a class that defers to CSS (keep Tailwind out of fighting the token):

```tsx
"fc-planevo-event-inner flex h-full min-h-0 flex-col overflow-hidden border-l-[3px] px-1.5 py-0.5"
```

(Radius comes from `.planevo-fc .fc-planevo-event-inner` in Task 3.)

- [ ] **Step 4: Manual verify**

Open `/calendar` week + day:

- Headers show `SUN` over `19` (not `19 Sun`)
- Today disc is ocean with contrasting number
- Today weekday is ocean
- All-day band still thin/unlabeled; click does not open timed create

- [ ] **Step 5: Commit**

```bash
git add apps/web/features/calendar-product/calendar-grid-engine.tsx
git commit -m "feat(web): render GCal-like stacked calendar day headers"
```

---

### Task 5: Toolbar pill radii

**Files:**
- Modify: `apps/web/features/calendar-product/calendar-toolbar.tsx`

**Interfaces:**
- Consumes: `--radius-calendar-control` via Tailwind `rounded-full` (maps to 999px; matches token intent)
- Produces: pill Today / chevrons / view group / Filter; ink active view (not ocean)

- [ ] **Step 1: Update control classNames**

Replace radii as follows (keep borders, focus rings, ink active):

| Control | From | To |
|---------|------|-----|
| Today button | `rounded-lg` | `rounded-full` |
| Prev/Next | `rounded-lg` | `rounded-full` |
| View group shell | `rounded-lg` | `rounded-full` |
| View option | `rounded-md` | `rounded-full` |
| Filter button | `rounded-lg` | `rounded-full` |

Active view stays `bg-paper text-ink` (or existing ink treatment) — **do not** use `bg-ocean` / marigold.

Leave timezone chip as-is if already `rounded-full`. Filter dropdown panel may stay `rounded-lg` (menu, not a primary chrome chip).

- [ ] **Step 2: Manual verify**

Toolbar chips look pill-shaped; Week selected is ink/paper, not ocean; today disc remains the only ocean accent on the page chrome+grid.

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/calendar-product/calendar-toolbar.tsx
git commit -m "feat(web): pillify calendar toolbar controls"
```

---

### Task 6: Product view inset + final verification

**Files:**
- Modify: `apps/web/features/calendar-product/calendar-product-view.tsx` (grid wrapper around `CalendarGridEngine`)

**Interfaces:**
- Consumes: shell from Task 3
- Produces: inset so 24px radius is visible against surrounding chrome

- [ ] **Step 1: Ensure grid wrapper gives the shell room**

Locate the week/day mount (approx. `px-4 pt-1 pb-4` wrapper). Ensure padding remains (or use `px-4 pb-4 pt-2`) so the bordered 24px shell is not flush against the viewport edge. Do not change Planning rail width logic.

Example target wrapper:

```tsx
<div className="flex min-h-0 flex-1 flex-col px-4 pt-2 pb-4">
  {view === "year" ? (
    /* YearView unchanged */
  ) : (
    <CalendarGridEngine
      className="min-h-0 flex-1"
      /* existing props */
    />
  )}
</div>
```

- [ ] **Step 2: Run unit tests**

Run: `cd apps/web && node --no-warnings --experimental-strip-types --test lib/calendar/*.test.mjs`

Expected: PASS (includes `day-header-model` + existing calendar tests)

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json`

Expected: exit 0

- [ ] **Step 4: Manual acceptance checklist**

- [ ] Week + day: stacked headers, ocean today disc (`1.75rem`), 24px shell clips grid
- [ ] Events read as pills; left color bar intact
- [ ] Toolbar pills; active view ink; no marigold; ocean only on today
- [ ] Select / drag / resize / peek / Planning → schedule still work
- [ ] Planning collapse still reflows grid (`updateSize`)
- [ ] All-day band thin + unlabeled; no timed create from all-day select

- [ ] **Step 5: Commit**

```bash
git add apps/web/features/calendar-product/calendar-product-view.tsx
git commit -m "feat(web): inset calendar grid for maximal soft shell"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| `--radius-calendar-shell: 24px` | Task 3 |
| `--radius-calendar-control / event: 999px` | Tasks 3, 5 |
| `--size-calendar-today-disc: 1.75rem` | Task 3 |
| Stacked SUN / date headers | Tasks 2, 4 |
| Ocean today disc + weekday | Tasks 3, 4 |
| Shell overflow clip + border | Task 3 |
| Event pills | Tasks 3, 4 |
| Toolbar pills, ink active | Task 5 |
| Product inset | Task 6 |
| Preserve all-day council rules | Tasks 1, 4 |
| A11y `aria-current` + accessible label | Tasks 2, 4 |
| Zero marigold / ocean-only accent | Tasks 1, 5, 6 |
| Union Council build gate | Task 1 |
| Out of scope (create, year, planning IA) | All tasks — not scheduled |

No placeholders remaining after self-review.
