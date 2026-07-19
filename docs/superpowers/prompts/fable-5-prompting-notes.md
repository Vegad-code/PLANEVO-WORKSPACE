# Fable 5 Prompting Notes (scraped from Anthropic)

> Source: [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5)  
> Used to build `fable-5-phase-1-orchestrator.md`, `fable-5-phase-2-orchestrator.md`, `fable-5-phase-2-resume-orchestrator.md`

---

## When to use Fable 5 vs workers

| Role | Model | Why |
|------|-------|-----|
| Orchestrator, council, multi-task coordination | **Fable 5** | Long-horizon autonomy, delegation, instruction retention |
| Implementation + spec review (Phase 2+) | **Opus 4.8** | Founder policy: no Sonnet workers; fresh subagent per task/review |

Fable 5 at `high` effort often exceeds prior models at `xhigh` on routine work. Use `xhigh` for orchestrator on hardest migration/debug sessions only.

---

## Prompt blocks (copy into orchestrator or workers)

### Anti-overplanning
```
When you have enough information to act, act. Do not re-derive facts already established in the conversation, re-litigate a decision the user has already made, or narrate options you will not pursue in user-facing messages. If you are weighing a choice, give a recommendation, not an exhaustive survey. This does not apply to thinking blocks.
```

### Anti-scope-creep (implementers)
```
Don't add features, refactor, or introduce abstractions beyond what the task requires. A bug fix doesn't need surrounding cleanup and a one-shot operation usually doesn't need a helper. Don't design for hypothetical future requirements: do the simplest thing that works well.
```

### Brevity to founder
```
Lead with the outcome. Your first sentence after finishing should answer "what happened" or "what did you find". Being readable and being concise are different things, and readability matters more.
```

### Autonomous pipelines
```
You are operating autonomously. The user is not watching in real time and cannot answer questions mid-task, so asking "Want me to…?" or "Shall I…?" will block the work. For reversible actions that follow from the original request, proceed without asking. Before ending your turn, check your last paragraph. If it is a plan, an analysis, a question, a list of next steps, or a promise about work you have not done, do that work now with tool calls.
```

### Progress honesty
```
Before reporting progress, audit each claim against a tool result from this session. Only report work you can point to evidence for; if something is not yet verified, say so explicitly.
```

### Parallel subagents
```
Delegate independent subtasks to subagents and keep working while they run. Intervene if a subagent goes off track or is missing relevant context.
```

### Self-verification interval
```
Establish a method for checking your own work every 2 completed tasks. Run an Opus reviewer subagent against the plan and spec before marking a task done.
```

### Context reassurance
```
You have ample context remaining. Do not stop, summarize, or suggest a new session on account of context limits. Continue the work.
```

### Intent context (workers — Phase 1)
```
I'm working on Planevo Ecosystem Phase 1 for the founder. They need product tables and link layer so Tasks/Calendar/Files can become real products in Phase 2. With that in mind: [task].
```

### Intent context (workers — Phase 2)
```
I'm working on Planevo Tasks product for the founder. They need a real task app on the tasks table — Lumis craft on cards, Planevo shell — so they can dogfood daily before Calendar ships. With that in mind: [task].
```

### Intent context (workers — Phase 3)
```
I'm working on Planevo Calendar and Files products for the founder. They need real product UIs matching the reference screenshots — Calendar three-pane week view, Files CloudNest cabinet — on calendar_events and file_sources so all three global products ship before workspace embeds. With that in mind: [task].
```

### Screenshot layout (Phase 3 — mandatory)
```
Calendar and Files reference screenshots are LAYOUT references for /calendar and /files (founder override July 19). Match three-pane calendar and cabinet files hierarchy. Planevo app-shell owns global IA — never clone reference app sidebars (My Works, Projects, Members).
```

### Design-before-wire (Phase 3 UI)
```
Land calendar-product and files-product components in /design preview with all states before wiring to /calendar or /files.
```

