# AGENTS.md — Planevo

Single source of truth for every AI dev tool on this repo (Codex, Cursor, Claude Code all
read this file). Do not duplicate these rules into other files — the tool-specific files
(`CLAUDE.md`, `.cursor/rules/planevo.mdc`) only point here so nothing drifts.

Planevo is the Work OS for normal people: a productivity **ecosystem** where Tasks,
Calendar, Files, and Workspace are separate products that connect seamlessly (Apple
Continuity model) — not one database engine wearing different hats. Workspace is the
Notion-grade block canvas; everything else does its own job. Never marketed as a
Notion alternative.

## What we're doing right now

**Designing in code.** There is no Figma file and no mockup step — the design IS the build.
We build the UI directly in `apps/web` (Next.js App Router + TypeScript strict + Tailwind),
screen by screen, in the order set by `docs/design-build-sheet.md`.

Order of operations for a new design-system or screen-build task:
1. The **token layer** — CSS custom properties in `globals.css`, mapped into the Tailwind
   theme. Nothing else gets built until this exists.
2. The **`/design` route** — a kitchen-sink page rendering every token and every component
   in every state. This is where design decisions get made and reviewed.
3. **Screens**, one at a time, composed from those components.

This sequence does not block ordinary implementation work, bug fixes, tests, migrations,
docs, or maintenance. For those tasks, follow the user's requested scope and work directly
in the relevant files.

## Read these before broad design work

1. `docs/design-brief.md` — the design spec. Tokens (with their exact CSS variable names),
   type/spacing scales, component inventory, screen list, and the rules for reference
   images. **This governs all design work.**
2. `docs/planevo-prd.md` — product strategy source of truth (**v2.0 ecosystem model**).
   Read the relevant section before building any screen (e.g. §5.11 onboarding, §5.8 AI).
   For WHAT each feature is and its V1 boundary, `docs/planevo-feature-spec.md` (F-01…)
   is the build-ready companion — feature IDs there are the stable references.
   **Do not use kernel-first patterns** (`DatabaseFace`, `template_type` faces for
   Tasks/Calendar/Files) — see DEP-01 in the feature spec.
3. `docs/design-build-sheet.md` — the 22-screen build order and what each screen contains.
4. `docs/references/` — visual craft references ONLY. See the rule below.

Do not read every governing document before a small task. Read the smallest relevant file
set needed to make a safe change, then implement it. Read a full relevant spec only when the
user asks for planning or the task is explicitly being handled in planning mode.

## Inviolable rules (do not break, do not "improve" past these)

- **Reference images are craft-only, never layout — with ONE founder-granted exception.**
  Everything in `docs/references/` is there for its craft — card treatment, texture,
  spacing, type hierarchy, radii, restraint. Never clone a reference's information
  architecture. **Exception (founder override, 2026-07-16): the Acme AI reference's
  layout IS the layout reference for the Home screen** — sidebar, centered greeting,
  action-card grid, bottom composer. This exception covers Home only; every other screen
  stays craft-only. If you're unsure whether something is craft or IA, ask.
- **Home is a calm launch hub; Tasks, Calendar, and Files are independent products.**
  (Founder overrides, 2026-07-16 Home layout; 2026-07-17 ecosystem architecture.)
  Home links into real product routes — never database faces, never inline product UIs.
  Tasks, Calendar, and Files have their own data, own UI, global scope; Workspace is the
  Notion block canvas and embeds/links them. No chat console as a front door, no agent
  grid, no AI-first IA.
- **Ecosystem linking, not a universal kernel.** Products handshake via `workspace_links`
  and cross-feature links — never by making Tasks/Calendar/Files into workspace databases.
  Workspace custom databases are workspace-scoped builder tools only.
- **Present, not pushy AI.** The AI surface (Planevo AI) is findable in seconds and
  ignorable forever. No sparkle-emoji buttons begging for clicks in core flows. The AI
  layer uses the `slate` token; it never dominates a screen.
