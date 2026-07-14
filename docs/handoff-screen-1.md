# Handoff prompt — build Screen 1 (app shell)

Paste everything below this line into the agent building Screen 1 (Cursor / Claude / Codex).

---

You are building Screen 1 of Planevo. Do these in order before writing any code:

1. Read `AGENTS.md` at the repo root — it is the authoritative steering. Its inviolable
   rules are non-negotiable.
2. Read `docs/design-brief.md` (especially §3 sidebar spec and §5 component inventory)
   and `docs/design-build-sheet.md` (Screen 1 block + the reminders section).
3. Confirm two rules back to me before coding: (1) workspace-first IA, never agent-first;
   (2) themed tokens only — never a raw hex, font name, or arbitrary pixel value in a
   component.

## State of the repo (2026-07-14)

- npm-workspaces monorepo. The app is `apps/web`: Next.js 16 App Router + TypeScript
  strict + Tailwind v4. Run `npm run dev` from the repo root; app at localhost:3000.
- **Next 16 has breaking changes** vs. your training data. Read `apps/web/AGENTS.md` and
  the bundled docs in `node_modules/next/dist/docs/` before using any API you're not
  sure about.
- **The token layer is built and founder-approved. Do not re-pick any value.** Every
  color/type/spacing/radius lives in `apps/web/app/globals.css` via Tailwind v4 `@theme`.
  Utilities that already exist and you must use: `bg-paper`, `bg-sidebar`,
  `bg-surface-raised`, `text-ink`, `text-text-secondary`, `text-text-muted`,
  `border-border`, `border-border-strong`, accent utilities for
  marigold/brick/meadow/slate and their `-tint` variants, type styles
  `text-h1/h2/h3/body/small/label/mono` (pair `text-label` with `uppercase`),
  `font-mono`, `rounded-card` (14px), `w-sidebar` (210px), `w-rail` (56px).
  A token change = editing globals.css only, never a component.
- Fonts are loaded (General Sans 400/500 via next/font, Geist Mono). Two weights only.
- Minimal mode is wired: `data-minimal` attribute on `<html>` mutes accents. Don't break it.
- `/design` is the kitchen-sink route (currently tokens only). Every new component you
  create must be added there with all its states.
- No screens exist yet. `app/page.tsx` is a placeholder.

## The task — Screen 1, the app shell, nothing else

Build the shell as shared layout chrome (sidebar + top bar + canvas slot) that every
future screen inherits.

**Sidebar** — contents top to bottom:
- Workspace switcher (workspace name + icon, fixture data).
- Nav group: Workspace / Tasks / Calendar / Files.
- Pages tree below (static fixture nesting is fine for this screen; dnd comes later).
- AI group pushed to the bottom: "Planevo AI" (slate treatment) and "Agents".
- Account/settings footer. Reserve a slot above it for a future plan/credit card — empty
  for now.

**Sidebar collapse — the decided spec (full detail in design-brief §3):** three states.
(1) Expanded 210px in the layout grid. (2) Icon rail ~56px. (3) Hover-peek: hovering or
keyboard-focusing the rail floats the full sidebar OVER the canvas as a fixed overlay
with its own scroll — the canvas must not reflow during a peek. ~200ms hover-intent
delay. `⌘\` toggles expanded/rail. State persists (localStorage is fine). Dismiss peek
on mouse-leave and Esc. Honor `prefers-reduced-motion`.

**Top bar:** breadcrumb left; right side = a quiet slate "Ask Planevo AI" pill (a pill,
not a glowing button) and an avatar.

**Canvas:** an open slot rendering page content on `bg-paper`.

**NavItem states:** default / hover / active / AI-variant. Active = a single marigold
pip + subtle fill. The active pip is the ONLY marigold on screen.

## Hard rules for this screen

- Fixture data only — realistic student/founder workspace (e.g. pages "Physics 2400",
  "Apps tracker", "Reading list"). No database, no API calls.
- One marigold accent per view (the active nav pip). Two = a bug.
- AI surfaces (Planevo AI nav item, top-bar pill) use slate and stay quiet.
- Flat: 1px `border-border` hairlines, `bg-surface-raised` for elevation. No shadows,
  no gradients, no glow.
- Sentence case everywhere. Never Title Case, never ALL CAPS (label style excepted).
- `Sidebar`, `NavItem`, `TopBar` each land in `/design` with all their states.
- Match the existing code style; keep the diff minimal; no component libraries.

## Stop condition

When the shell renders with all three sidebar states working (and `/design` updated),
STOP and show the founder. Do not start Screen 1.5 (Home), do not batch-build screens.
