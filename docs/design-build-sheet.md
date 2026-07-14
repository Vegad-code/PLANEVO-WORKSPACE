# Planevo — Build Sheet

22 core screens. We **design in code** — Next.js App Router + Tailwind, no Figma, no mockup
step. The design is the build.

Build **one screen at a time, in order.** The order tracks the PRD build phases so you're
never building a screen whose foundations aren't defined yet.

The landing page is intentionally NOT in this list — it lives in its own file and its own
animation pipeline (Remotion / GSAP / Motion / Higgsfield). It consumes the same token
layer so the two can't drift apart.

Companion to `AGENTS.md`, `docs/design-brief.md`, `docs/planevo-prd.md`.

---

## How to run this with Claude Code

**Step 0 — kickoff (paste once, before anything else):**

> Read `AGENTS.md`, then `docs/design-brief.md`, then PRD §5.8. Confirm two rules back to
> me: (1) workspace-first IA, never agent-first, and (2) reference images are craft-only,
> never layout. Then build ONLY the token layer: every color, font, type style, spacing,
> and radius from the design brief as CSS custom properties in `globals.css`, mapped into
> the Tailwind theme so components can write `bg-paper` / `text-ink` / `border-border`.
> No components, no screens yet. Show me the files and wait.

**Step 0.5 — the kitchen sink (paste second):**

> Build the `/design` route per §6 of the design brief: every color token as a labeled
> swatch with its variable name, every type style with live sample text, the spacing and
> radii scales, and a minimal-mode toggle. No product components yet — just tokens. Then
> stop and show me.

**This is the checkpoint.** Look at it in the browser. Decide whether marigold, paper, and
the type scale survive contact with reality. Change them now, in one file, before 22
screens depend on them.

**Then for each screen — the pattern is always the same:**

> Screen N — [name]. Obeying `AGENTS.md`, using only themed tokens (never a raw hex or
> arbitrary pixel value), build [the spec below]. Any new component goes in `/design` with
> all its states first. Then stop and show me — do not start the next screen.

Never batch these. Review each against the design brief before moving on.

---

## GROUP A — Foundation & kernel

### 1. App shell
The layout every other screen inherits. Sidebar + top bar + canvas.
Components: `Sidebar`, `NavItem`, `TopBar`. Route: the app layout.

> Screen 1 — App shell. Build the app shell as the layout: a 210px sidebar (workspace
> switcher at top; nav group Workspace / Tasks / Calendar / Files; Pages tree below; AI
> group pushed to the bottom with Planevo AI in slate and Agents; account/settings
> footer), a top bar (breadcrumb left; a quiet slate "Ask Planevo AI" pill and avatar
> right), and a canvas slot. Active nav = a single marigold pip. Flat, paper + ink, no
> shadows. Then stop and show me.

### 2. Page / editor view
The BlockNote surface. Where retroactive structure lives (block↔record).
States: filled page, empty page (hairline placeholders — signature law).

> Screen 2 — Page / editor view. Build the page route: title with icon, then a mix of
> blocks (headings, paragraph, bulleted list, checkbox list, toggle, an inline database
> embed). Include the block hover state with drag handle + "+" add control. Then the
> empty-page state: faint hairline block placeholders inviting a first block, not a blank
> void. Then stop and show me.

### 3. Database — Table view
The default database surface. Typed properties as columns.
Components: `DatabaseTable`, `ViewSwitcher`, `StatusPill`, `EmptyState`.

> Screen 3 — Database table view. Build a database in table view: column headers in the
> label type style, record rows, a select/status property as pills, a date column, and the
> `ViewSwitcher` (Table / Board / Calendar / List) mounted on the database with Table
> active. Include a "+ New" row and the empty-database state as faint line-art scaffolding
> per the signature law. Then stop and show me.

### 4. Database — Board view
Same data, grouped by a select property.

> Screen 4 — Database board view. Reusing the same database and `ViewSwitcher` (Board
> active), build a kanban grouped by a status property: columns of record cards (title,
> property chips, due date), a count per column, and an add-card affordance per column.
> Then stop and show me.

