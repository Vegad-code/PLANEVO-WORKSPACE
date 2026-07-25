# Planevo — Design Brief

Companion to `planevo-prd.md` (§5.8 is the source; this is the build-ready version).
Everything here is **provisional** — it must be seen rendered in a browser before it locks.
That's what the `/design` route is for.

We design in code. There is no Figma file. Every value below exists as a CSS custom
property so a change is a one-file edit.

---

## 0. The rule that matters most: references are craft, not layout

Everything in `docs/references/` — including the Dribbble "Acme AI" / "Lumis" mockups —
is a reference for **craft only.**

| COPY (the craft) | REJECT (the IA) |
|---|---|
| Card treatment: icon + title + one-line subtitle | "Start Chat" as the hero CTA |
| Dotted / perforated grid texture inside cards | An agent-console home screen |
| Illustrated mini-previews inside action cards | Chat input as the center of gravity |
| Generous spacing, soft radii, calm surfaces | Agent grid as primary home content |
| Restrained near-monochrome + one dark accent | Anything making AI the front door |
| Confident type hierarchy, rounded pill tabs/nav | |

**What Planevo's home actually is** (per PRD §5.7–5.8): the user lands in their own
workspace — recent pages, continue-where-you-left-off, entry-point cards to Tasks /
Calendar / Files. Planevo AI is reachable in one click but is never the hero. If a home
screen could be mistaken for a chatbot's landing page, it's wrong.

When a new reference image is added, it inherits this rule by default: take its craft,
ignore its structure.

---

## 1. Color tokens (provisional)

`paper` + `ink` carry ~90% of every screen; accents are meaningful and rare.
Values live only in `globals.css` — never hardcoded in components.

### Light mode (Notion-caliber)

Default theme (`@theme` in `globals.css`). Canvas is pure white; sidebar is a soft
elevated tier. **CTA accent is Notion blue `#2383E2`** — the token name stays
`marigold` for semantic stability; use `text-marigold-foreground` (`#FFFFFF`) on
primary buttons. One accent per view still applies.

**Borders:** warm brown-black rgba (not cool gray) — hairlines at
`rgba(55,53,47,0.09)`, structural at `rgba(55,53,47,0.16)`.

| Token | CSS variable | Hex | Role |
|---|---|---|---|
| paper | `--color-paper` | `#FFFFFF` | App canvas background |
| ink | `--color-ink` | `#37352F` | Primary text, logo |
| marigold | `--color-marigold` | `#2383E2` | Primary CTA / active — **once per view max** |
| marigold-foreground | `--color-marigold-foreground` | `#FFFFFF` | Text on marigold CTAs |
| brick | `--color-brick` | `#E03E3E` | Destructive, errors — sparing |
| meadow | `--color-meadow` | `#0F7B6C` | Success, completed/done |
| ocean | `--color-ocean` | `#0B6E99` | Calendar / link accent |
| slate | `--color-slate` | `#6940A5` | **The AI layer only** |

Derived neutrals — define these, don't eyeball them:

| CSS variable | Hex | Role |
|---|---|---|
| `--color-sidebar` | `#F7F6F3` | Sidebar surface (elevated vs canvas) |
| `--color-surface-raised` | `#F1F1EF` | Cards, popovers, gray callouts |
| `--color-border` | `rgba(55, 53, 47, 0.09)` | Hairline dividers |
| `--color-border-strong` | `rgba(55, 53, 47, 0.16)` | Inputs, tables, emphasis |
| `--color-text-secondary` | `#787774` | Body secondary |
| `--color-text-muted` | `#9B9A97` | Metadata |

Tint variables for status pills: `--color-marigold-tint` `#DDEBF1`,
`--color-meadow-tint` `#DDEDEA`, `--color-brick-tint` `#FBE4E4`,
`--color-slate-tint` `#EAE4F2`, `--color-ocean-tint` `#DDEBF1`.

Map every one of these into the Tailwind theme so components write `bg-paper`,
`text-ink`, `border-border` — never `bg-[#FFFFFF]`.

**Minimal light:** accents desaturate to Notion gray (`#9B9A97` / tint `#F1F1EF`);
slate and ink stay. Implement as an alternate set of custom-property values on a
`data-minimal` root attribute — accent usage must survive muting without breaking
hierarchy.

