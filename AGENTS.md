# AGENTS.md — Planevo

Single source of truth for every AI dev tool on this repo (Codex, Cursor, Claude Code all
read this file). Do not duplicate these rules into other files — the tool-specific files
(`CLAUDE.md`, `.cursor/rules/planevo.mdc`) only point here so nothing drifts.

Planevo is the workspace that's ready before you are: Notion-caliber structural power
(blocks, databases, views, relations) with none of the setup tax. Its own product —
never marketed as a Notion alternative.

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
2. `docs/planevo-prd.md` — full product source of truth. Read the relevant section before
   building any screen (e.g. §5.7 before onboarding, §5.4 before Planevo AI).
3. `docs/design-build-sheet.md` — the 22-screen build order and what each screen contains.
4. `docs/references/` — visual craft references ONLY. See the rule below.

## Inviolable rules (do not break, do not "improve" past these)

- **Reference images are craft-only, never layout.** Everything in `docs/references/` is
  there for its craft — card treatment, texture, spacing, type hierarchy, radii, restraint.
  Never clone a reference's information architecture. The Acme AI reference in particular
  is agent-first; Planevo is not. If you're unsure whether something is craft or IA, ask.
- **Workspace-first IA, never agent-first.** The home screen leads with the user's own
  workspace (recent pages, continue where you left off, entry-point cards). NOT a chat
  console, NOT "Start Chat" as the hero, NOT an agent grid. This is the #1 rule.
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

- Do not clone a reference image's information architecture.
- Do not add an AI chatbot mascot or persona (the old "Bruno" concept is permanently dead).
- Do not introduce competitor names anywhere in the UI.
- Do not use gradients, heavy shadows, or glow. Flat, calm, premium.
- Do not reach for a component library's default look. Tailwind is the tool; the design
  is ours.
