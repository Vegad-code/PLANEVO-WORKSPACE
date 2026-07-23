# Fable 5 Phase 3 — What to Paste Into Claude

Use this checklist when starting the Phase 3 orchestrator run (Calendar + Files products).

---

## Which orchestrator?

| Mode | File | Use when |
|------|------|----------|
| **Ship (recommended)** | `fable-5-phase-3-ship-orchestrator.md` | Code-first; one review session at Task 15 |
| Council | `fable-5-phase-3-orchestrator.md` | Opus review every 2 tasks; council meetings |

---

## Minimum paste (recommended — repo access)

| # | What | File or action |
|---|------|----------------|
| 1 | **The full orchestrator prompt** | Paste entire contents of **`fable-5-phase-3-ship-orchestrator.md`** (or council variant above) |
| 2 | **Calendar reference (dark)** | Attach `.cursor/projects/Users-jabbo-PLANEVO/assets/image-be1ace26-5303-469f-aac7-c6c331314938.png` |
| 3 | **Calendar reference (light)** | Attach `.cursor/projects/Users-jabbo-PLANEVO/assets/image-79c8ae37-c7f4-43fe-a00c-a83777146d65.png` |
| 4 | **Files reference (Untitled UI)** | Attach `.cursor/projects/Users-jabbo-PLANEVO/assets/image-7582d937-3a26-4774-957b-222e46c6d149.png` |
| 5 | **Files reference (CloudNest)** | Attach `.cursor/projects/Users-jabbo-PLANEVO/assets/image-a893f2aa-6474-4895-8bf3-5b95f0bbd457.png` |
| 6 | **Kickoff line** | See below |

**You do NOT need to paste other `.md` files** if Claude has **repo access** — the orchestrator tells Fable to read them in-repo.

---

## Optional attachments (no repo access only)

| File | Why |
|------|-----|
| `docs/superpowers/plans/2026-07-19-ecosystem-phase-3-calendar-files.md` | Full task steps 1–15 |
| `docs/superpowers/specs/2026-07-19-phase-3-calendar-files-design.md` | Layout override + F-04/F-05 design |
| `docs/planevo-feature-spec.md` (F-04, F-05, F-02 sections) | Product spec |
| `docs/planevo-prd.md` (§8 Phase 3) | Roadmap authority |
| `AGENTS.md` | Inviolable rules |
| `.superpowers/ecosystem-phase-3/lessons.md` | Implementation gotchas |

---

## Kickoff line (paste after the orchestrator + images)

**Ship mode (default):**

```
You are Fable 5 Chief Orchestrator for Planevo Ecosystem Phase 3 — Calendar + Files (ship mode).

The four attached images are NON-NEGOTIABLE layout references:
- Calendar: three-pane week view (calendars sidebar · Today column · week time grid)
- Files: CloudNest / Untitled UI cabinet (greeting, actions, chips, tabs, table, storage meter)

Code-first: Tasks 1–15 in order, commit as you go, one Review Session at the end. Begin Task 1 now.

## Engineering standard

You are a senior full-stack engineer shipping production software. Every line you write must be instantly legible to any engineer opening this repo cold — readable like prose, not a puzzle.

**Legibility (non-negotiable)**
- Names say what they mean: `loadCalendarWeek`, not `fetchData2`. Event handlers use `handle` prefix.
- One clear responsibility per file. If a reviewer needs a map to follow the logic, split it.
- Prefer straight-line code over cleverness. No nested ternaries, no mystery booleans, no abbreviations.
- Types are documentation: explicit interfaces at boundaries; no `any`; exhaustive switches on unions.
- Comments explain *why*, not *what*. If the code needs a comment to say what it does, rename or restructure first.
- Match existing patterns in the file you are editing — same naming, imports, error shape, test style.

**Production bar**
- Correctness first: run the tests; paste pass/fail output for claims.
- Security at boundaries: `getUser()` on server, Zod on inputs, RLS respected — never bypass with service role in client code.
- Fail loudly with useful messages at system edges; do not blanket-wrap with silent catches.
- UI uses Planevo tokens only (`bg-paper`, `text-ink`, etc.) — no hardcoded hex or arbitrary pixels.
- Scope discipline: implement exactly what the task asks. No drive-by refactors, no speculative abstractions, no "while I'm here" features.

**How you work**
- Read the surrounding code before writing new code.
- Smallest correct diff wins.
- Land `/design` states before wiring product routes when the task is UI.
- When spec and screenshot layout conflict with kernel patterns, spec wins — product tables, not DatabaseFace.

**Definition of done**
A task is done when: behavior matches spec, tests pass, types check, the diff is easy to review in one sitting, and you can explain every file you touched in two sentences each.

Do not report plans — ship the code, then report what landed with evidence.
```

