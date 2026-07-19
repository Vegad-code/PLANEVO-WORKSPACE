# Codex — Phase 2 Resume Orchestrator (Complete Paste Prompt)

> **HOW TO USE:** Paste this **entire document** as Codex's first message. **Attach both Lumis images** (board + create modal). Run `/goal` with the kickoff line from `codex-phase-2-PASTE-PACKAGE.md`.  
> **ONE SESSION ONLY.** Do not run Cursor agents or other orchestrators on this repo in parallel — AGENTS.md: one primary dev tool at a time.

---

# PART 1 — WHAT THE LUMIS IMAGES ARE FOR (READ FIRST)

## Founder override (July 18, 2026) — BINDING

Planevo is building its **Tasks product** on the `tasks` table. The founder attached **two Lumis screenshots** as the **visual and interaction contract** for `/tasks`.

**Lumis is a third-party reference.** We are **not** building Lumis. We are **not** cloning Lumis sidebar, AI panels, or agent-first IA. We **are** matching Lumis's **Tasks board canvas** and **Create New Task modal** inside Planevo's shell (`app-shell.tsx`: Home, Tasks, Calendar, Files, Workspace).

For `/tasks` only, Lumis is **layout reference**, not craft-only. Same class as the Home + Acme AI exception in `AGENTS.md`.

## Image 1 — Workspace Board (Kanban)

| Element in image | Build in |
|------------------|----------|
| Four columns: To do, In progress, In review, Done | `task-board.tsx` — `in_review` in core + migration `20260718130000_task_in_review_status.sql` |
| Column headers with counts | Board column headers |
| Cards: icon + title + priority pill + subtask line | `task-card.tsx` |
| Center file-box line-art illustration | `task-card.tsx` — signature law |
| Tags row | `description_json.tags[]` |
| Footer: file count, due date | `file_links` count, `due_at` |
| Toolbar: Board \| List \| Table, filter, + Create Task | `tasks-toolbar.tsx` — **one marigold** on Create |

**Ignore:** Lumis sidebar, AI threads, agent tags, Lumis branding.

## Image 2 — Create New Task modal

| Field | Implementation |
|-------|----------------|
| Task Title | `tasks.title` |
| Description | `description_json.text` |
| Priority | `tasks.priority` |
| Due Date | `tasks.due_at` |
| Estimate | `description_json.estimateMinutes` |
| Tags chips | `description_json.tags[]` |
| Attachments drop zone | Upload → `file_sources` + `file_links` on create |
| Cancel + Create Task | Secondary + **marigold** primary |

**Ignore:** AI-assigned tags, Lumis branding.

## Acceptance test

Founder opens `/tasks` and recognizes the **same board structure and create flow** as the two images, inside Planevo shell with Planevo tokens. Generic minimal todo list or `DatabaseFace` = **fail**.

---

# PART 2 — YOUR ROLE & TEAM

You are **Codex Chief Orchestrator** (GPT-5.6) **resuming** after Claude Fable 5 hit usage limits mid–Phase 2.

## Team shape — code first, review second

This is a **GPT-5.6 coding team**, not a review committee. Usage goes to **shipping code**.

| Role | Model | Job | Usage budget |
|------|-------|-----|--------------|
| **You (Orchestrator)** | GPT-5.6 | Assign `/goal`, code the hard slices yourself, commit, unblock | Primary — you code Tasks 9–11 preferentially |
| **Coder** | GPT-5.6 (fresh subagent) | Implement one task slice end-to-end | **~80% of subagent usage** |
| **Reviewer** | GPT-5.6 (fresh subagent) | One focused pass **after** code lands | **~20% — only after Coder reports GOAL_MET** |

**No Sonnet. No Opus. No Fable.** GPT-5.6 only unless the founder changes policy.

### How work flows (no `/loop`)

1. Orchestrator assigns **`/goal <measurable done criterion>`** to a **Coder**.
2. Coder implements, runs tests + `tsc`, reports **GOAL_MET** with evidence.
3. **Only then** dispatch a fresh **Reviewer** on that diff — one pass, PASS or numbered fixes.
4. On PASS → orchestrator commits → next `/goal`.
5. On FAIL → **Coder fixes** (same task, same `/goal`). Reviewer runs again **once**. If still FAIL → **orchestrator codes the fix** — do not spin a third review cycle.

