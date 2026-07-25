# Task 3 — Premium hybrid Month craft

## Summary

- Refined the React Big Calendar Month surface into one flat, continuous grid with tokenized dividers, centered weekday/date labels, muted outside-month cells, and an ocean-only today disc.
- Kept React Big Calendar's natural visible-week rendering (five or six rows) while preserving the existing 42-day server query window.
- Refined Month item treatment: transparent timed rows with semantic dots and compact times, soft filled bars with a semantic edge, neutral task rows with tokenized checkbox sizing, and quieter overflow affordances.
- Added explicit Month design states in light and dark: empty, normal, dense overflow, multi-day, outside-month, and task due. The normal July state exercises five rows; dense May state exercises six rows.
- Added the required client boundary to `Badge`; added the same boundary to the shared Radix-backed `Button` because the production `/design` build exposed the identical server/client boundary fault there.

## Files

- `apps/web/app/globals.css`
- `apps/web/app/design/calendar-product-preview.tsx`
- `apps/web/components/ui/badge.tsx`
- `apps/web/components/ui/button.tsx`
- `apps/web/features/calendar-product/calendar-grid-engine.tsx`
- `apps/web/features/calendar-product/month-day-agenda-popover.tsx`
- `apps/web/features/calendar-product/rbc-month-date-cell.tsx`
- `apps/web/features/calendar-product/rbc-month-event-content.tsx`
- `apps/web/features/calendar-product/rbc-month-weekday-header.tsx`

## Verification

- Focused Month contracts: 17 passing tests across item classification, RBC adapter interactions, agenda positioning/focus, and Month behavior.
- `npx tsc --noEmit` — pass.
- Focused ESLint for the changed TypeScript/TSX files — pass.
- `npm run build` in `apps/web` — pass; `/design` generates as a static route.
- Local `/design` HTTP check against the existing dev server — `200`.

## Visual QA

- Inspected both supplied reference screenshots and the supplied current-screen screenshot with `view_image` before implementation.
- Compared and corrected the principal visible drift: raised weekday surface, doubled header padding, right-aligned dates, whole-cell today tint, and the prior custom date-header bug that muted every day as outside-range.
- The in-app browser backend was unavailable in this session, so rendered screenshot checks at 1440x900 and 2940x1600, dark/light, and Planning rail expanded/collapsed could not be captured. The `/design` gallery now contains the required five- and six-week light/dark states for a follow-up browser pass.

## Commit

- Implementation: `285fc5f` (`feat(calendar): refine premium month grid`)

## Concerns

- No functional, API, route, migration, toolbar, Planning rail, or non-Month view behavior was changed.
- Remaining QA is visual-only: capture the actual Calendar and `/design` surfaces in an available browser at the requested desktop dimensions and Planning rail states.
