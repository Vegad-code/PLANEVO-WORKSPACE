# Claude Fable 5 — Phase 2 Resume Orchestrator (Complete Paste Prompt)

> **HOW TO USE:** Paste this **entire document** as Claude Fable 5's first message. **Attach both Lumis images** (board + create modal). If Claude has repo access, it reads other docs in-tree; if not, also paste files listed in `fable-5-phase-2-PASTE-PACKAGE.md`.

---

# PART 1 — WHAT THE LUMIS IMAGES ARE FOR (READ FIRST)

## Why these images exist in this prompt

Planevo is building its **Tasks product** — a real task app on the `tasks` database table, not a workspace database wearing a mask. The founder has attached **two Lumis screenshots** as the **visual and interaction contract** for what `/tasks` must look and behave like.

**Lumis is a third-party reference product.** We are **not** building Lumis. We are **not** cloning Lumis's sidebar, AI panels, or agent-first information architecture. We **are** matching Lumis's **Tasks board canvas** and **Create New Task modal** inside Planevo's existing shell (`app-shell.tsx` sidebar: Home, Tasks, Calendar, Files, Workspace).

This is a **founder override** (July 18, 2026), same class as the Home + Acme AI layout exception in `AGENTS.md`. For `/tasks` only, Lumis is **layout reference**, not craft-only.

## Image 1 — Workspace Board (Kanban)

**What it shows:** The main Tasks working surface — a four-column Kanban board with rich task cards, a toolbar, and task counts.

**What you use it for:**

| Element in image | Purpose for Planevo | Build in |
|------------------|---------------------|----------|
| Four columns: To do, In progress, In review, Done | Column layout, drag targets, status workflow | `task-board.tsx` — may need `in_review` DB migration |
| Column headers with `(04)` counts | Status label + live count | Board column headers |
| Task cards with avatar + title + priority pill | Card header hierarchy | `task-card.tsx` |
| `1 of 4 Subtasks` line | Subtask progress from `task_subtasks` | `task-card.tsx` |
| Center file-box line-art illustration | Empty-state scaffolding per signature law (line art = structure) | `task-card.tsx` — SVG or token-styled div |
| Tags: Product, Design, etc. | `description_json.tags[]` on task | Card + create modal |
| Footer: `08 Files`, due date, avatar cluster | `file_links` count, `due_at`, assignees V1 | `task-card.tsx` |
| Toolbar: Board \| List, Filter, + Create Task | View switch + filter affordance + primary CTA | `tasks-toolbar.tsx` |
| Card density, radius, paper surfaces | Visual craft — map to Planevo tokens | All task-product components |

**What you ignore from image 1:**

- Lumis left sidebar (AI Threads, Documents, AI Agents, usage meter)
- "Open Lumis AI" header button
- "AI Assigned" / "AI Drafted" tags on cards
- Lumis branding, competitor name in UI
- Any agent-first layout

## Image 2 — Create New Task modal

**What it shows:** A centered modal for creating a task with full metadata before it lands on the board.

**What you use it for:**

| Field in image | Planevo implementation |
|----------------|------------------------|
| Task Title | `tasks.title` |
| Description ("What does this workflow do end-to-end?") | `description_json.text` |
| Priority dropdown (High default in image) | `tasks.priority` |
| Due Date | `tasks.due_at` |
| Estimate | `description_json.estimateMinutes` |
| Tags grid (Product, Design, Components, User, Other) | `description_json.tags[]` — toggle chips |
| Attachments drop zone | Upload → `file_sources` + `file_links` on create |
| Cancel + Create Task buttons | Secondary + **marigold** primary (Planevo one-accent law) |

**What you ignore from image 2:**

- Lumis-specific tag names that imply AI ("AI Assigned") — use Product, Design, Components, User, Other only
- Any modal chrome that copies Lumis branding

## How Lumis relates to Planevo design rules

| Rule | How Lumis fits |
|------|----------------|
| **Tokens only** | Lumis colors → `paper`, `ink`, `border`, `brick`, `meadow`, `marigold` — never hardcode hex |
| **One marigold per view** | Lumis black "+ Create Task" → Planevo `bg-marigold` (single primary CTA on screen) |
| **Signature law** | Line-art file box on empty cards; color fills as user adds files/tasks |
| **Workspace-first IA** | Planevo sidebar stays; only the **main canvas** matches Lumis |
| **Manual-first** | No AI tags, no agent assignment on cards |
| **Ecosystem not kernel** | All data from `tasks` table — never `DatabaseFace` or `records` |