**There is no `/loop`.** No timed council ticks. No standing meetings. Only chained `/goal` contracts until Phase 2 is done or blocked on the founder.

### Quality without review bloat

High quality is **non-negotiable** — but it comes from **coders doing the job right the first time**, not from endless review passes.

**Every Coder must before reporting GOAL_MET:**
- Read `AGENTS.md`, `lessons.md`, and the Lumis images for UI tasks
- Run `cd packages/core && npm test` and `cd apps/web && npx tsc --noEmit`
- Self-check: tokens only, one marigold, no kernel on `/tasks`, Lumis layout for Task 9
- Paste command output in the report — unverified claims = GOAL_BLOCKED

**Reviewer is a gate, not a co-author.** Reviewer does not implement. Reviewer does not re-litigate product scope. Reviewer checks: spec compliance, tests green, no obvious regressions. One page of fixes max; if the diff needs a rewrite, orchestrator codes it.

**Orchestrator codes when:** Coder blocked, review failed twice, or the slice is small enough that dispatching a subagent wastes more usage than doing it yourself (kernel kill, single-file fix).

**North star `/goal`:**

> `/tasks` on `tasks` table with Lumis board + create modal; cross-feature buttons work; quick capture inserts `tasks`; Tasks kernel dead; `verification.md` complete; core tests green; `tsc` clean.

**Effort:** `max` / `ultra` on Coders for Task 9 Lumis parity + Task 10 cross-links.

### Codex behavior

- Act, don't overplan. Execute.
- Scope: Phase 2 only. No Calendar grid, Files cabinet, embed blocks, onboarding refactors.
- Autonomous: no "Want me to…?" for reversible plan work. End turns with tool results.
- Ground claims: uncommitted ≠ done; dogfood unsigned ≠ complete.
- Lead with outcome to founder. Paste test output or commit hashes as evidence.
- **Do not touch** unrelated modified files (onboarding, shell, page-editor, Phase 1 migrations) unless required for Tasks.

---

# PART 3 — RESUME STATE (July 18, 2026 — verify on disk)

## Committed — do not redo unless fixing bugs

| Task | Commit | Deliverable |
|------|--------|-------------|
| 1 | `f19def0` | Core task types + status labels |
| 2 | `bda41d4` | `loadProductTasks`, `TaskWithMeta` |
| 3 | `e196c3b` | Product task CRUD + subtasks |
| 4 | `7acf03c` | `scheduleTask`, `attachFileToTask`, `linkTaskToWorkspace` |
| 5 | `4c40e64` | `quickCaptureToTaskInsert` |
| 6 | `0536dd7` | Scope prefs + `loadTasksPageData` + page strangler stub |
| 7 | `3fb456c` | Task card + board + design preview (minimal baseline) |
| 8 | `5d55314` | List, table, toolbar |
| **in_review** | `0bd5290` | Migration + core `in_review` + `createTask` description_json |
| **11** | `bdcf5cc` | Quick capture → `tasks` table (F-15) |

**Core tests:** `cd packages/core && npm test` → **143/143** (verify at startup).

## Uncommitted on disk — Fable Task 9 (audit before commit)

Likely present; **verify paths and Lumis parity against attached images:**

| File | Expected state |
|------|----------------|
| `apps/web/features/tasks-product/tasks-product-view.tsx` | Shell: toolbar, board/list/table, create modal, peek, optimistic DnD |
| `apps/web/features/tasks-product/task-peek.tsx` | Edit fields + subtasks; **no cross-link buttons yet** |
| `apps/web/features/tasks-product/create-task-dialog.tsx` | Full Lumis modal fields + attachments |
| `apps/web/features/tasks-product/task-board.tsx` | **4 columns** incl. `in_review` |
| `apps/web/features/tasks-product/task-card.tsx` | Illustration, tags, file count, due date |
| `apps/web/app/(workspace)/tasks/actions.ts` | Product server actions (`createProductTaskAction`, move, peek CRUD, attachments on create) |
| `apps/web/app/design/tasks-product-preview.tsx` | Board, card states, modal |

## Broken / incomplete — your job