### Design-before-wire (Phase 2 UI)
```
Land UI components in /design preview with all states before wiring to /tasks. Lumis screenshot is craft reference only — never clone its sidebar IA.
```

### Dogfood honesty
```
Phase 2 is not complete until the founder signs dogfood-log.md for ≥3 weekdays. Do not claim Phase 2 done without that evidence.
```

### No reasoning echo
Do not instruct models to reproduce summarized thinking in response text — triggers `reasoning_extraction` refusal on Fable 5.

---

## Scaffolding recommendations (Anthropic)

1. Start at top of difficulty range — Phase 1 is appropriate for Fable orchestration.
2. Fresh-context verifier subagents (Opus) outperform self-critique.
3. Refactor over-prescriptive skills — Fable 5 needs goals + boundaries, not micro-step lists in worker heads (plan file holds steps).
4. `send_to_user` tool optional for long runs — not required in Cursor harness.

---

## Planevo-specific additions (founder session)

- `/goal` = measurable done criterion per worker; loop until met or 3 failures.
- `/loop 10m` = orchestrator council cadence (see cursor loop skill).
- Council meeting after each GOAL_MET and on loop ticks.
- Fable codes directly after 2 failed Opus reviews.

---

## Phase 2 orchestrator mapping

| Anthropic recommendation | Phase 2 application |
|--------------------------|---------------------|
| Start at top of difficulty range | Full product UI + cross-links in one phase |
| Fresh-context Opus verifier | Review after every 2 tasks; UI craft + spec gate |
| Don't over-prescribe skills | Plan holds micro-steps; workers get `/goal` + boundaries |
| Parallel subagents | Core (A) can run ahead of design preview (B) only after Task 1–4 |
| Ground progress claims | Require test output + diff for GOAL_MET |
| Autonomous pipelines block | No mid-task "Shall I…?" for reversible work |
| No reasoning echo | Verbatim in orchestrator prompt |
| `send_to_user` tool | Optional in Cursor; founder sees council summaries in chat |
| Refactor old prompts | Phase 1 orchestrator is reference shape, not copy-paste scope |

**Orchestrator file:** `docs/superpowers/prompts/fable-5-phase-2-orchestrator.md`  
**Resume orchestrator (after Codex):** `docs/superpowers/prompts/fable-5-phase-2-resume-orchestrator.md`  
**Plan:** `docs/superpowers/plans/2026-07-17-ecosystem-phase-2-tasks-product.md`

## Phase 3 orchestrator mapping

| Anthropic recommendation | Phase 3 application |
|--------------------------|---------------------|
| Start at top of difficulty range | Two product UIs + cross-links in one phase |
| Fresh-context Opus verifier | Review after every 2 tasks; screenshot layout gate |
| Parallel subagents | Core (A) before calendar UI (B); files UI (C) after Task 5 |
| Ground progress claims | Require test output + kernel grep for GOAL_MET |
| Autonomous pipelines block | No mid-task "Shall I…?" for reversible work |

**Orchestrator file:** `docs/superpowers/prompts/fable-5-phase-3-orchestrator.md`  
**Ship orchestrator (code-first):** `docs/superpowers/prompts/fable-5-phase-3-ship-orchestrator.md`  
**Paste package:** `docs/superpowers/prompts/fable-5-phase-3-PASTE-PACKAGE.md`  
**Plan:** `docs/superpowers/plans/2026-07-19-ecosystem-phase-3-calendar-files.md`  
**Design:** `docs/superpowers/specs/2026-07-19-phase-3-calendar-files-design.md`

### Hands-on resume mode (founder preference, July 18)
```
Fable reviews every diff before commit. Fable codes Tasks 9–11 integration directly; Opus workers only for optional slices. Opus second-gate on Tasks 9, 11, 12. Take over after one worker FAIL, not two. Uncommitted ≠ done; dogfood unsigned ≠ Phase 2 complete.
```

---

*Scraped and adapted July 17, 2026 · Updated for Phase 2 resume July 18 · Phase 3 July 19*