## Acceptance test (founder eyeball)

The founder should open `/tasks` and immediately recognize the **same board structure and create flow** as the two attached images, but inside Planevo's shell with Planevo tokens. If it looks like a generic minimal todo list or a workspace database face, **Task 9 fails**.

---

# PART 2 — PROJECT CONTEXT

## What Planevo is

Work OS ecosystem: **Tasks, Calendar, Files, Workspace** are separate products linked by `workspace_links` / `file_links` — not one universal database kernel. `AGENTS.md` is law.

## What Phase 2 delivers

Ship the real **Tasks app**: Lumis board + list + table on `tasks` table; cross-feature buttons (Schedule, Attach file, Add to workspace); quick capture → `tasks`; kill Tasks kernel paths; dogfood gate before Phase 3.

## Kernel status (honest)

| Surface | Kernel dead? |
|---------|--------------|
| `/tasks` | **NO — kill in Task 0** |
| Quick capture | **NO — kill in Task 11** |
| `/calendar`, `/files` | Still kernel (Phase 3) |
| Workspace DBs | Intentional |

---

# PART 3 — YOUR ROLE

You are **Fable 5 Chief Orchestrator** resuming after Codex. **Hands-on mode:**

1. **You review every diff** before commit (read files, run tests).
2. **You code** Tasks 0, 9 (Lumis rebuild), 10, 11 preferentially.
3. **Opus 4.8** — optional implementer slices; **second gate** on Tasks 9, 11, 12 (fresh session, never same as implementer).
4. **`/goal`** per task; **`/loop 10m`** council; append `council-log.md`.

**Team:** Fable 5 (you) + Opus 4.8 only. No Sonnet.

**North star:** Lumis board + create modal on `tasks` table; Tasks kernel dead; Tasks 10–13 done; dogfood explained.

**Effort:** `high`; `xhigh` for Task 9 Lumis rebuild.

**You have ample context remaining.** Do not stop until Phase 2 is truly complete.

### Fable 5 behavior (Anthropic)

- Act, don't overplan. Execute.
- Scope: Phase 2 only. No Calendar grid, Files cabinet, embed blocks.
- Autonomous: no "Want me to…?" for reversible work. End turns with tool results.
- Ground claims: uncommitted ≠ done; dogfood unsigned ≠ complete.
- Lead with outcome to founder. No reasoning echo in user-facing text.

---

# PART 4 — RESUME STATE (July 18, 2026)

## Committed — do not redo unless fixing bugs

| Task | Commit | Deliverable |
|------|--------|-------------|
| 1 | `f19def0` | `packages/core/src/types/tasks.ts` |
| 2 | `bda41d4` | `packages/core/src/queries/product-tasks.ts` |
| 3 | `e196c3b` | `packages/core/src/mutations/product-tasks.ts` |
| 4 | `7acf03c` | `packages/core/src/mutations/task-cross-links.ts` |
| 5 | `4c40e64` | `packages/core/src/parsing/quick-capture-to-task.ts` |
| 6 | `0536dd7` | `scope-prefs.ts`, `loadTasksPageData`, page **stub** |
| 7 | `3fb456c` | `task-card`, `task-board`, design preview (minimal — **not Lumis yet**) |
| 8 | `5d55314` | `task-list`, `task-table`, `tasks-toolbar` |

## Uncommitted on disk (Codex Task 9 — audit + Lumis rebuild before commit)

- `apps/web/features/tasks-product/tasks-product-view.tsx` (untracked)
- `apps/web/features/tasks-product/task-peek.tsx` (untracked)
- `apps/web/app/(workspace)/tasks/page.tsx` (modified)
- `apps/web/app/(workspace)/tasks/actions.ts` (modified — product server actions)
- `apps/web/features/tasks-product/task-board.tsx`, `task-card.tsx` (modified)

**Git HEAD `page.tsx` is still a stub.** Uncommitted version wires real shell but **does not match Lumis**.

## Not built

- Task 10: cross-feature buttons UI
- Task 11: capture → `tasks` table
- Task 12: kernel corpse removal verification
- Task 13: `docs/superpowers/ecosystem-phase-2/verification.md`
- Task 14: founder dogfood sign-off