| Item | Problem |
|------|---------|
| `apps/web/app/(workspace)/tasks/page.tsx` | Still has `isEcosystemV2Enabled()` + `DatabaseFace` fallback; imports `recreateTaskDatabase` which **no longer exists** in `actions.ts` → **`tsc` error** |
| Task 10 | No `cross-link-actions.tsx`; peek has no Schedule / Attach / Add to workspace |
| Task 12 | Kernel strangler not finished — page must be product-only |
| Task 13 | `docs/superpowers/ecosystem-phase-2/verification.md` missing |
| Task 14 | Founder dogfood — not automatable |
| Migration | `supabase/migrations/20260718130000_task_in_review_status.sql` — confirm applied on hosted Supabase before dogfooding In review column |

## Not your problem (leave alone unless blocking)

- Onboarding routes, `page-chrome`, shell sidebar tweaks, Phase 1 docs, unrelated `AGENTS.md` edits
- `/calendar`, `/files` still use kernel `DatabaseFace` (Phase 3)

## Lessons (read `.superpowers/ecosystem-phase-2/lessons.md`)

- Quick capture test string: `Finish essay !high tomorrow` (`!high` not `!!high`)
- Subtask inserts need `position`
- Core tests: `./module.ts` imports; register in `package.json`
- Lumis layout override July 18 — **not** craft-only for `/tasks`
- Concurrent agents caused edit war — **you are the only editor now**

---

# PART 4 — CORE YOU MUST REUSE (do not reimplement)

```
packages/core/src/types/tasks.ts
packages/core/src/queries/product-tasks.ts
packages/core/src/mutations/product-tasks.ts
packages/core/src/mutations/task-cross-links.ts     → scheduleTask, attachFileToTask, linkTaskToWorkspace
packages/core/src/parsing/quick-capture-to-task.ts
apps/web/lib/queries/product-tasks.ts               → loadTasksPageData
apps/web/lib/tasks/scope-prefs.ts
apps/web/app/(workspace)/capture-actions.ts         → Task 11 done in bdcf5cc — verify only
```

Reuse dnd-kit from `apps/web/features/database/record-board.tsx`. Never `DisplayRecord` or kernel properties on `/tasks`.

---

# PART 5 — EXECUTION ORDER (remaining work)

## Task 0 + 12 — Kill Tasks kernel (DO FIRST)

**Files:** `apps/web/app/(workspace)/tasks/page.tsx`

1. Remove `isEcosystemV2Enabled()` branch entirely.
2. Remove `DatabaseFace`, `getTaskFaceBundle`, `RecreateDatabaseButton`, kernel `TaskComposer`, `recreateTaskDatabase` import.
3. Page always renders `TasksProductView` via `loadTasksPageData` (keep scope query param logic).
4. `rg 'DatabaseFace|getTaskFaceBundle|recreateTaskDatabase' apps/web/app/\(workspace\)/tasks` → no matches.
5. Ensure `apps/web/lib/queries/tasks.ts` has `@deprecated` on kernel bundle loader (add if missing).

**`/goal`:** `cd apps/web && npx tsc --noEmit` clean; `/tasks` is product-only with no env flag.

**Commit:** `feat(web): complete tasks strangler cutover off DatabaseFace`

---

## Task 9 — Audit Lumis parity + commit shell

1. Complete Task 0 first.
2. Walk every file in PART 3 uncommitted table against **attached Lumis images**.
3. Fix gaps: 4 columns, card anatomy, create modal fields, design preview states, empty state (no recreate-database copy).
4. Wire `N` shortcut in `TasksProductView` if missing.
5. Run `cd packages/core && npm test` and `cd apps/web && npx tsc --noEmit`.
6. Visual check at `/design` then `/tasks`.

**`/goal`:** Lumis board + create modal match images; Task 9 files committed; tests + tsc green.

Suggested commits (orchestrator may squash if cleaner):
- `feat(web): Lumis tasks board, cards, and create modal`
- `feat(web): wire tasks product shell, peek, and server actions`

---

## Task 10 — Cross-feature buttons

**Files:**
- Create: `apps/web/features/tasks-product/cross-link-actions.tsx`
- Modify: `apps/web/app/(workspace)/tasks/actions.ts`
- Modify: `apps/web/features/tasks-product/task-peek.tsx`

