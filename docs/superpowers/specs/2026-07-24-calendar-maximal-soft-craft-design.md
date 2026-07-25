# Calendar Maximal Soft Craft Design

**Date:** 2026-07-24  
**Status:** Approved for planning (brainstorming §1–3 signed off)  
**Authority:** Founder craft direction (GCal reference for edges + day headers) + `AGENTS.md` + prior grid rebuild / all-day Union Council specs

## Summary

Apply a **Maximal soft** visual treatment to the Planevo Calendar week/day surface so edges, day headers, toolbar controls, and event blocks read like Google Calendar’s soft UI — without cloning GCal IA or chrome. Implementation is craft-only: tokens, FullCalendar header renderer, CSS shell, toolbar radii. No create-flow or data-model changes.

## Locked decisions

| Decision | Choice |
|----------|--------|
| Today treatment | Filled **ocean** circle; weekday tint matches |
| Softness scope | Full soft system: shell + day headers + event pills + toolbar |
| Craft intensity | **Maximal soft** (~24px shell, fully pill events, large today disc) |
| Accent rule | Ocean only on today header; toolbar stays ink/neutral; **zero marigold** on calendar chrome |

## Visual language

### Tokens (new, calendar-scoped)

Add to the token layer in `apps/web/app/globals.css` (and theme mapping if required):

| Token | Value | Use |
|-------|-------|-----|
| `--radius-calendar-shell` | `24px` | Grid panel clip |
| `--radius-calendar-control` | `999px` | Today / nav / view / Filter chips |
| `--radius-calendar-event` | `999px` | Timed + all-day event blocks |
| `--size-calendar-today-disc` | `1.75rem` | Today number circle |

No hardcoded hex in components. Ocean / ink / paper / border tokens only.

### Day headers (GCal-like)

- Stacked layout: uppercase short weekday above date number (e.g. `SUN` / `19`)
- Centered in column
- **Today:** filled disc (`background: ocean`, contrast text via paper/ink), weekday label in ocean
- Other days: muted weekday + ink date
- Accessible name includes full date; today uses `aria-current="date"`

### Shell & chrome

- `.planevo-fc` (or immediate wrapper): `border-radius: var(--radius-calendar-shell)`, `overflow: hidden`, border via `--color-border`
- Light inset so the rounded panel reads against the product chrome (not flush square)
- Preserve Union Council all-day band: thin unlabeled slot, `sr-only` “All day”, no `:has()` collapse

### Events & toolbar

- Event inner (`.fc-planevo-event-inner`): pill radius via `--radius-calendar-event`; keep left color bar + calendar tint classes
- Toolbar controls in `calendar-toolbar.tsx`: Today, chevrons, Day/Week/Year, Filter → pill radii (`rounded-full` or token class)
- Active view segment: ink fill (not ocean) so today disc remains the single accent

## Components & wiring

```
calendar-product-view
├── CalendarToolbar          ← control radii
└── CalendarGridEngine       ← dayHeaderContent + event pill class
    └── .planevo-fc CSS      ← shell + FC header/event skin
```

| File | Change |
|------|--------|
| [`apps/web/app/globals.css`](apps/web/app/globals.css) | Calendar radius/size tokens; shell clip; header spacing; event pill overrides |
| [`apps/web/features/calendar-product/calendar-grid-engine.tsx`](apps/web/features/calendar-product/calendar-grid-engine.tsx) | Custom `dayHeaderContent`; remove reliance on default “19 Sun” `dayHeaderFormat`; event inner radius |
| [`apps/web/features/calendar-product/calendar-toolbar.tsx`](apps/web/features/calendar-product/calendar-toolbar.tsx) | Pill radii on controls; keep ink active state |
| [`apps/web/features/calendar-product/calendar-product-view.tsx`](apps/web/features/calendar-product/calendar-product-view.tsx) | Minimal inset/padding so 24px shell reads correctly |

## Out of scope

- All-day event create/persist (exclusive end) — prior deferred pass
- Year view redesign
- Planning rail radius / layout changes
- Cloning GCal search, Upgrade, or side utility rail
- FullCalendar Premium features
- Marigold on calendar chrome

## Accessibility

- Today disc: `aria-current="date"`; accessible name e.g. “Friday, July 24, 2026”
- Weekday labels remain visible text
- Contrast on ocean fill uses theme paper/ink (not hardcoded)
- Toolbar focus rings unchanged (`outline-ink`)

## Verification

- Week and day views: stacked headers, ocean today disc, 24px shell clips grid
- Timed and all-day events read as pills
- Select / drag / resize / peek / Planning → grid schedule still work
- Planning collapse still triggers FullCalendar `updateSize` (no regression)
- Ocean only on today header; no marigold on calendar chrome

## Build gate

Before implementation: short Union Council (Craft / Critic / Pragmatist) ratifies Maximal soft against `AGENTS.md` one-accent + token rules, then proceed via implementation plan.

## Done when

Empty week looks soft and GCal-adjacent; today pops with ocean disc; toolbar and events match shell roundness; behavior regressions absent.