**Council mode** (if using `fable-5-phase-3-orchestrator.md`):

```
You are Fable 5 Chief Orchestrator for Planevo Ecosystem Phase 3 — Calendar + Files.

The four attached images are NON-NEGOTIABLE layout references. Tasks 1–15 in order, Opus reviews every 2 tasks, /design before route wire-up. /loop 10m. Begin.
```

---

## Complete file index (everything Fable + Opus workers should read)

### Authority & rules

| Path | Purpose |
|------|---------|
| `AGENTS.md` | Inviolable rules; ecosystem model; token law |
| `docs/planevo-prd.md` | v2.0 strategy; Phase 3 in §8 |
| `docs/planevo-feature-spec.md` | F-04 Calendar, F-05 Files, F-02 links, F-03 cross-links |
| `docs/design-brief.md` | Tokens, type scale, component craft |
| `docs/design-build-sheet.md` | Screen build order |

### Phase 3 artifacts (this run)

| Path | Purpose |
|------|---------|
| `docs/superpowers/prompts/fable-5-phase-3-ship-orchestrator.md` | **Ship orchestrator (default)** |
| `docs/superpowers/prompts/fable-5-phase-3-orchestrator.md` | Council orchestrator (optional) |
| `docs/superpowers/plans/2026-07-19-ecosystem-phase-3-calendar-files.md` | Implementation plan (Tasks 1–15) |
| `docs/superpowers/specs/2026-07-19-phase-3-calendar-files-design.md` | Design spec + screenshot override |
| `docs/superpowers/prompts/fable-5-prompting-notes.md` | Fable 5 behavior blocks |
| `docs/superpowers/ecosystem-phase-3/verification.md` | Gate checklist (fill in Task 15) |
| `.superpowers/ecosystem-phase-3/council-log.md` | Council minutes |
| `.superpowers/ecosystem-phase-3/worker-status.md` | Per-agent status |
| `.superpowers/ecosystem-phase-3/lessons.md` | Confirmed approaches |

### Prior phase context (read, don't re-implement)

| Path | Purpose |
|------|---------|
| `docs/superpowers/plans/2026-07-17-ecosystem-phase-2-tasks-product.md` | Tasks product patterns |
| `docs/superpowers/specs/2026-07-17-phase-2-tasks-product-design.md` | Lumis craft precedent |
| `docs/superpowers/ecosystem-phase-2/verification.md` | Phase 2 gate evidence |
| `.superpowers/ecosystem-phase-2/lessons.md` | Tasks gotchas (if exists) |

### Schema & migrations

| Path | Purpose |
|------|---------|
| `supabase/migrations/20260718120000_ecosystem_product_tables.sql` | `calendars`, `calendar_events`, `file_links` |
| `supabase/migrations/20260718160000_phase2_final_integrity.sql` | RLS hardening, `file_sources.user_id` |

### Core (extend — Tasks 1–5)