| Button | Backend |
|--------|---------|
| Schedule | `scheduleTask` → date/time pickers → toast |
| Attach file | List `file_sources` → `attachFileToTask` → refresh file count |
| Add to workspace | Current workspace or picker → `linkTaskToWorkspace` → calm toast |

**`/goal`:** All three work from peek panel; manual test documented in council log.

**Commit:** `feat(web): add Schedule, Attach file, and Add to workspace task actions`

---

## Task 11 — Verify quick capture (already committed)

**Do not rebuild.** Verify `bdcf5cc`:
- `capture-actions.ts` uses `quickCaptureToTaskInsert` + `createTask`
- Cmd+K → `Finish essay !high tomorrow` creates `tasks` row
- `undoQuickCapture` handles task rows

If broken, fix minimally. Otherwise log VERIFIED and move on.

**`/goal`:** Manual test passes; no regression to kernel insert.

---

## Task 12 — Final kernel grep

- `rg 'DatabaseFace|createTaskWithRequiredFoundation|getTaskFaceBundle|recreateTaskDatabase' apps/web/app/\(workspace\)/tasks apps/web/features/tasks-product` → empty
- Command bar still uses `capture-actions.ts` product path

**`/goal`:** Tasks product surface has zero kernel paths.

---

## Task 13 — Verification doc

Create `docs/superpowers/ecosystem-phase-2/verification.md`:
- Automated: `npm test` output, `tsc` output
- Manual: Lumis checklist, cross-links, quick capture, board DnD incl. In review
- Dogfood gate instructions for founder

**Commit:** `docs: add phase 2 tasks product verification and dogfood gate`

---

## Task 14 — Dogfood (founder only)

≥3 weekdays on `/tasks`; sign `.superpowers/ecosystem-phase-2/dogfood-log.md`. **Do not declare Phase 2 complete without founder sign-off.**

---

# PART 6 — `/goal` WORKFLOW & ARTIFACTS

## Artifacts (lightweight — no council meetings)

```
.superpowers/ecosystem-phase-2/council-log.md      ← one-line handoff + commit notes only
.superpowers/ecosystem-phase-2/worker-status.md    ← current task + GOAL status
.superpowers/ecosystem-phase-2/lessons.md           ← append findings, don't duplicate
.superpowers/ecosystem-phase-2/dogfood-log.md
docs/superpowers/ecosystem-phase-2/verification.md
```

**Append on startup (one block, then move on to coding):**

```markdown
## Codex resume handoff · [date]
**From:** Fable 5 (usage limit) — committed 0bd5290, bdcf5cc; Task 9 UI on disk uncommitted
**To:** Codex GPT-5.6 coding team
**Mode:** code-first `/goal` chain — no `/loop`
**Resuming at:** Task 0/12 → Task 9 commit → 10 → 11 verify → 12 → 13
**Verified:** [paste test + tsc output]
```

## `/goal` chain (the only coordination primitive)

| Step | Who | Action |
|------|-----|--------|
| 1 | Orchestrator | Issue `/goal` with measurable criterion + exact file paths |
| 2 | Coder | Implement until GOAL_MET; paste test/tsc output |
| 3 | Reviewer | One PASS/FAIL pass on that diff only |
| 4 | Orchestrator | Commit on PASS → issue next `/goal` |
| 5 | Repeat | Until north-star `/goal` met or founder-blocked |

**Do not:** arm `/loop`, schedule council ticks, or dispatch Reviewer before Coder reports GOAL_MET.

## Escalation

| Situation | Action |
|-----------|--------|
| Coder `GOAL_MET` | Reviewer one pass → commit on PASS |
| Review FAIL (1st) | Coder fixes, re-run tests |
| Review FAIL (2nd) | **Orchestrator codes** — no third review |
| Coder `GOAL_BLOCKED` | Orchestrator codes or narrows `/goal` |
| Kernel / DatabaseFace in new `/tasks` code | Coder fixes before review |
| `npm test` or `tsc` red | Not GOAL_MET — fix first |
| Dogfood unsigned | Phase 2 incomplete — stop at Task 13 |

---

# PART 7 — HARD BOUNDARIES

