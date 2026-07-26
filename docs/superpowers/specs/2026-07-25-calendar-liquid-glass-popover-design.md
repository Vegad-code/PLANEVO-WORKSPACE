# Calendar liquid glass event popover

**Date:** 2026-07-25  
**Status:** Implemented  
**Scope:** Calendar event create/edit popover only

## Founder override / runtime note

`liquid-glass-react` is explicitly **banned** for Spotlight (see spotlight spec). A founder exception allows it for the calendar event popover **visual shell only**.

**What went wrong (2026-07-25):** The library is built for center-anchored chips (`translate(-50%,-50%)` + mouse elasticity). Its overlay siblings render as `position: relative` Fragment children and stacked to 500→1250px+ inside our top-left fixed popover, covering the draft card.

**Shipped approach:** `EventPopoverGlassShell` wraps [liquid-glass-react](https://github.com/rdev/liquid-glass-react) with:
- `elasticity={0}` and frozen `globalMousePos` / `mouseOffset` (no mouse listeners / liquid motion)
- CSS host that absolute-contains overlay siblings; glass node defines height
- `prefers-reduced-transparency` → `.event-popover-glass-fallback`

Placement stays side-anchored (Vegad-code/planevo `CalendarComposerShell` model). Outer `motion.div` owns fixed `top`/`left`.

## Goal

When creating or editing an event (especially drag-to-create), the popover should feel like Apple Calendar: a frosted glass panel beside the draft event card, with a directional arrow callout pointing at the anchor card. The draft card on the grid stays a solid calendar-tinted block.

## Visual

| Element | Treatment |
| --- | --- |
| Draft event card (grid) | Unchanged — solid `planevo-rbc-event` tint + left accent |
| Popover shell | `liquid-glass-react` (`cornerRadius` 16, high frosted opacity) |
| Arrow | Rounded diamond on the edge facing the anchor; vertically aligned to anchor midpoint |
| Mobile (`<768px`) | Centered popover, no arrow |
| Backdrop | None — no full-screen dim or blur |

## Positioning

`event-popover-position.ts` returns:

- `placement`: `"left"` | `"right"` | `"centered"`
- `arrowOffsetY`: px from panel top to arrow center (clamped 12px from edges)
- Prefer right of anchor; flip left on overflow; centered on narrow viewports

Popover width: `18rem` (`EVENT_POPOVER_WIDTH_REM`).

## Accessibility

- `prefers-reduced-transparency: reduce` → skip `LiquidGlass`; use `.event-popover-glass-fallback` (solid `calendar-panel-glass` pattern)
- `prefers-reduced-motion: reduce` → instant popover entry (existing shell spring off)
- Arrow is `aria-hidden`; dialog remains `aria-modal="false"`

## Browser notes

Safari/Firefox may show weaker displacement per `liquid-glass-react` README. Blur-only degradation is acceptable; solid fallback covers reduced-transparency users.

## Files

- `apps/web/lib/calendar/event-popover-position.ts`
- `apps/web/features/calendar-product/event-popover-callout.tsx`
- `apps/web/features/calendar-product/event-detail-popover.tsx`
- `apps/web/features/calendar-product/calendar-product-view.tsx` (`mouseContainerRef`)
- `apps/web/app/globals.css` (arrow + fallback)
- `apps/web/app/design/calendar-product-preview.tsx` (`DraftCreatePreview`)

## Verification

```bash
cd apps/web && npx tsc --noEmit -p tsconfig.json
cd apps/web && node --test lib/calendar/event-popover-position.test.mjs
```

Manual: `/calendar` week view → drag slot → solid draft card + glass popover with arrow; narrow viewport → centered, no arrow.