- **One accent per view.** `marigold` appears at most once per screen (active nav, primary
  CTA). Paper + ink do 90% of the work. Two marigold elements on one screen is a bug.
- **Manual-first.** Everything is designed so a human could do it by hand; AI is additive.
- **Signature law.** Line art = structure; filled color = the user's life/work. Empty
  databases render as faint line-art scaffolding that fills with color as records arrive.
- **Tokens are PROVISIONAL and centralized.** Colors and type may change. Every color,
  font, space, and radius is a CSS custom property in `globals.css`, surfaced through the
  Tailwind theme. **Never hardcode a hex, font name, or arbitrary pixel value in a
  component.** No `bg-[#F5F3ED]`, no `text-[13px]` — use the themed token. A palette swap
  must be a one-file edit.

## Working style

- **Hosted Supabase for this repo is always `aixvpsmpiucticxutngp`.** Never target a
  different project/ref for migrations, SQL, advisors, or MCP unless the founder
  explicitly names another. (`supabase/config.toml` and `apps/web/.env.local` match.)
- Work directly in the active Planevo checkout at all times. Never create or switch to a
  separate Git worktree, temporary clone, or branch-specific checkout unless the user explicitly
  requests it.
- For implementation requests, execution comes first: inspect the failing or requested path,
  make the smallest coherent change, and run focused verification in the same turn. Do not
  return a plan instead of making the requested change.
- Before editing, always do a brief internal implementation check: identify the likely files,
  behavior change, and focused verification. Keep that reasoning internal and concise; do not
  turn it into a narrated plan, checklist, or planning artifact unless the user explicitly asks
  for a plan or the task is in planning mode.
- Only use token layer → `/design` → screens for broad new design-system or screen-build work;
  do not impose it on bug fixes, small UI changes, backend work, tests, or maintenance.
- Visible planning happens only when the user asks for it or the task is in planning mode.
  Never wait for approval merely because a task is broad or risky; ask only when a required
  decision cannot be inferred safely and would materially change the requested behavior.
- **"No more questions / just start coding"** means exactly that: stop interviewing and ship.
  If a craft reference, screenshot, or product (Google Calendar, Apple, Lumis, Notion, Linear)
  is the target look, default to **closest to that reference** instead of asking preference
  questions. Prefer industry golden-standard UX (Linear / Notion / Apple / GCal) for labels,
  density, and motion when Planevo does not already specify it.
- When the user says **"before touching a line of code"**, research / scrape / audit first
  (and use subagents when they ask for a team). Only then implement. Do not rush visual
  fixes — take the time to get lines, spacing, and states actually correct.
- **Finish the job.** If a plan or todo list is attached, complete every item in that session.
  Do not stop after a partial slice, a research summary, or a "here's what I'd do next."
  Keep iterating until the stated goal is met or a hard blocker needs the founder.
- One screen at a time applies to an interactive design review, not to implementation delivery.
  Build the requested slice and report what changed; do not stop after research waiting for a
  separate decision unless the user asked for that workflow.
- For broad design-system work, every new component lands in `/design` with all its states
  before it's used in a screen. Small or task-specific components may ship with the requested
  implementation when extracting them first would add ceremony without reducing risk.
- When a design choice isn't specified, use the existing product patterns and make the smallest
  reversible assumption. Ask only when the choice would materially change scope or behavior.
- **Visual / product QA is mandatory for UI work.** Screenshots and the running app beat
  code claims. After a UI change, verify the actual surface (browser or attached screenshot).
  Never say "fixed" if you have not confirmed it. If the founder says it is still wrong,
  re-diagnose from the current UI — do not reassert the previous claim.
- **Responses stay short and plain.** Lead with what changed or the answer. No long essays,
  no restating the task, no filler. Explainer questions get plain-language answers unless
  the founder asks for depth.
- **Prompt requests for Claude / Codex / Fable / Opus / Sonnet** always mean a full paste-ready
  orchestrator prompt file under `docs/superpowers/prompts/` plus plan/council scaffolding
  when it is a build phase — never a short chat snippet. See `.cursor/rules/claude-codex-prompts.mdc`.