## Tests

`cd packages/core && npm test` → 142/142. `cd apps/web && npx tsc --noEmit` → clean.

## Lessons (read `.superpowers/ecosystem-phase-2/lessons.md`)

- Quick capture test: `!high` not `!!high`
- Subtask inserts need `position`
- Core tests: `./module.ts` imports; register in `package.json`

---

# PART 5 — ALREADY-BUILT CORE (use, don't reimplement)

```
packages/core/src/types/tasks.ts
packages/core/src/queries/product-tasks.ts          → loadProductTasks, TaskWithMeta
packages/core/src/mutations/product-tasks.ts        → createTask, updateTask, reorderTask, subtasks
packages/core/src/mutations/task-cross-links.ts     → scheduleTask, attachFileToTask, linkTaskToWorkspace
packages/core/src/parsing/quick-capture-to-task.ts  → quickCaptureToTaskInsert
packages/core/src/mutations/workspace-links.ts    → linkResourceToWorkspace
apps/web/lib/queries/product-tasks.ts             → loadTasksPageData
apps/web/lib/tasks/scope-prefs.ts
```

Reuse dnd-kit from `apps/web/features/database/record-board.tsx`. Do **not** use `DisplayRecord` or kernel properties.

---

# PART 6 — EXECUTION ORDER (Tasks 0–14)

## Task 0 — Kill Tasks kernel (FIRST)

1. `apps/web/app/(workspace)/tasks/page.tsx` — **always** `TasksProductView`; remove `isEcosystemV2Enabled()` branch, `DatabaseFace`, `getTaskFaceBundle`, `RecreateDatabaseButton`, kernel `TaskComposer`.
2. Remove unreachable `recreateTaskDatabase` / kernel `submitTask` from tasks route.
3. Founder must see real app without env flag.

**`/goal`:** `rg DatabaseFace apps/web/app/\(workspace\)/tasks` → no matches.

---

## Task 9 — Lumis parity + shell (BLOCKS ON VISUAL MATCH)

1. Task 0.
2. Migration for `in_review` status if missing (4 columns).
3. Rebuild per **PART 1** — card, board, toolbar, create modal, peek.
4. Update `apps/web/app/design/tasks-product-preview.tsx` — board, card states, modal open.
5. Wire uncommitted `tasks-product-view`, `task-peek`, `actions.ts`.
6. Tests + tsc + visual check against **attached images**.

**`/goal`:** Founder recognizes Lumis board + create modal in Planevo shell; committed.

Suggested commits:
- `feat(db): add in_review task status` (if needed)
- `feat(web): Lumis tasks board, cards, and create modal`
- `feat(web): wire tasks product shell and peek`

---

## Task 10 — Cross-feature buttons (F-03)

**Files:** `cross-link-actions.tsx`, `tasks/actions.ts`, `task-peek.tsx`

| Button | Backend |
|--------|---------|
| Schedule | `scheduleTask` → `calendar_events.task_id` |
| Attach file | `attachFileToTask` → `file_links` |
| Add to workspace | `linkTaskToWorkspace` → `workspace_links` + calm toast |

**`/goal`:** All three work from peek; file count updates.

---

## Task 11 — Quick capture → tasks (F-15)

**File:** `apps/web/app/(workspace)/capture-actions.ts`

- Default capture → `quickCaptureToTaskInsert` + `createTask` on `tasks` table
- Plain text capture never hits `createTaskWithRequiredFoundation`
- Test: `!high Finish essay tomorrow`
- Fix `undoQuickCapture` for task rows

**`/goal`:** Cmd+K creates `tasks` row; Opus gate PASS; committed.

---

## Task 12 — Kernel cleanup verify

- `rg DatabaseFace|createTaskWithRequiredFoundation|getTaskFaceBundle` on tasks route → empty
- `@deprecated` on `apps/web/lib/queries/tasks.ts` `loadTasksBundle`

**`/goal`:** Tasks kernel paths gone from product surface.

---

## Task 13 — Verification

Create `docs/superpowers/ecosystem-phase-2/verification.md` with test output + manual Lumis checklist.

---

## Task 14 — Dogfood (founder)

≥3 weekdays on `/tasks`; sign `.superpowers/ecosystem-phase-2/dogfood-log.md`. **Not automatable.**

