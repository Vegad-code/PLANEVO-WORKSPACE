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

Order of operations:
1. The **token layer** — CSS custom properties in `globals.css`, mapped into the Tailwind
   theme. Nothing else gets built until this exists.
2. The **`/design` route** — a kitchen-sink page rendering every token and every component
   in every state. This is where design decisions get made and reviewed.
3. **Screens**, one at a time, composed from those components.

## Read these before doing anything

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

- Token layer first, then `/design`, then screens. Never skip ahead.
- One screen at a time. Build it, show it, get a decision, then move on. Don't batch-build.
- Every new component lands in `/design` with all its states before it's used in a screen.
- When a design choice isn't specified, ask — don't invent IA.
- One primary dev tool at a time (PRD §7.2). Others are second opinions, not co-drivers.

## Do not

- Do not clone a reference image's information architecture (single exception: Home,
  per the founder override above).
- Do not add an AI chatbot mascot or persona (the old "Bruno" concept is permanently dead).
- Do not introduce competitor names anywhere in the UI.
- Do not use gradients, heavy shadows, or glow. Flat, calm, premium.
- Do not reach for a component library's default look. Tailwind is the tool; the design
  is ours.