- **Plan → Implementation skill carryover.** Skills used in Plan mode
  (`/find-skill`, `/working-council`, `/mission-critical`, `/plan-with-skills`) must be
  written into the plan’s `## Active Skills Carryover` and
  `.superpowers/<slug>/skill-carryover.md`, then **re-loaded before coding** when the
  plan is implemented. See `.cursor/rules/skill-carryover.mdc`.
- Keep separate features in separate docs when asked (e.g. NLP capture ≠ shortcuts research).
  Respect V1 / out-of-scope calls without arguing them away.
- One primary dev tool at a time (PRD §7.2). Others are second opinions, not co-drivers.
  Do not run a second agent rewriting the same files under an active session.

## Code quality

The implementation bar for this repo — distilled from shipped calendar month rebuild,
popover, and related work. Every agent follows this on every task.

### Layering

| Layer | Responsibility |
|-------|----------------|
| `apps/web/lib/<domain>/` | Pure, testable logic — no React, no DOM |
| `*.test.mjs` | Colocated behavior tests (`node:test`) |
| `use-*.ts` | Measurement, observers, subscriptions only |
| `features/*/*.tsx` | Wire props → lib; a11y; semantic CSS classes |

Components do not own layout math or business rules. Extract to `lib/` when logic is
testable without a browser.

### Comments

Comment **why** and **gotchas**, not what the code obviously does: invariants, upstream
bugs avoided, DST/timezone traps, measurement pitfalls. One file-level paragraph on purpose
and constraints. Skip comments on self-explanatory lines.

### TypeScript

- Named object parameters — no positional args for multi-field inputs.
- Discriminated unions (`kind` / `type`) for gestures, results, drag payloads.
- `null` means no-op or cannot compute — caller keeps prior state.
- `satisfies` for external library payloads (e.g. dnd-kit `data`).
- Export types beside functions. Early returns over deep nesting.
- No `any`. Prefer `unknown` + narrowing at boundaries.

### Immutability

Never mutate cached payloads, props, or `Date` instances in place. Patch with spreads.
Calendar-day arithmetic goes through local-day helpers (`addLocalDays`, `localDayDiff`) —
never `getTime() + 86_400_000` for whole-day shifts.

### Tests

- `node:test` + `node:assert/strict` in colocated `*.test.mjs`.
- Test names are scenarios, not identifiers (`"shows a quiet day's items even when its
  neighbour overflows"`).
- Local factories (`singles()`, `day()`) to cut boilerplate.
- Assert failure modes (`null`, unknown units, clamps) — not only happy path.
- Regression tests name the bug they prevent.

### React / UI

- `"use client"` only on leaves that need interactivity.
- Semantic classes from `globals.css` (`calendar-month-cell--past`); `cn()` for variants.
- `flex` + `gap-*` — no `space-x` / `space-y`.
- a11y by default: roles, `aria-label`, keyboard handlers, focus management.
- Document non-obvious perf choices (e.g. `hidden` vs unmount to avoid relayout).
- Constants for bounds (`MAX_MONTH_ITEMS_PER_DAY`, viewport margins).

### Defensive coding

Bad measurement or unknown CSS unit → return `null`, keep previous value. Cap DOM size
where lists can grow without bound. Guard clauses at function entry; exhaustive switches
with `never` default.

### Code do not

- Tiny untested one-liner helpers.
- TODOs, placeholders, or partial delivery.
- Over-abstraction for a single call site.
- Claiming fix without `npm test` / `tsc` / UI check as appropriate.

## Do not

- Do not clone a reference image's information architecture (single exception: Home,
  per the founder override above). When a screenshot is the **target look for that screen**,
  match its craft and layout of that product surface closely — still never turn Tasks /
  Calendar / Files into workspace database faces.
