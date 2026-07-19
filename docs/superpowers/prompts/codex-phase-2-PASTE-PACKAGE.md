# Codex Phase 2 Resume — What to Paste

Use this when starting Codex after Fable hit usage limits.

---

## Minimum paste (recommended)

| # | What | File or action |
|---|------|----------------|
| 1 | **Full orchestrator prompt** | Paste entire **`codex-phase-2-resume-orchestrator.md`** |
| 2 | **Lumis board image** | Attach Kanban screenshot |
| 3 | **Lumis create-task image** | Attach Create New Task modal screenshot |
| 4 | **Kickoff** | Paste kickoff line below + run `/goal` |

**Repo access required.** Codex must read plan, lessons, and uncommitted Task 9 files in-tree.

**Stop all other agents first** (Cursor, other Codex loops). One editor only.

---

## Kickoff line (paste after orchestrator + images)

```
You are Codex Chief Orchestrator resuming Planevo Phase 2 Tasks after Fable 5 usage limit.

The two attached Lumis images are the non-negotiable layout reference for /tasks only — read PART 1 first.

You lead a GPT-5.6 coding team: Coders ship (~80% usage), Reviewers gate after GOAL_MET (~20%). No /loop — only chained /goal. You code Task 0 yourself, then dispatch Coders for Tasks 9–13. Begin.
```

---

## Optional attachments (no repo access only)

| File | Why |
|------|-----|
| `docs/superpowers/plans/2026-07-17-ecosystem-phase-2-tasks-product.md` | Tasks 9–13 steps |
| `docs/superpowers/specs/2026-07-17-phase-2-tasks-product-design.md` | Design spec |
| `.superpowers/ecosystem-phase-2/lessons.md` | Gotchas |
| `AGENTS.md` | Inviolable rules |

**Do not paste:** `codex-phase-2-orchestrator.md` (superseded July 17), `fable-5-phase-2-orchestrator.md` (superseded).

---

## Lumis image paths (attach from disk)

- Board: `.cursor/projects/Users-jabbo-PLANEVO/assets/image-455bb342-0cfa-4040-8e7d-5a406fea6ad3.png`
- Create modal: `.cursor/projects/Users-jabbo-PLANEVO/assets/image-9e7e8cb9-059d-41cb-b06e-c725eab47df4.png`

---

## What Claude (Fable) already finished

| Done | Commit / state |
|------|----------------|
| Core layer Tasks 1–5 | `f19def0` … `4c40e64` |
| Scope + strangler stub | `0536dd7` |
| Card/board/list/table baseline | `3fb456c`, `5d55314` |
| `in_review` + description on create | `0bd5290` |
| Quick capture → tasks | `bdcf5cc` |
| Task 9 Lumis UI | **On disk, uncommitted** — Codex audits + commits |

## What Codex still owes

| Task | Work |
|------|------|
| 0 + 12 | Kill `DatabaseFace` on `/tasks` (fix `tsc` error) |
| 9 | Commit Lumis shell if parity passes |
| 10 | Schedule / Attach / Add to workspace in peek |
| 11 | Verify `bdcf5cc` only |
| 13 | `verification.md` |
| 14 | Founder dogfood (human) |

---

*Package v1.1 · July 18, 2026 · GPT-5.6 code-first · `/goal` only*