### 5. Database — Calendar view
Records on a month grid by date property. Scope: ONE database.

> Screen 5 — Database calendar view. Reusing the same database (Calendar active), build a
> month calendar with records as chips on their date, month nav header, and a subtle today
> marker. This is the calendar view of a single database — not the workspace calendar
> (Screen 8). Then stop and show me.

### 6. Database — List view
Compact, low-chrome. Good default for notes.

> Screen 6 — Database list view. Reusing the same database (List active), build a compact
> list: one record per row, primary property prominent, 2–3 secondary properties inline and
> muted, hover state, "+ New" row. Then stop and show me.

---

## GROUP B — Sidebar destinations (reuse Group A components — do NOT rebuild views)

### 7. Tasks
Opens the default Task database in board/list. Feels like a task app; is a database.

> Screen 7 — Tasks. Reusing the board and list view components already built, compose the
> Tasks route: the default Task database pre-populated with realistic student/founder
> tasks (statuses, priorities, due dates working with zero config), board by default with
> a list toggle. Include the empty state. Reuse existing components; do not rebuild views.
> Then stop and show me.

### 8. Calendar (workspace-wide)
Every dated record across the workspace PLUS Google Calendar events. Different scope
from Screen 5. One clean view in V1, no skins.

> Screen 8 — Calendar. Build the workspace calendar route: one clean month view rendering
> dated records from every database plus Google Calendar events (distinguish GCal subtly).
> Month/view nav header. Wider in scope than the per-database calendar in Screen 5. No
> visual skins — that's post-V1. Then stop and show me.

### 9. Files
A Documents database. Uploads are records — every file becomes a source for Planevo AI.

> Screen 9 — Files. Build the Files route as a Documents database: grid or list of file
> records (name, type, size, date, tags), upload affordance, file-preview panel. Reuse
> database components. Include the empty state. Then stop and show me.

---

## GROUP C — Entry & onboarding

### 10. Auth
Supabase Auth. Calm, on-brand, a taste of the landing warmth.

> Screen 10 — Auth. Build sign-up and log-in as two states of one layout: email + Google
> OAuth, brand mark, one line of positioning, minimal fields, one marigold CTA. Then stop
> and show me.

### 11. Onboarding — routing question
One tap. No wizard chrome.

> Screen 11 — Onboarding step 1. Build the single routing question: "What are you
> organizing?" with four large calm choice cards (Work / Personal / School / Something
> else). One tap, no wizard chrome, no AI announcement. Then stop and show me.

### 12. Onboarding — land in living workspace
Silent inference. NO sparkle buttons, NO "personalize with AI" prompt.

> Screen 12 — Onboarding step 2. Reusing the app shell, show the user landing inside a
> living, pre-populated workspace adapted to their routing answer (a School user sees
> Assignments / Exams / Readings). Everything editable in place. Absolutely no sparkle
> buttons and no AI-personalization prompt — the adaptation is silent. Then stop and show me.

### 13. Onboarding — starter tasks
The starter board IS the onboarding.

> Screen 13 — Onboarding step 3. Build the starter task board with 4–5 real checkable
> onboarding tasks: "Rename this workspace", "Add your first real task", "Drag it to Done",
> "Connect Google Calendar", "Import from Notion". Show one checked to convey progress.
> Then stop and show me.

### 14. Template picker
template / blank / describe — three equal options. Describe-to-build is not privileged.

> Screen 14 — Template picker. Build the new-page/new-database picker with three equal
> options side by side: Template (small gallery), Blank, and Describe it (one-line input).
> None visually louder than the others. Then stop and show me.

---

## GROUP D — AI & agents (slate token; present, not pushy)

### 15. Planevo AI — welcome
Empty state of the chat workspace. Welcoming, first-class, optional. NOT the home.

> Screen 15 — Planevo AI welcome. Build the empty state of the Planevo AI route: a calm
> welcome, a few example prompts grounded in the user's workspace, the input with attach /
> web-search / model affordances. Slate accents. This is a surface the user chose to open —
> it is not the app home. Then stop and show me.