- Do not add an AI chatbot mascot or persona (the old "Bruno" concept is permanently dead).
- Do not introduce competitor names anywhere in the UI.
- Do not use gradients, heavy shadows, or glow. Flat, calm, premium.
- Do not reach for a component library's default look. Tailwind is the tool; the design
  is ours.
- Do not claim a UI bug is fixed without verifying the running UI or matching the founder's
  screenshot. Do not "fix" by changing only a sibling view (e.g. week vs day).
- Do not ask a stack of clarifying questions when the reference, screenshot, or prior answer
  already decides the default ("closest to Lumis / GCal / Apple").
- Do not stop mid-implementation to wait for approval, invent a new planning ceremony, or
  end a build session early while todos remain.

## Cursor Cloud specific instructions

Durable notes for Cursor Cloud agents. The startup layer already runs `npm install`
(root; `patch-package` postinstall applied automatically). Node 22+ is required
(`node --experimental-strip-types` powers the `.test.mjs` suites).

Standard commands (already defined in `package.json`): `npm test` (pure-logic tests, no
DB — currently 242 passing), `npm run lint` (eslint; the repo ships with pre-existing lint
errors — do not treat them as environment breakage), `npm run dev` (Next.js app on
`http://localhost:3000`).

### Backend: run a LOCAL Supabase stack (no hosted access in Cloud)

The founder-pinned hosted project `aixvpsmpiucticxutngp` is NOT reachable from Cloud
(the Supabase MCP only sees a different, legacy-schema project — do not target it, and do
not push this repo's migrations to it). For anything beyond `/design` (which renders
standalone), stand up a local Supabase stack. Docker is a system dependency, so it is NOT
in the update script — install/start it per session:

1. Install Docker (DinD): for Docker 29 use `fuse-overlayfs` storage-driver AND
   `"features": { "containerd-snapshotter": false }` in `/etc/docker/daemon.json`, set
   `iptables`/`ip6tables` to the legacy alternatives, then run `sudo dockerd` (background,
   e.g. a tmux session) and `sudo chmod 666 /var/run/docker.sock`.
2. `npx supabase start` from the repo root (applies all `supabase/migrations/`). Containers
   are named `supabase_*_aixvpsmpiucticxutngp` (the project_id in `config.toml`). Note the
   printed `API_URL`, `ANON_KEY`, and `SERVICE_ROLE_KEY`.
3. Grant `service_role` table access (dev mode uses it and the migrations only grant DML to
   `authenticated`, so reads fail with `permission denied for table ...` without this):
   ```sql
   -- docker exec -i supabase_db_aixvpsmpiucticxutngp psql -U postgres -d postgres
   grant all on all tables in schema public to service_role;
   grant all on all sequences in schema public to service_role;
   grant all on all functions in schema public to service_role;
   alter default privileges in schema public grant all on tables to service_role;
   alter default privileges in schema public grant all on sequences to service_role;
   ```
4. Create `apps/web/.env.local` (gitignored) pointing at the local stack. Use the LEGACY
   JWT keys, not the new `sb_publishable_`/`sb_secret_` keys — local PostgREST only accepts
   the JWTs, otherwise requests silently fall back to the `anon` role:
   ```
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from `supabase start`>
   SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from `supabase start`>
   PLANEVO_DEV_MODE=1
   PLANEVO_DEV_OWNER_ID=b0000000-0000-4000-8000-000000000001
   ```

### Gotchas

- Dev mode (`PLANEVO_DEV_MODE=1` + `PLANEVO_DEV_OWNER_ID` + a server secret key, non-prod
  build only) impersonates a fixed owner via the service_role client and bypasses RLS. It
  lazily creates the dev auth user on first request. It is hard-disabled in production.
- `.env.local` changes require a dev-server restart (Next.js reads env at boot).
- Workspace routes (`/`, `/tasks`, `/calendar`, `/files`, `/workspace`) redirect to
  `/onboarding` until you answer the "What are you organizing?" question once; that seeds a
  starter workspace. `/design` never needs the DB.
