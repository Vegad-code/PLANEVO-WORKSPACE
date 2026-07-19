# Codex GPT Sol — Prompting Notes (OpenAI)

> Sources: [GPT-5.6](https://openai.com/index/gpt-5-6), [GPT-5.6 Sol preview](https://openai.com/index/previewing-gpt-5-6-sol/), [OpenAI API model guidance](https://developers.openai.com/api/docs/guides/latest-model)  
> Used to build `codex-phase-2-orchestrator.md`

---

## When to use which model

| Role | Model | Why |
|------|-------|-----|
| **Orchestrator** | **GPT-5.6 Sol** (`gpt-5.6-sol`) | Deepest reasoning, multi-step planning, subagent coordination |
| **Implementers** | **GPT-5.6 Sol** | Same tier — founder policy: Sol team only |
| **Reviewer** | **GPT-5.6 Sol** (fresh session) | Spec gate; never same session as implementer |

Optional: `max` or `ultra` effort in Codex for board DnD + cross-link integration (parallel subagents). Default `high`/`xhigh` equivalent is fine for routine plan steps.

**Do not use Sonnet, Opus, or Terra for this run** unless the founder explicitly changes the team.

---

## Prompt blocks (copy into orchestrator or workers)

### Outcome-first (orchestrator → founder)
```
Lead with what happened. First sentence answers "what's done" or "what's blocked." Paste test output or commit hashes as evidence. The founder did not see your tool calls.
```

### Scope discipline (implementers)
```
Implement only the assigned plan task. No refactors, no Phase 3/4 features, no helper abstractions unless the plan requires them. Reuse existing patterns (record-board.tsx for dnd-kit, board-state.ts for columns).
```

### Autonomous Codex operation
```
You are operating autonomously. Do not ask "Want me to…?" for reversible work that follows from the plan. Before ending your turn: if your last message is a plan or promise about work not yet done, execute it with tools now. Pause only for destructive actions, scope changes, or founder-only secrets.
```

### Ground progress claims
```
Before reporting GOAL_MET, verify with tool output: tests run, tsc clean, files exist at stated paths. If review is pending, say so — do not claim the task is committed.
```

### Fresh subagent rule
```
Coders and Reviewers are always fresh GPT-5.6 subagents. Coder ships first; Reviewer runs only after GOAL_MET. The same session must not implement and review its own diff. No /loop — only /goal chains.
```

### Code-first usage policy
```
~80% of subagent usage goes to Coders implementing task slices. ~20% to Reviewers — one PASS/FAIL pass per GOAL_MET. Quality comes from Coders self-checking tests, tsc, AGENTS.md, and Lumis images before reporting done — not from endless review cycles.
```

### Programmatic tool calling (Codex-native)
```
For multi-step verification (test + tsc + grep), batch tool work in one turn when Codex supports programmatic tool calling. Prefer evidence over narration.
```

### Repo conventions (Planevo-specific)
```
Colocated core tests import siblings as ./module.ts (with .ts extension under --experimental-strip-types). Register every new .test.mjs in packages/core/package.json test script. Workers do not commit — orchestrator commits after reviewer PASS.
```

### Intent context (workers)
```
Planevo Phase 2 Tasks product: real app on the tasks table, Lumis craft on cards only, /tasks off DatabaseFace. Founder will dogfood daily before Phase 3. Execute this task only.
```

---

## Codex-specific scaffolding

1. **Resume, don't restart** — Tasks 1–4 are committed; Task 5 is on disk uncommitted. Start at Task 5 gate.
2. **Ultra / parallel** — Tasks 7 and 8 can run as parallel Sol workers (different files) after Task 6 lands; never parallel edits to `packages/core/package.json`.
3. **Design before wire** — TaskCard/Board land in `/design` before `/tasks` wiring (Tasks 7–8 before 9).
4. **One commit per task** — orchestrator commits after review PASS.
5. **Escalation** — orchestrator codes directly after 2 failed reviews on the same task.

---

## Phase 2 handoff state (July 18, 2026 — Fable → Codex resume)

| Task | Status |
|------|--------|
| 1–8 | ✅ Committed: `f19def0` … `5d55314` |
| in_review core | ✅ `0bd5290` |
| 11 quick capture | ✅ `bdcf5cc` |
| 9 Lumis shell | ⚠️ Built on disk, **uncommitted** — Fable stopped at edit war |
| 10 cross-links UI | ❌ Not built |
| 12 kernel kill | ⚠️ `actions.ts` cleaned; `page.tsx` still has `DatabaseFace` + broken import |
| 13 verification | ❌ Not created |
| Tests | 143/143 in packages/core |
| tsc | ❌ `page.tsx` imports missing `recreateTaskDatabase` until Task 0 |

**Orchestrator prompt:** `codex-phase-2-resume-orchestrator.md` (not the July 17 v1 prompt).

**Lumis:** Founder override July 18 — layout reference for `/tasks`, not craft-only.

---

*Adapted July 18, 2026 for Codex resume after Fable usage limit*