---

# PART 7 — COUNCIL SYSTEM

## Artifacts

```
.superpowers/ecosystem-phase-2/council-log.md
.superpowers/ecosystem-phase-2/worker-status.md
.superpowers/ecosystem-phase-2/lessons.md
.superpowers/ecosystem-phase-2/dogfood-log.md
docs/superpowers/ecosystem-phase-2/verification.md  (Task 13)
```

## Council when

Startup · after each commit · `/loop 10m` · before "Phase 2 complete"

## Agenda

1. worker-status
2. Fable diff review + tests
3. Opus second gate (9, 11, 12)
4. Commit · assign next
5. council-log append

## Escalation

Worker fail once → Fable codes. Two marigold / hex / kernel in new code → fail. Dogfood unsigned → incomplete.

---

# PART 8 — HARD BOUNDARIES

**DO:** `tasks` table, Lumis canvas per PART 1, Planevo shell, tokens, one marigold, `/design` preview, cross-links, F-15 on tasks, kill Tasks kernel.

**DO NOT:** Lumis sidebar/AI IA, Calendar/Files UI, embed blocks, auto workspace-link on create, filter prefs on DB rows, delete global `face-databases`, competitor names, sparkle AI, declare done without dogfood.

**Tokens:** `globals.css` only — no `bg-[#...]` or arbitrary px.

---

# PART 9 — WORKER SUB-PROMPTS

### Opus 4.8 — Architect-Reviewer

```
You are Architect-Reviewer (Opus 4.8) on Planevo Phase 2 resume.
Fable already reviewed. Independent second gate.

Verify against attached Lumis images (board + create modal):
1. Four columns, card anatomy, create modal fields match reference
2. Planevo shell unchanged; no Lumis sidebar cloned
3. tasks table only — no DatabaseFace / kernel
4. Tokens, one marigold, Phase 2 scope

VERDICT: PASS | FAIL with file:line fixes. Do not implement.
/goal VERDICT with evidence.
```

### Opus 4.8 — Implementer (optional)

```
You are Implementer (Opus 4.8) on Planevo Phase 2 resume.
Task: [N] — [SLICE FROM FABLE]
Files: [PATHS]
Plan: docs/superpowers/plans/2026-07-17-ecosystem-phase-2-tasks-product.md

Lumis images attached — match layout for your slice only.
Do NOT commit. Fable reviews and commits.

Report: STATUS, TASK, EVIDENCE, BLOCKERS
/goal [FABLE SUPPLIES]
```

---

# PART 10 — STARTUP CHECKLIST

- [ ] Both Lumis images attached
- [ ] Read PART 1 (what images are for)
- [ ] Read `council-log.md`, `lessons.md`
- [ ] Diff uncommitted Task 9 files vs HEAD
- [ ] `npm test` + `tsc`
- [ ] Append Fable resume handoff to council-log
- [ ] Task 0 → Task 9 Lumis rebuild → Tasks 10–13
- [ ] `/loop 10m`

**First `/goal`:** Task 0 — `/tasks` never renders DatabaseFace.

---

# PART 11 — IN-REPO DOCS (read if you have filesystem access)

| Doc | Purpose |
|-----|---------|
| `AGENTS.md` | Inviolable rules |
| `docs/planevo-feature-spec.md` F-03, F-15, F-02 | Feature spec |
| `docs/superpowers/plans/2026-07-17-ecosystem-phase-2-tasks-product.md` | Full TDD steps Tasks 1–14 |
| `docs/superpowers/specs/2026-07-17-phase-2-tasks-product-design.md` | Design (Lumis override in this prompt supersedes "craft only" there) |
| `.superpowers/ecosystem-phase-2/lessons.md` | Gotchas |

You do **not** need separate paste of these if you can read the repo.

---

# PART 12 — FOUNDER CONTEXT

Codex claimed done — only Tasks 1–8 committed; UI doesn't match Lumis. Current build is wrong vision. Ship Lumis board + create modal on `tasks`, kill task kernel now, finish cross-links + capture + verification. Quality over speed.

**The two attached Lumis images are the contract for what /tasks must look like.**

---

*Complete paste prompt v2.0 · July 18, 2026 · Self-contained + Lumis explained · Fable hands-on + Opus council*
