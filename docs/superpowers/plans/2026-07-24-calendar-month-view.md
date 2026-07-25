# Calendar Month View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Planevo-skinned Month view in the Calendar product using react-big-calendar, with overlap event loading, day agenda popover, and maximal soft craft tokens.

**Architecture:** Extend existing RBC `CalendarGridEngine` with `month` view; wire `month` through toolbar/URL/navigation/motion/query keys; fix data layer with overlap query for 42-day windows; add `MonthDayAgendaPopover` for day-click (stay in month) and explicit "Open day" drill-down. Skin via `.planevo-rbc--month` in `globals.css`.

**Tech Stack:** Next.js App Router, React 19, react-big-calendar 1.20.x + DnD addon, date-fns localizer, TanStack Query, Tailwind + CSS custom properties, Node test runner (`node --test`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-24-calendar-month-view-design.md`
- Tokens only — no hardcoded hex / arbitrary px in components
- Today accent = ocean only on today date disc; toolbar = ink/neutral; **zero marigold** on calendar chrome
- Shell radius `24px`; event chips use `--radius-calendar-event`
- Week start Sunday; month grid = 6 weeks (42 days) per `calendar-range.ts`
- Day click → day agenda popover (URL stays `view=month`); "Open day" or double-click → day view
- Month DnD out of scope — disable drag/resize in month view
- No competitor names in UI copy
- Preserve week/day behavior regressions (peek, create, move/resize)

---

## File map

| File | Responsibility |
|------|----------------|
| `packages/core/src/queries/product-calendar.ts` | Overlap event query when `eventRange: 'overlaps'` |
| `packages/core/src/queries/product-calendar.test.mjs` | Overlap query tests |
| `apps/web/lib/calendar/calendar-navigation.ts` | `month` in `CalendarToolbarView`; step/title |
| `apps/web/lib/calendar/calendar-navigation.test.mjs` | Month nav tests |
| `apps/web/lib/calendar/calendar-nav-motion.ts` | `month-YYYY-MM` transition key |
| `apps/web/lib/calendar/calendar-query-keys.test.mjs` | Month query key window test |
| `apps/web/lib/calendar/fetch-calendar-page-data.ts` | Pass `eventRange: 'overlaps'` when `view === 'month'` |
| `apps/web/lib/calendar/month-day-events.ts` | Pure filter: events overlapping a calendar day |
| `apps/web/lib/calendar/month-day-events.test.mjs` | Day overlap filter tests |
| `apps/web/features/calendar-product/calendar-toolbar.tsx` | Add Month to view menu + aria labels |
| `apps/web/features/calendar-product/use-calendar-navigation.ts` | `month` in URL parser |
| `apps/web/features/calendar-product/rbc-month-date-cell.tsx` | Date number + today disc in month cell |
| `apps/web/features/calendar-product/month-day-agenda-popover.tsx` | Day event list + Open day CTA |
| `apps/web/features/calendar-product/calendar-grid-engine.tsx` | RBC month view wiring |
| `apps/web/app/globals.css` | `.planevo-rbc--month` skin |

---

### Task 1: Overlap event query (data layer)

**Files:**
- Modify: `packages/core/src/queries/product-calendar.ts`
- Modify: `packages/core/src/queries/product-calendar.test.mjs`

**Interfaces:**
- Consumes: none
- Produces:
  - `LoadCalendarWeekOptions.eventRange?: 'starts-in' | 'overlaps'` (default `'starts-in'`)
  - When `'overlaps'`: query `starts_at < end AND ends_at > start`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/queries/product-calendar.test.mjs`:

```js
test("loadCalendarWeek overlap mode queries events that span into range", async () => {
  const events = [
    {
      id: "e-span",
      calendar_id: "c1",
      user_id: "u1",
      title: "Spans in",
      starts_at: "2026-06-28T09:00:00.000Z",
      ends_at: "2026-07-02T09:00:00.000Z",
      all_day: false,
      location: null,
      description_json: {},
      task_id: null,
      google_event_id: null,
      source: "planevo",
      created_at: "",
      updated_at: "",
    },
  ];
  const range = {
    start: new Date(2026, 6, 1),
    end: new Date(2026, 6, 8),
  };
  const filters = {};
  const client = {
    from(table) {
      if (table === "calendars") return calendarsTable(CALENDAR_ROWS);
      if (table === "calendar_events") {
        return {
          select: () => ({
            eq: () => ({
              lt: (_col, ltVal) => {
                filters.startsLt = ltVal;
                return {
                  gt: (_col2, gtVal) => {
                    filters.endsGt = gtVal;
                    return { order: async () => ({ data: events, error: null }) };
                  },
                };
              },
              gte: (_col, gteVal) => ({
                lt: (_col2, ltVal) => {
                  filters.startsGte = gteVal;
                  filters.startsLtLegacy = ltVal;
                  return { order: async () => ({ data: [], error: null }) };
                },
              }),
            }),
          }),
        };
      }
      if (table === "tasks") {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                lt: () => ({ order: async () => ({ data: [], error: null }) }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  await loadCalendarWeek(client, "u1", { ...range, eventRange: "overlaps" });
  assert.equal(filters.startsLt, range.end.toISOString());
  assert.equal(filters.endsGt, range.start.toISOString());
  assert.equal(filters.startsGte, undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test packages/core/src/queries/product-calendar.test.mjs`
Expected: FAIL — `eventRange` not recognized / wrong query chain

- [ ] **Step 3: Implement overlap query**

In `packages/core/src/queries/product-calendar.ts`, extend options and branch the event query:

```ts
export type LoadCalendarWeekOptions = {
  start: Date;
  end: Date;
  workspaceId?: string;
  /** Default `starts-in`. Use `overlaps` for month grid (multi-day bars). */
  eventRange?: "starts-in" | "overlaps";
};

// inside loadCalendarWeek, replace the event query block:
const eventRange = options.eventRange ?? "starts-in";

let eventQuery = client
  .from("calendar_events")
  .select("*")
  .eq("user_id", userId);

if (eventRange === "overlaps") {
  eventQuery = eventQuery
    .lt("starts_at", endIso)
    .gt("ends_at", startIso);
} else {
  eventQuery = eventQuery
    .gte("starts_at", startIso)
    .lt("starts_at", endIso);
}
```

- [ ] **Step 4: Run tests**

Run: `node --test packages/core/src/queries/product-calendar.test.mjs`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/queries/product-calendar.ts packages/core/src/queries/product-calendar.test.mjs
git commit -m "feat(calendar): add overlap event query for month view"
```

---

### Task 2: Month day event filter (pure helper)

**Files:**
- Create: `apps/web/lib/calendar/month-day-events.ts`
- Create: `apps/web/lib/calendar/month-day-events.test.mjs`

**Interfaces:**
- Consumes: `CalendarEventRow[]` from `@planevo/core/types/calendar`
- Produces:
  - `eventsForCalendarDay(events: CalendarEventRow[], day: Date): CalendarEventRow[]`
  - `sortEventsByStart(events: CalendarEventRow[]): CalendarEventRow[]`

- [ ] **Step 1: Write the failing test**

Create `apps/web/lib/calendar/month-day-events.test.mjs`:

```js
import assert from "node:assert/strict"
import test from "node:test"
import { eventsForCalendarDay } from "./month-day-events.ts"

const spanning = {
  id: "e1",
  calendar_id: "c1",
  user_id: "u1",
  title: "Conference",
  starts_at: "2026-07-01T09:00:00.000Z",
  ends_at: "2026-07-05T17:00:00.000Z",
  all_day: false,
  location: null,
  description_json: {},
  task_id: null,
  google_event_id: null,
  source: "planevo",
  created_at: "",
  updated_at: "",
}

test("eventsForCalendarDay includes multi-day events active on that day", () => {
  const day = new Date(2026, 6, 3)
  const result = eventsForCalendarDay([spanning], day)
  assert.equal(result.length, 1)
  assert.equal(result[0].title, "Conference")
})

test("eventsForCalendarDay excludes events that ended before the day", () => {
  const day = new Date(2026, 6, 10)
  const result = eventsForCalendarDay([spanning], day)
  assert.equal(result.length, 0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/web/lib/calendar/month-day-events.test.mjs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Create `apps/web/lib/calendar/month-day-events.ts`:

```ts
import type { CalendarEventRow } from "@planevo/core/types/calendar"

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

/** Events that overlap [day 00:00, next day 00:00) in local time. */
export function eventsForCalendarDay(
  events: CalendarEventRow[],
  day: Date,
): CalendarEventRow[] {
  const windowStart = startOfDay(day)
  const windowEnd = addDays(windowStart, 1)
  return events
    .filter((event) => {
      const start = new Date(event.starts_at)
      const end = new Date(event.ends_at)
      return start < windowEnd && end > windowStart
    })
    .sort(
      (a, b) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    )
}
```

- [ ] **Step 4: Run test**

Run: `node --test apps/web/lib/calendar/month-day-events.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/calendar/month-day-events.ts apps/web/lib/calendar/month-day-events.test.mjs
git commit -m "feat(calendar): add month day event filter helper"
```

---

### Task 3: Navigation, motion, fetch, and query keys for month

**Files:**
- Modify: `apps/web/lib/calendar/calendar-navigation.ts`
- Modify: `apps/web/lib/calendar/calendar-navigation.test.mjs`
- Modify: `apps/web/lib/calendar/calendar-nav-motion.ts`
- Modify: `apps/web/lib/calendar/calendar-query-keys.test.mjs`
- Modify: `apps/web/lib/calendar/fetch-calendar-page-data.ts`
- Modify: `apps/web/features/calendar-product/calendar-toolbar.tsx`
- Modify: `apps/web/features/calendar-product/use-calendar-navigation.ts`

**Interfaces:**
- Consumes: `LoadCalendarWeekOptions.eventRange` from Task 1
- Produces:
  - `CalendarToolbarView` includes `"month"`
  - `stepAnchor("month", …)` steps ±1 calendar month
  - `formatToolbarTitle(anchor, "month")` → `"July 2026"`
  - `calendarTransitionKey("month", anchor)` → `"month-2026-07"`
  - `fetchCalendarPageData` passes `eventRange: 'overlaps'` when `view === 'month'`
  - `CALENDAR_VIEWS = ["day", "week", "month", "year"]`

- [ ] **Step 1: Write failing navigation tests**

Append to `apps/web/lib/calendar/calendar-navigation.test.mjs`:

```js
test("month step moves anchor by 1 calendar month", () => {
  const anchor = new Date(2026, 6, 24)
  const next = stepAnchor("month", anchor, 1)
  assert.equal(next.getFullYear(), 2026)
  assert.equal(next.getMonth(), 7)
  assert.equal(next.getDate(), 24)
})

test("formatToolbarTitle month", () => {
  const title = formatToolbarTitle(friJul24, "month")
  assert.equal(title, "July 2026")
})
```

Append to `apps/web/lib/calendar/calendar-query-keys.test.mjs`:

```js
test("month view key spans 42-day grid window", () => {
  const key = calendarQueryKey("all", "month", anchor)
  assert.equal(key[2], "month")
  assert.equal(key[3], "2026-06-28")
  assert.equal(key[4], "2026-08-09")
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test apps/web/lib/calendar/calendar-navigation.test.mjs apps/web/lib/calendar/calendar-query-keys.test.mjs`
Expected: FAIL on month cases

- [ ] **Step 3: Implement navigation + motion**

In `calendar-navigation.ts`:

```ts
export type CalendarToolbarView = "day" | "week" | "month" | "year"

const TOOLBAR_VIEWS = new Set<CalendarToolbarView>([
  "day",
  "week",
  "month",
  "year",
])

// in stepAnchor, before year branch:
if (view === "month") {
  return new Date(
    normalized.getFullYear(),
    normalized.getMonth() + direction,
    normalized.getDate(),
  )
}

// in formatToolbarTitle, after year branch:
if (view === "month") {
  return normalized.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  })
}
```

In `calendar-nav-motion.ts`:

```ts
if (view === "month") {
  const year = anchor.getFullYear()
  const month = String(anchor.getMonth() + 1).padStart(2, "0")
  return `month-${year}-${month}`
}
```

In `calendar-toolbar.tsx`:

```ts
export const CALENDAR_VIEWS = ["day", "week", "month", "year"] as const

export const VIEW_LABELS: Record<CalendarView, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
}
```

Update prev/next `aria-label` ternary to include month: `"Previous month"` / `"Next month"`.

In `use-calendar-navigation.ts`:

```ts
const viewParser = parseAsStringLiteral([
  "day",
  "week",
  "month",
  "year",
]).withDefault("week")
```

In `fetch-calendar-page-data.ts`, inside `fetchCalendarPageData`:

```ts
const [week, tasks] = await Promise.all([
  loadCalendarWeek(access.client, access.ownerId, {
    start,
    end,
    eventRange: view === "month" ? "overlaps" : "starts-in",
    ...workspaceFilter,
  }),
  // ...
])
```

- [ ] **Step 4: Run tests**

Run: `node --test apps/web/lib/calendar/calendar-navigation.test.mjs apps/web/lib/calendar/calendar-query-keys.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/calendar/calendar-navigation.ts \
  apps/web/lib/calendar/calendar-navigation.test.mjs \
  apps/web/lib/calendar/calendar-nav-motion.ts \
  apps/web/lib/calendar/calendar-query-keys.test.mjs \
  apps/web/lib/calendar/fetch-calendar-page-data.ts \
  apps/web/features/calendar-product/calendar-toolbar.tsx \
  apps/web/features/calendar-product/use-calendar-navigation.ts
git commit -m "feat(calendar): wire month view through navigation and data fetch"
```

---

### Task 4: Month date cell component

**Files:**
- Create: `apps/web/features/calendar-product/rbc-month-date-cell.tsx`

**Interfaces:**
- Consumes: `day-header-model` helpers (`formatDayHeaderDayNumber`, `formatDayHeaderAccessibleLabel`, `isCalendarToday`)
- Produces: `RbcMonthDateCell` — used as RBC `components.month.dateHeader`

- [ ] **Step 1: Create component**

Create `apps/web/features/calendar-product/rbc-month-date-cell.tsx`:

```tsx
"use client"

import type { DateHeaderProps } from "react-big-calendar"
import {
  formatDayHeaderAccessibleLabel,
  formatDayHeaderDayNumber,
  isCalendarToday,
} from "@/lib/calendar/day-header-model"
import { cn } from "@/lib/utils"

type RbcMonthDateCellProps = DateHeaderProps & {
  now: Date
}

export function RbcMonthDateCell({ date, label, now }: RbcMonthDateCellProps) {
  const isToday = isCalendarToday(date, now)
  const isOffRange = label !== "current"

  return (
    <div
      className={cn(
        "flex justify-end px-2 pt-2",
        isOffRange && "text-text-muted",
      )}
      aria-label={formatDayHeaderAccessibleLabel(date)}
      aria-current={isToday ? "date" : undefined}
    >
      <span
        className={cn(
          "calendar-day-number inline-flex min-w-[var(--size-calendar-today-disc)] items-center justify-center",
          isToday && "calendar-day-number--today",
        )}
      >
        {formatDayHeaderDayNumber(date)}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -20`
Expected: no errors in `rbc-month-date-cell.tsx`

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/calendar-product/rbc-month-date-cell.tsx
git commit -m "feat(calendar): add month date cell with today disc"
```

---

### Task 5: Month day agenda popover

**Files:**
- Create: `apps/web/features/calendar-product/month-day-agenda-popover.tsx`

**Interfaces:**
- Consumes:
  - `eventsForCalendarDay` from `month-day-events.ts`
  - `CalendarEventRow`, `CalendarRow` types
  - `formatDayHeaderAccessibleLabel` for title
- Produces:
  - `MonthDayAgendaPopover` with props:
    - `date: Date`
    - `events: CalendarEventRow[]`
    - `calendars: CalendarRow[]`
    - `anchorRect: DOMRect | null`
    - `onClose: () => void`
    - `onOpenDay: (date: Date) => void`
    - `onSelectEvent: (event: CalendarEventRow, anchor: HTMLElement) => void`

- [ ] **Step 1: Create popover component**

Create `apps/web/features/calendar-product/month-day-agenda-popover.tsx`:

```tsx
"use client"

import { useEffect, useMemo, useRef } from "react"
import type { CalendarEventRow, CalendarRow } from "@planevo/core/types/calendar"
import { formatDayHeaderAccessibleLabel } from "@/lib/calendar/day-header-model"
import { eventsForCalendarDay } from "@/lib/calendar/month-day-events"
import { cn } from "@/lib/utils"
import { formatTimeLabel } from "./time-axis"

type MonthDayAgendaPopoverProps = {
  date: Date
  events: CalendarEventRow[]
  calendars: CalendarRow[]
  anchorRect: DOMRect | null
  onClose: () => void
  onOpenDay: (date: Date) => void
  onSelectEvent: (event: CalendarEventRow, anchor: HTMLElement) => void
}

export function MonthDayAgendaPopover({
  date,
  events,
  calendars,
  anchorRect,
  onClose,
  onOpenDay,
  onSelectEvent,
}: MonthDayAgendaPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const colorByCalendarId = useMemo(
    () => new Map(calendars.map((c) => [c.id, c.color] as const)),
    [calendars],
  )
  const dayEvents = useMemo(
    () => eventsForCalendarDay(events, date),
    [events, date],
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  useEffect(() => {
    panelRef.current?.focus()
  }, [date])

  const top = anchorRect ? anchorRect.bottom + 8 : 80
  const left = anchorRect
    ? Math.min(anchorRect.left, window.innerWidth - 280)
    : 80

  return (
    <>
      <button
        type="button"
        aria-label="Close day agenda"
        className="fixed inset-0 z-30 cursor-default bg-ink/20"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={formatDayHeaderAccessibleLabel(date)}
        tabIndex={-1}
        className="fixed z-40 w-72 rounded-lg border border-border bg-paper p-3 shadow-spotlight outline-none"
        style={{ top, left }}
      >
        <p className="text-product-body font-medium text-ink">
          {formatDayHeaderAccessibleLabel(date)}
        </p>
        <ul className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
          {dayEvents.length === 0 ? (
            <li className="text-product-meta text-text-secondary">
              No events
            </li>
          ) : (
            dayEvents.map((event) => {
              const color = colorByCalendarId.get(event.calendar_id) ?? "slate"
              const timeLabel = event.all_day
                ? "All day"
                : formatTimeLabel(new Date(event.starts_at))
              return (
                <li key={event.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left outline-none hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink",
                      `planevo-rbc-event--${color}`,
                    )}
                    onClick={(e) => onSelectEvent(event, e.currentTarget)}
                  >
                    <span className="w-12 shrink-0 text-product-meta text-text-secondary">
                      {timeLabel}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-product-body text-ink">
                      {event.title}
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
        <button
          type="button"
          className="mt-3 w-full rounded-[var(--radius-calendar-control)] border border-border bg-surface-raised px-3 py-1.5 text-product-body font-medium text-ink outline-none hover:bg-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          onClick={() => onOpenDay(date)}
        >
          Open day
        </button>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `cd apps/web && npx tsc --noEmit 2>&1 | head -20`
Expected: no errors in `month-day-agenda-popover.tsx`

- [ ] **Step 3: Commit**

```bash
git add apps/web/features/calendar-product/month-day-agenda-popover.tsx
git commit -m "feat(calendar): add month day agenda popover"
```

---

### Task 6: CalendarGridEngine month view

**Files:**
- Modify: `apps/web/features/calendar-product/calendar-grid-engine.tsx`
- Modify: `apps/web/features/calendar-product/calendar-product-view.tsx`

**Interfaces:**
- Consumes:
  - `RbcMonthDateCell`, `MonthDayAgendaPopover`
  - `eventsForCalendarDay` (via popover)
  - `onSelectDay: (date: Date) => void` from parent (for Open day)
- Produces:
  - `CalendarGridEngine` accepts `view: "day" | "week" | "month"`
  - Month: RBC `views={["month", "week", "day"]}`, `popup`, `drilldownView={null}`
  - State: `agendaDate: Date | null`, `agendaAnchor: DOMRect | null`

- [ ] **Step 1: Extend CalendarGridEngine props**

In `calendar-grid-engine.tsx`, update types and add month state/handlers:

```tsx
import { useCallback, useMemo, useState } from "react"
import { RbcMonthDateCell } from "./rbc-month-date-cell"
import { MonthDayAgendaPopover } from "./month-day-agenda-popover"

type CalendarGridEngineProps = {
  view: "day" | "week" | "month"
  // ...existing props...
  onOpenDay: (date: Date) => void
}

// inside component:
const [agendaDate, setAgendaDate] = useState<Date | null>(null)
const [agendaAnchor, setAgendaAnchor] = useState<DOMRect | null>(null)

const rbcView: View =
  view === "day" ? "day" : view === "month" ? "month" : "week"

const openAgenda = useCallback((date: Date, target: HTMLElement) => {
  setAgendaDate(date)
  setAgendaAnchor(target.getBoundingClientRect())
}, [])

const closeAgenda = useCallback(() => {
  setAgendaDate(null)
  setAgendaAnchor(null)
}, [])

const handleSelectSlot = useCallback(
  (slotInfo: SlotInfo) => {
    if (view === "month") {
      const target =
        slotInfo.box instanceof HTMLElement
          ? slotInfo.box
          : document.body
      openAgenda(slotInfo.start, target)
      return
    }
    onSlotSelect(slotInfo.start)
  },
  [view, onSlotSelect, openAgenda],
)

const handleDoubleClickEvent = useCallback(() => {}, [])

// components memo — add month:
const components = useMemo(
  () => ({
    toolbar: () => null,
    header: (props: HeaderProps) => <RbcDayHeader {...props} now={now} />,
    event: RbcEventContent,
    timeGutterHeader: RbcTimeGutterHeader,
    month: {
      dateHeader: (props: DateHeaderProps) => (
        <RbcMonthDateCell {...props} now={now} />
      ),
    },
  }),
  [now],
)
```

- [ ] **Step 2: Wire RBC month props**

On `DragAndDropCalendar`, when `view === "month"`:

```tsx
<DragAndDropCalendar
  key={rbcView}
  localizer={calendarLocalizer}
  culture="en-US"
  date={anchor}
  view={rbcView}
  views={["month", "week", "day"]}
  events={rbcEvents}
  popup
  drilldownView={null}
  selectable={view !== "month" ? true : "ignoreEvents"}
  resizable={view !== "month"}
  onSelectSlot={handleSelectSlot}
  onShowMore={(events, date, anchorEl) => {
    openAgenda(date, anchorEl as HTMLElement)
  }}
  draggableAccessor={() => view !== "month"}
  resizableAccessor={() => view !== "month"}
  // ...rest unchanged for week/day...
/>
```

Wrap return in fragment with popover:

```tsx
return (
  <>
    <div
      className={cn(
        "planevo-rbc planevo-calendar-grid min-h-0 h-full w-full overflow-hidden rounded-t-[var(--radius-calendar-shell)] border border-border bg-calendar-grid",
        view === "month" && "planevo-rbc--month",
        !hasAllDayEvents && view !== "month" && "planevo-rbc--no-allday",
        className,
      )}
      // ...
    >
      <DragAndDropCalendar ... />
    </div>
    {agendaDate ? (
      <MonthDayAgendaPopover
        date={agendaDate}
        events={events}
        calendars={calendars}
        anchorRect={agendaAnchor}
        onClose={closeAgenda}
        onOpenDay={(day) => {
          closeAgenda()
          onOpenDay(day)
        }}
        onSelectEvent={(event, anchor) => {
          closeAgenda()
          onEventSelect(event, anchor)
        }}
      />
    ) : null}
  </>
)
```

Add double-click on month cells via `onDoubleClickEvent` unused — instead use `onDrillDown` blocked and handle via `dateCellWrapper` if needed. Simpler V1: add `onDoubleClickEvent` on calendar — RBC may not expose cell dblclick; optional `dateCellWrapper`:

```tsx
dateCellWrapper: ({ value, children }) => (
  <div
    onDoubleClick={() => {
      closeAgenda()
      onOpenDay(value)
    }}
  >
    {children}
  </div>
),
```

- [ ] **Step 3: Pass onOpenDay from calendar-product-view**

In `calendar-product-view.tsx`, add to `CalendarGridEngine`:

```tsx
<CalendarGridEngine
  // ...
  onOpenDay={handleSelectDay}
/>
```

- [ ] **Step 4: Manual smoke test**

Run dev server, open `/calendar?view=month&date=2026-07-24`
Verify: 6-week grid renders; toolbar shows Month; click day opens popover; Open day → day view

- [ ] **Step 5: Commit**

```bash
git add apps/web/features/calendar-product/calendar-grid-engine.tsx \
  apps/web/features/calendar-product/calendar-product-view.tsx
git commit -m "feat(calendar): add RBC month view with day agenda popover"
```

---

### Task 7: Month CSS skin

**Files:**
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: existing `.planevo-rbc` tokens
- Produces: `.planevo-rbc--month` rules for month grid, off-range days, event chips, show-more link

- [ ] **Step 1: Add month styles**

Append after `.planevo-rbc--no-allday` block in `globals.css`:

```css
/* react-big-calendar — month view */
.planevo-rbc--month .rbc-month-view {
  border: none;
  background: var(--color-calendar-grid);
}

.planevo-rbc--month .rbc-month-header .rbc-header {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-border);
  font-size: var(--text-calendar-day-weekday);
  line-height: var(--text-calendar-day-weekday--line-height);
  letter-spacing: var(--text-calendar-day-weekday--letter-spacing);
  font-weight: var(--text-calendar-day-weekday--font-weight);
  text-transform: uppercase;
  color: var(--text-secondary, var(--color-text-secondary));
  background: var(--color-surface-raised);
}

.planevo-rbc--month .rbc-day-bg {
  border-left: 1px solid var(--color-border);
}

.planevo-rbc--month .rbc-month-row + .rbc-month-row .rbc-day-bg {
  border-top: 1px solid var(--color-border);
}

.planevo-rbc--month .rbc-off-range-bg {
  background: color-mix(in srgb, var(--color-ink) 2%, var(--color-calendar-grid));
}

.planevo-rbc--month .rbc-today {
  background: color-mix(in srgb, var(--color-ink) 4%, var(--color-calendar-grid));
}

.planevo-rbc--month .rbc-event {
  border-radius: var(--radius-calendar-event);
  padding: 0 0.25rem;
  font-size: var(--text-product-meta, 0.75rem);
}

.planevo-rbc--month .rbc-show-more {
  font-size: var(--text-product-meta, 0.75rem);
  font-weight: 500;
  color: var(--color-text-secondary);
  background: transparent;
}

.planevo-rbc--month .rbc-overlay {
  border-radius: var(--radius-calendar-shell);
  border: 1px solid var(--color-border);
  background: var(--color-paper);
  box-shadow: var(--shadow-spotlight);
  padding: 0.5rem;
}

.planevo-rbc--month .rbc-overlay-header {
  border-bottom: 1px solid var(--color-border);
  margin: -0.5rem -0.5rem 0.5rem;
  padding: 0.5rem 0.75rem;
  font-weight: 500;
  color: var(--color-ink);
}
```

- [ ] **Step 2: Visual QA**

Open `/calendar?view=month` in light and dark mode.
Check: today disc, off-range mute, event chips, +more link, no marigold on chrome.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "style(calendar): add month view RBC skin"
```

---

### Task 8: QA gates and regression pass

**Files:**
- Modify: none (verification only)

- [ ] **Step 1: Run unit tests**

```bash
node --test packages/core/src/queries/product-calendar.test.mjs
node --test apps/web/lib/calendar/month-day-events.test.mjs
node --test apps/web/lib/calendar/calendar-navigation.test.mjs
node --test apps/web/lib/calendar/calendar-query-keys.test.mjs
```

Expected: all PASS

- [ ] **Step 2: Manual QA checklist (spec ship blockers)**

1. `/calendar?view=month` — 6-week grid, ocean today disc
2. Multi-day event starting June 28 visible in July month grid (overlap query)
3. Day with 5+ events — "+more" opens agenda with full list
4. Click day — popover opens, URL still `view=month`
5. "Open day" — navigates to `view=day`
6. Double-click day cell — day view
7. Click event chip — EventPeek
8. Week/day move/resize still works
9. Dark mode contrast OK
10. No marigold on toolbar/chrome

- [ ] **Step 3: Update spec status**

In `docs/superpowers/specs/2026-07-24-calendar-month-view-design.md`, change status line to `Approved — implemented`.

- [ ] **Step 4: Commit (docs only if changed)**

```bash
git add docs/superpowers/specs/2026-07-24-calendar-month-view-design.md
git commit -m "docs: mark calendar month view spec implemented"
```

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| RBC month engine | Task 6 |
| Overlap query | Task 1 + Task 3 |
| Month in toolbar (Day·Week·Month·Year) | Task 3 |
| Day agenda popover | Task 5 + Task 6 |
| Open day / double-click drill-down | Task 5 + Task 6 |
| Ocean today disc in cell | Task 4 + Task 7 |
| Title chips not dots | Task 6 + Task 7 |
| +more popover | Task 6 |
| Zero marigold on chrome | Task 7 QA |
| Month DnD disabled | Task 6 |
| Keyboard Escape on popover | Task 5 |
| `calendar-nav-motion` month key | Task 3 |
| Query keys month window | Task 3 |
| Out of scope items | Not in plan |

## Placeholder scan

No TBD/TODO/similar-to placeholders in plan.

## Type consistency

- `CalendarToolbarView` includes `month` everywhere after Task 3
- `CalendarGridEngine.view` is `"day" | "week" | "month"`
- `LoadCalendarWeekOptions.eventRange` used only when `view === 'month'`