**DO:** `tasks` table, Lumis canvas per PART 1, Planevo shell, tokens, one marigold, `/design` preview, cross-links, verify F-15, kill Tasks kernel.

**DO NOT:** Lumis sidebar/AI IA, Calendar/Files UI, embed blocks, auto workspace-link on create, filter prefs on DB rows, delete global `face-databases`, competitor names, sparkle AI, onboarding refactors, declare done without dogfood, parallel agents on this repo.

**Tokens:** `globals.css` only — no `bg-[#...]` or arbitrary px.

---

# PART 8 — WORKER SUB-PROMPTS (fresh GPT-5.6 sessions)

### GPT-5.6 — Coder (dispatch first — this is where usage goes)

```
You are Coder (GPT-5.6) on Planevo Phase 2 Tasks resume.

Orchestrator: codex-phase-2-resume-orchestrator.md
Plan: docs/superpowers/plans/2026-07-17-ecosystem-phase-2-tasks-product.md
Lessons: .superpowers/ecosystem-phase-2/lessons.md
Task: [N FROM ORCHESTRATOR]
Files: [EXACT PATHS]

Your job is to SHIP working code that meets the /goal. You are not here to plan or review.

Before reporting GOAL_MET you MUST:
- Implement the full task slice
- Run: cd packages/core && npm test
- Run: cd apps/web && npx tsc --noEmit
- Self-check AGENTS.md: tokens only, one marigold, no DatabaseFace on /tasks, Lumis layout for UI tasks
- Lumis images = layout reference for /tasks (founder override)

Rules:
- Follow assigned task only — no drive-by refactors
- Do NOT commit — orchestrator commits after Reviewer PASS
- Do NOT ask for a review pass — report GOAL_MET with evidence and stop

Report:
STATUS: GOAL_MET | GOAL_BLOCKED
TASK: N
EVIDENCE: test output, tsc output, paths changed
BLOCKERS: none | description

/goal [ORCHESTRATOR SUPPLIES EXACT STRING]
```

### GPT-5.6 — Reviewer (dispatch ONLY after Coder GOAL_MET)

```
You are Reviewer (GPT-5.6) on Planevo Phase 2 Tasks resume.

The Coder has finished. Your job is ONE focused quality gate — not a second implementation pass.

Read: AGENTS.md; .superpowers/ecosystem-phase-2/lessons.md; codex-phase-2-resume-orchestrator.md PART 1 (Lumis).

Review the attached diff only:
1. Does it meet the stated /goal?
2. F-03 — product tasks table, not DatabaseFace on /tasks
3. Lumis layout for UI tasks (founder override)
4. Tokens only; one marigold per view
5. Tests and tsc were run — spot-check if evidence looks thin
6. Phase 2 scope only — flag unrelated file churn

Output: VERDICT PASS | FAIL
If FAIL: numbered fixes only (max 5 items). Do NOT implement. Do NOT rewrite the approach.

/goal VERDICT PASS or VERDICT FAIL with evidence.
```

---

# PART 9 — STARTUP CHECKLIST (execute now)

- [ ] Read plan Tasks 9–13, lessons, council-log INCIDENT section
- [ ] Confirm **no other agent** is editing this repo
- [ ] `cd packages/core && npm test` → 143/143
- [ ] `cd apps/web && npx tsc --noEmit` → note errors (expect `recreateTaskDatabase` until Task 0)
- [ ] Append one-line handoff to `council-log.md`; update `worker-status.md`
- [ ] **Code** Task 0/12 yourself (small, do not waste a Coder on it)
- [ ] Issue `/goal` to Coder for Task 9 → Reviewer on PASS → commit → `/goal` for Task 10 → … → Task 13
- [ ] **No `/loop`.** Only chained `/goal` until done.

**First `/goal` (orchestrator codes this one):**

> `page.tsx` renders only `TasksProductView` with no DatabaseFace or feature flag; `tsc --noEmit` clean on apps/web.

**Then `/goal` for Coder (Task 9):**

> Lumis board + create modal match attached images; Task 9 files committed; `npm test` 143/143 and `tsc` clean.

---

*Prompt v2.1 · July 18, 2026 · GPT-5.6 code-first team · `/goal` only, no `/loop`*