| Path | Purpose |
|------|---------|
| `packages/core/src/types/calendar.ts` | Create in Task 1 |
| `packages/core/src/state/calendar-state.ts` | Week range helpers |
| `packages/core/src/queries/product-calendar.ts` | Create in Task 2 |
| `packages/core/src/mutations/product-calendar.ts` | Create in Task 3 |
| `packages/core/src/queries/product-files.ts` | Create in Task 4 |
| `packages/core/src/mutations/product-files.ts` | Create in Task 5 |
| `packages/core/src/mutations/task-cross-links.ts` | Existing `scheduleTask` |
| `packages/core/src/defaults/product-defaults.ts` | Default calendar seed |

### Web — Calendar (Tasks 6–11)

| Path | Purpose |
|------|---------|
| `apps/web/features/calendar-product/` | New module (sidebar, today, grid, peek) |
| `apps/web/lib/calendar/scope-prefs.ts` | All \| This workspace |
| `apps/web/app/(workspace)/calendar/page.tsx` | Strangler cutover |
| `apps/web/app/(workspace)/calendar/actions.ts` | Server actions |
| `apps/web/app/design/calendar-product-preview.tsx` | Kitchen sink |
| `apps/web/features/calendar/calendar-view.tsx` | **Legacy kernel — replace** |

### Web — Files (Tasks 12–14)

| Path | Purpose |
|------|---------|
| `apps/web/features/files-product/` | New module (cabinet, table, upload, preview) |
| `apps/web/lib/files/scope-prefs.ts` | All \| This workspace |
| `apps/web/app/(workspace)/files/page.tsx` | Strangler cutover |
| `apps/web/app/(workspace)/files/actions.ts` | Server actions |
| `apps/web/app/design/files-product-preview.tsx` | Kitchen sink |
| `apps/web/features/files/files-view.tsx` | **Legacy kernel — replace** |
| `apps/web/lib/queries/files.ts` | **Legacy workspace-scoped — replace** |

### Web — Cross-links & patterns to reuse

| Path | Purpose |
|------|---------|
| `apps/web/features/tasks-product/cross-link-actions.tsx` | Schedule / Attach patterns |
| `apps/web/features/tasks-product/tasks-product-view.tsx` | Product shell pattern |
| `apps/web/lib/tasks/scope-prefs.ts` | Scope pref pattern |
| `apps/web/app/(workspace)/tasks/page.tsx` | Strangler cutover reference |
| `apps/web/features/shell/app-shell.tsx` | Global IA (do not replace) |

### Reference images

| Path | Product |
|------|---------|
| `.cursor/projects/Users-jabbo-PLANEVO/assets/image-be1ace26-5303-469f-aac7-c6c331314938.png` | Calendar (dark) |
| `.cursor/projects/Users-jabbo-PLANEVO/assets/image-79c8ae37-c7f4-43fe-a00c-a83777146d65.png` | Calendar (light) |
| `.cursor/projects/Users-jabbo-PLANEVO/assets/image-7582d937-3a26-4774-957b-222e46c6d149.png` | Files (Untitled UI) |
| `.cursor/projects/Users-jabbo-PLANEVO/assets/image-a893f2aa-6474-4895-8bf3-5b95f0bbd457.png` | Files (CloudNest) |

---

## One-shot mega-prompt (paste package for Claude Code)

If you want a **single first message** that points at everything without pasting the full orchestrator body, use:

```
Read and obey, in order:
1. AGENTS.md
2. docs/superpowers/prompts/fable-5-phase-3-ship-orchestrator.md (you ARE this orchestrator)
3. docs/superpowers/plans/2026-07-19-ecosystem-phase-3-calendar-files.md
4. docs/superpowers/specs/2026-07-19-phase-3-calendar-files-design.md
5. docs/planevo-feature-spec.md F-04 and F-05

Four reference images are attached — Calendar three-pane week layout and Files CloudNest cabinet are NON-NEGOTIABLE layout targets for /calendar and /files.

You are Fable 5 Chief Orchestrator. Opus 4.8 workers implement Tasks 1–15. Run startup checklist, kickoff council, dispatch Implementer-A on Task 1. /loop 10m. Begin.
```

---

*Package index v1.0 · July 19, 2026*