Light neutrals and block colors are derived from Notion’s public CSS variable
ecosystem. MIT reference implementations:
[udus122/notion-renderer](https://github.com/udus122/notion-renderer),
[shade-solutions/notion-design-system](https://github.com/shade-solutions/notion-design-system)
(structural Tailwind pattern — prefer `#F7F6F3` sidebar over cooler grays).

### Dark mode (Notion-caliber)

Toggled via `data-theme="dark"` on `<html>`. Values live only in `globals.css` — never
hardcoded in components. **`--color-marigold` is Notion blue `#2383E2` in both
themes** so CTAs / active nav match Notion chrome. One accent per view still applies.

Canvas and sidebar are **unified** at `#191919` (no elevated sidebar rail). Elevation
comes from `--color-surface-raised` (`#252525`) for cards, popovers, and menus.

**Borders:** hairline chrome uses low-opacity white (`rgba(255,255,255,0.13)`);
structural / input borders use solid `#373737`.

| CSS variable | Dark value | Role |
|---|---|---|
| `--color-paper` | `#191919` | App canvas |
| `--color-sidebar` | `#191919` | Sidebar (unified with canvas) |
| `--color-surface-raised` | `#252525` | Cards, popovers, menus, gray callouts |
| `--color-border` | `rgba(255, 255, 255, 0.13)` | Hairline dividers |
| `--color-border-strong` | `#373737` | Inputs, tables, emphasis |
| `--color-ink` | `rgba(255, 255, 255, 0.9)` | Primary text |
| `--color-text-secondary` | `#9B9B9B` | Body secondary |
| `--color-text-muted` | `#6F6F6F` | Metadata |
| `--color-marigold` | `#2383E2` | Primary CTA / active (Notion blue) |
| `--color-marigold-foreground` | `#FFFFFF` | Text on marigold CTAs |
| `--color-marigold-tint` | `#364954` | Blue callout / status tint |
| `--color-brick` | `#FF7369` | Destructive text |
| `--color-brick-tint` | `#594141` | Destructive bg |
| `--color-meadow` | `#4DAB9A` | Success text |
| `--color-meadow-tint` | `#354C4B` | Success bg |
| `--color-ocean` | `#529CCA` | Calendar / link accent |
| `--color-ocean-tint` | `#364954` | Blue surface tint |
| `--color-slate` | `#9A6DD7` | AI layer text |
| `--color-slate-tint` | `#443F57` | AI layer bg |

Files product tokens (`--color-files-*`) override to the same Notion tiers under
`[data-theme="dark"]`.

**Minimal dark:** accents desaturate to cool gray (`#8A8A8A` / tint `#2F2F2F`) on the
`#191919` base; ink and slate stay.

Dark neutrals and block colors are derived from Notion’s public CSS variable ecosystem
(verified against live app extractions). MIT reference implementations:
[udus122/notion-renderer](https://github.com/udus122/notion-renderer),
[shade-solutions/notion-design-system](https://github.com/shade-solutions/notion-design-system)
(structural Tailwind pattern only — prefer `#191919` / `#252525` over its legacy
`#2F3437` secondary).

---

## 2. Type (provisional)

| Family | CSS variable | Use |
|---|---|---|
| **Sentient** or **Gambetta** (Fontshare) | `--font-display` | Landing headlines ONLY |
| **General Sans** (Fontshare) | `--font-sans` | All UI + body + page titles |
| **Geist Mono** | `--font-mono` | Data, IDs, shortcuts, code |

Load via `next/font`. Two weights only — 400 regular, 500 medium.

Scale — define as Tailwind text styles, not one-off sizes:

| Style | Size / weight / line-height | Use |
|---|---|---|
| display | 40–64 / 400 (display font) | Landing hero only |
| h1 | 27 / 500 / 1.2 | Page + database names |
| h2 | 20 / 500 | Section headers |
| h3 | 16 / 500 | Sub-sections |
| body | 14.5 / 400 / 1.6 | Default text, blocks |
| small | 13 / 400 | Metadata, secondary rows |
| label | 11.5 / 500 / uppercase / +0.04em | Sidebar headers, table columns |
| mono | 13 / 400 (mono font) | Data / shortcuts |

Sentence case everywhere. Never Title Case, never ALL CAPS (except the label style).

---

## 3. Spacing, radii, borders

- **Spacing scale** (4px base): 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48. Tailwind's
  default scale already covers these — use `p-4`, `gap-2`, etc. Never `p-[13px]`.
- **Radii:** controls/buttons/inputs = 8 (`rounded-lg`) · inline cards = 12 · action cards
  = 14–16 · pills/tabs = full. Never round a single-sided border.
- **Borders:** 1px `--color-border` default. **No shadows for elevation** — use the border
  plus `--color-surface-raised`. Flat, always. No gradients, no glow.
- **Sidebar width:** default 210px, **draggable** between 200–400px (persisted). **DECIDED
  (2026-07-15):** Notion-style full-hide collapse (replaces the 2026-07-14 icon rail):
  1. **Expanded** — persisted width in the layout grid; drag the right edge to resize;
     click the resize handle (without dragging) or `<<` to hide.
  2. **Hidden** — 0px spacer; canvas is full-width. A floating three-line (hamburger)
     control sits at the top-left of the canvas; an invisible left-edge zone also
     reveals the sidebar on hover.
  3. **Hover-peek** — **inset floating card** (not full viewport height): ~52px from top,
     rounded, bordered, floats over the canvas; dismissed on mouse-leave / Esc; lock/pin
     expands it back into the layout. ~500ms prevent-hover after collapse.
  ~200ms hover-intent delay so the peek doesn't flicker; `⌘\` toggles expanded/hidden;
  preference + width persist per user; canvas never reflows during a peek; honor
  reduced-motion. Sidebar footer reserves a slot for the plan/credit card (Plus/Pro see
  the meter, Free sees nothing). Workspace menu carries Settings / Invite / Upgrade /
  Log out (Notion-style).

  **Record peek (database only):** opening a record uses `?p=&peek=center|side` — center
  modal or right side panel with a mode switcher; Esc/backdrop closes.

---

## 4. Signature law in the UI

*Line art = structure; filled color = the user's life and work.*

- **Empty database / empty view:** faint line-art scaffolding (hairline grid, ghosted
  column headers, dotted row placeholders) that fills with color as real records arrive.
  An empty state is an invitation, not an apology.
- **Empty page:** hairline block placeholders, not a blank void.
- **Illustration genre** (empty states + landing): colorful flat geometric vector — the
  Darya Semenova *genre*, never her actual images. Prototype in Recraft; commission an
  owned set pre-launch. Do NOT ingest paid third-party template art (IP risk).

---

## 5. Component inventory

Build as React components in `apps/web`. Every one lands in `/design` with all its states
before it gets used in a screen.

- **Sidebar** — workspace switcher (Notion-style menu) · Home · quick actions (Search /
  Inbox) · nav group (Tasks / Calendar / Files) · collapsible Pinned / Pages / Private ·
  AI group pushed to bottom (Planevo AI in slate) · plan meter slot in footer.
- **NavItem** — states: default / hover / active / AI. Active = marigold pip + subtle fill.
- **TopBar** — breadcrumb (left) · quiet slate "Ask Planevo AI" pill + avatar (right).
  A pill, not a glowing button — the present-not-pushy rule made visual.
- **ActionCard** — icon + title + one-line subtitle + dotted-grid texture + illustrated
  mini-preview. This is the component carrying the reference craft.
- **DatabaseTable** — header row (label style) · rows · status pills · inline view-switcher
  tabs (Table / Board / Calendar / List) mounted on the database.
- **ViewSwitcher** — the four-view tab control. Shared by every database surface.
- **StatusPill** — variants using the tint tokens.
- **TaskRow / Checkbox** — unchecked = hairline square; checked = meadow fill + check.
- **Button** — primary (ink fill) · cta (marigold, rare) · secondary (hairline border) ·
  ghost. One accent per view.
- **EmptyState** — the line-art scaffolding component. Variants: page, database, list.
- **CommandBar** — the propose→confirm→execute overlay; always previews before acting.
- **AgentBuilder** — 4 steps: Persona → Knowledge → Workflows/triggers → Visibility.

---

## 6. The `/design` route

The kitchen sink. Not shipped to users — a dev route (or gated behind an env flag).
It renders, top to bottom:

1. Every color token as a labeled swatch, with its variable name.
2. Every type style, with live sample text.
3. The spacing and radii scales.
4. Every component above, in every state, on paper.
5. A minimal-mode toggle that flips the root attribute, so accent-muting can be checked live.

This is where you decide whether marigold survives. Build it second, right after the token
layer, and keep it current — a component that isn't in `/design` doesn't exist.

---

## 7. Screen inventory (build order)

Everything inherits the app shell, so it goes first. Full per-screen detail and prompts
live in `docs/design-build-sheet.md`.

1. **App shell** — sidebar (3-state collapse, see §3) + top bar + open canvas.
1.5. **Home (command center)** — the default route. DECIDED 2026-07-14, adapted from the
   Acme AI reference (craft kept, agent-first IA rejected): greeting (no "assign your
   task" subline) · ActionCard grid hero — New task / Connect calendar / New workspace /
   Upload a file / Browse templates / Open Planevo AI (slate, the only AI presence; may
   be cut after browser review) · Recent / continue-where-you-left-off row · bottom
   **quick-capture bar** (NL parse to records with a propose→confirm chip — NOT chat;
   quiet slate "Ask Planevo AI" handoff inside). Adaptive: first-run the cards are the
   hero; as content grows, recents rise and cards compress to a smaller row — never
   removed. Quick-capture bar and the ⌘K command bar are the SAME component + parser
   mounted in two places.
2. **Page / editor view** — BlockNote surface; the block↔record relationship.
3–6. **Database views** — table → board → calendar → list.
7–9. **Sidebar destinations** — Tasks · Calendar (workspace-wide + GCal) · Files.
10. **Auth**.
11–13. **Onboarding** — routing question → living workspace → starter tasks.
14. **Template picker** — template / blank / describe, three equal options.
15–16. **Planevo AI** — welcome · active chat.
17. **Describe-to-build preview** — the editable mock-before-confirm moment.
18–19. **Agents** — library · builder.
20–21. **Command bar** · **Audit log**.
22. **Settings**.

The landing page is **not** in this list — separate file, separate pipeline (Remotion /
GSAP / Motion / Higgsfield). It must consume this same token layer.

---

## 8. Present-not-pushy AI — visual rules

- Planevo AI lives at the **bottom** of the sidebar and as a quiet slate pill in the top
  bar. Never a floating glowing orb, never a modal on load.
- No sparkle emoji in core flows. Describe-to-build sits inside the template picker as one
  of three equal options.
- Every AI/agent action shows a preview and writes to a visible audit log. Trust is a
  visible feature, not a footnote.