### 16. Planevo AI — active chat
Live conversation, rich in-chat rendering, grounded citations.

> Screen 16 — Planevo AI active. Build an active conversation: user messages and responses,
> one response with rich rendering (a table or formatted doc) and inline citations to
> workspace/file sources. Show the propose→confirm pattern where the AI offers to create
> something. Slate accents. Then stop and show me.

### 17. Describe-to-build preview
The editable mock-before-confirm moment. The trust primitive made visible.

> Screen 17 — Describe-to-build preview. From a one-line description, render the result as
> an EDITABLE preview: a mock database with real property types and 2–3 example rows,
> inline-renamable, with clear Confirm / Edit actions. Nothing is created until confirm.
> Then stop and show me.

### 18. Agent library
First-party one-click agents.

> Screen 18 — Agent library. Build the agent library: cards for the three first-party
> agents (Daily Digest, Weekly Review, Workspace Cleanup) each with icon, name, one-line
> description, and a Use action, plus a "Build your own" entry point. The builder is always
> reachable. Then stop and show me.

### 19. Agent builder (4 steps)
Persona → Knowledge → Workflows/triggers → Visibility.

> Screen 19 — Agent builder. Build the 4-step builder with a step indicator: Step 1 Persona
> (name, icon, description, instructions), Step 2 Knowledge (scope: which pages /
> databases / files / integrations), Step 3 Workflows (what it may do + trigger: manual /
> schedule / on-event), Step 4 Visibility (where it appears). Then stop and show me.

### 20. Command bar
The propose→confirm→execute overlay. Global quick action + NL quick capture.

> Screen 20 — Command bar. Build the command bar as a centered overlay: one state mid-
> interaction proposing an action with an explicit confirm step, and a second state showing
> natural-language quick capture parsing "Physics homework friday 6pm #school". Then stop
> and show me.

### 21. Audit log
Plain-language, reversible history of every AI/agent action. A trust feature.

> Screen 21 — Audit log. Build the audit log: reverse-chronological list of agent/AI
> actions in plain language ("Created 3 tasks in Apps tracker"), each with timestamp,
> status (proposed / confirmed / executed / rejected), and an Undo affordance. Reads like a
> trust feature, not a debug console. Then stop and show me.

---

## GROUP E — System

### 22. Settings

> Screen 22 — Settings. Build the settings route: left settings nav (Account, Export,
> Integrations, Billing/Credits, Appearance) and the pane area. Show the Export pane (full
> Markdown + JSON export), the Integrations pane (Gmail, Google Calendar, Google Drive,
> Canvas — connect states), and the Appearance pane with the Minimal mode toggle. For
> Plus/Pro show the credit meter; Free never sees numbers. Then stop and show me.

---

## Reminders that apply to every screen

- Themed tokens only — never a raw hex, font name, or arbitrary pixel value in a component.
- One marigold accent per screen, max.
- AI surfaces use slate and never dominate.
- Every list/database gets an empty state built on the line-art signature law.
- New components land in `/design` with all their states before they're used.
- Reuse components across screens (especially the four views) — a design system, not 22
  one-offs.
- One screen per prompt. Review, then continue.

---

## The landing page (separate build — read before you start it)

Its own file, its own pipeline (Remotion / GSAP / Motion / Higgsfield MCP). Three things
keep it from fracturing the brand:

- **Share the token layer, don't re-pick.** It imports the same CSS custom properties.
  Same `paper`, `ink`, `marigold`, same fonts — one source. Re-pick colors by eye there and
  the two products stop looking like the same company.
- **Decide the hero's output format up front.** These tools split by target: GSAP and
  Motion animate live DOM in the real Next.js page (interactive, light); Remotion and
  Higgsfield produce rendered video (MP4 you embed and loop). A live SVG animation and a
  pre-rendered video are different builds — mixing them without a plan is how landing pages
  get heavy and janky.
- **Make the animation earn the brand.** The signature law is already an animation brief:
  hairline structure that draws itself on (SVG path draw-on) and fills with color as it
  resolves into the "figure in motion" hero. Animate *that*, not arbitrary movement.
