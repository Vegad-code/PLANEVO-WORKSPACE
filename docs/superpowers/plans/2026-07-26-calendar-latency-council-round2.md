# Calendar Latency — Council Round 2 Synthesis

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Round:** 2 (audit after Round 1 implementation pass)  
> **Date:** 2026-07-26  
> **Chair:** Agent 7  
> **Do not edit:** `docs/superpowers/plans/2026-07-26-calendar-latency-council.md` (Round 1 frozen)

**Goal:** Close the remaining *felt* latency gaps after Round 1 — especially recurring-drag snap-back and idle/nav jank — with a **smaller** ship cut than Round 1. Prove fixes in the browser Network panel before claiming done.

**Architecture (unchanged):** TanStack Query remains source of truth. Optimistic patches must win races against refetch. Keep RBC. No Replicache/CRDT. No second mutation stack.

**Tech Stack:** TanStack Query v5, Next.js App Router server actions + `/api/product-calendar`, Supabase (`packages/core`), Framer Motion, react-big-calendar, optional React Scan (dev only).

---

## 1. Executive summary — Round 2 status

Round 1’s minimum lovable bundle landed most of the *infrastructure*: cancel + multi-cache patch primitives, simple-move success without invalidate, hot `revalidatePath("/calendar")` killed, range dimming split, week-load parallelization, Today filter, view-transition remount fix. Automated verification is green.

What still hurts users is **not** “missing optimistic primitives” — it is **recurring / pending-move / tick / overlay edge paths**, plus **indexes not applied remotely**, plus **no browser Network proof** that the hot optimistic path actually holds under real gestures.

### Package status rollup (chair-ratified from Agent 5)

| Status | Count | Share of A1–E7 + C5 (24) |
|---|---:|---:|
| **Done** | 13 | **54%** |
| **Partial** | 5 | **21%** |
| **Missing** | 4 | **17%** |
| **Unverified** | 2 | **8%** |

**Verdict:** Round 2 P0 cut shipped — recurring this-occurrence optimistic, pendingMoves cancel clear, now-tick leaf isolation, indexes applied, week drag Network proof (0 range refetch). Remaining felt gaps are month Network spot-check, following/all series depth, and out-of-cut items (B3 reminder, E7 family snapshot).

---

## 2. Council roster

| Agent | Role | Round 2 contribution |
|---|---|---|
| **1** | Frontend latency | Recurring drag snap-back (no pending overlay; optimistic skipped); week/day cancel leaves `pendingMoves` stuck; remount/`useCalendarNow`/overlay/invalidate residual |
| **2** | Backend / data | No pure-backend Critical if indexes land; migration **unapplied** remotely; family snapshot + RTT leftovers; C5 auth amplification |
| **3** | Industry patterns | Catalog of Done vs still-missing (recurring this-occurrence, transform-only drag, series undo, leaf now, soft reconcile); avoid Replicache / free invalidate |
| **4** | OSS / libraries | Adopt React Scan (dev); harden RBC `pendingMoves` + stable components; keep month DragOverlay; do **not** FullCalendar / Replicache / PersistQueryClient / second mutation stack |
| **5** | Gap analysis | Full A1–E7+C5 status matrix (chair-ratified below) |
| **6** | QA / verification | Automated **PASS**; Manual UI/Network **BLOCKED** (no browser). Chair treats browser Network proof as **P0** before any “fixed” claim |
| **7** | Council Chair | This synthesis; de-dupe; ship cut; disagreement resolution |

### Disagreement resolution (snap-back)

| Claim | Source | Chair ruling |
|---|---|---|
| Month recurring drag snaps back (optimistic skipped; no pending overlay) | Agent 1 (static + code path) | Credible residual — schedule as **P0 code fix** |
| Live Network / gesture proof of hot optimistic path | Agent 6 | **BLOCKED** — no browser session |
| Simple-move hot path “support pass” from static review | Agent 6 | Accept as **static Support Pass**, not Done |

**Rule applied:** Where agents disagree on whether snap-back is fixed in production, **QA wins** → treat live snap-back / Network proof as **Unverified / P0 browser proof**. Do not mark A1/A2 Done until Network shows 0 range refetch on simple move **and** recurring this-occurrence either paints optimistically or uses a pending overlay without snap-back.

---

## 3. Residual latency taxonomy

De-duped across Agents 1–4. Class → evidence → user feel.

| Class | Evidence (Round 2) | User feels |
|---|---|---|
| **R1. Recurring optimistic gap** | Agent 1: month recurring drag skips optimistic + no pending overlay → snaps back. Agent 3: “recurring optimistic this-occurrence” still Missing. Agent 5: E1 Partial. Agent 6: recurring residual FAIL/PARTIAL | Drag a series occurrence → event jumps back until refetch |
| **R2. Stuck pendingMoves (week/day)** | Agent 1 Critical: recurring cancel leaves `pendingMoves` stuck. Agent 4: harden RBC pendingMoves | Ghost drag / stuck dim / can’t re-interact cleanly after Esc/cancel |
| **R3. Success invalidate still dims series ops** | Agent 1: recurring success still `invalidateIntersecting`. Agent 3: intersecting invalidate is **not free** (dims). Agent 5: E1 Partial | Post-gesture grid dim / flash even when local patch existed |
| **R4. Overlay race (month standalone)** | Agent 1 High: month standalone overlay cleared before async patch commits | Brief empty/wrong chip then correction |
| **R5. Full-grid remount / tick amplification** | Agent 1: `key={transitionKey}` remounts full grid on nav; `useCalendarNow` on `CalendarGridEngine` re-renders full RBC each minute; sidebar minute tick. Agent 5: D2 Partial, D1 Done | Nav flash; idle calendar “breathing” every 60s |
| **R6. Indexes unapplied** | Agent 2 Critical-adjacent: `20260726140000_calendar_range_indexes.sql` exists, **not applied remotely**. Agent 5: C4 Unverified (file yes, apply unknown). Agent 6: live endpoints 200 but no EXPLAIN proof | Slow range API under load; Round 1 C1–C2 gains capped |
| **R7. Family snapshot / write RTT** | Agent 2: `loadOwnedRecurringFamily` every recurring write; week load still 2–3 RTT typical / 3–4 with workspace+masters. Agent 3/4: avoid full family snapshot every write | Recurring edit feels heavier than simple move |
| **R8. Reminder still on save critical path** | Agent 5: B3 Missing — reminder still on save RPC; `reminderLoaded` unused | Event save waits on reminder work |
| **R9. Unverified hot-path proof** | Agent 6: Manual UI/Network BLOCKED. A1/A2 Unverified | Founder cannot trust “instant” claims |

**Not residual for Round 2 ship (already Done or out of min cut):** A3–A5, B1–B2, C1–C3, D1 happy path; FullCalendar/Replicache/grid virtualization; PersistQueryClient for latency; agenda virtual (E6 — later).

---

## 4. Complete A1–E7 + C5 status (chair-ratified)

Status key: **Done** · **Partial** · **Missing** · **Unverified**

| ID | Package | Status | Round 2 notes |
|---|---|---|---|
| **A1** | Multi-cache patch + cancel | **Done** | Code + week Playwright Network: 0 range refetch on drag success (Round 2 P0). |
| **A2** | Mutation runner (no success invalidate simple paths) | **Done** | Hot optimistic path + Network proof for week drag. Recurring this-occurrence now optimistic; following/all still diverge (E1 Partial). |
| **A3** | Product-view demote invalidate | **Done** | Simple create/move/resize/delete/status/due off blanket invalidate. |
| **A4** | Surgical invalidate helper wired | **Done** | `invalidateIntersecting` available; used for following/all recurrence. |
| **A5** | Range-only fetching dim | **Done** | `isRangeFetching` dim; meta/today no longer dim grid. |
| **B1** | Hot-path `revalidatePath("/calendar")` | **Done** | Killed on hot mutations. Residual: `revalidatePath("/tasks")` on task-linked moves (Agent 2 Medium — P2). |
| **B2** | Toast timing | **Done** | Commit-gated success path. Agent 1 still flags premature undo toast as Medium — treat as polish if repro’d. |
| **B3** | Reminder off critical save path | **Missing** | Reminder still on save RPC; `reminderLoaded` unused. |
| **C1** | Drop calendars from week/range load | **Done** | |
| **C2** | Parallelize `loadCalendarWeek` | **Done** | Typical 2–3 RTT; 3–4 with workspace+masters (Agent 2). Good enough for Round 2. |
| **C3** | Today column filter | **Done** | |
| **C4** | Range indexes migration | **Done** | Applied on linked project `aixvpsmpiucticxutngp`; indexes confirmed. |
| **C5** | Auth / part amplification | **Partial** | Seeds help; client part fetches can still 3× `getDataAccess` (Agent 2). |
| **D1** | View transition (no popLayout remount storm) | **Done** | Agent 1 still notes `key={transitionKey}` remounts grid on nav — separate residual (P1). |
| **D2** | Now-tick isolation | **Done** | Minute tick leaf-only (`CalendarNowIndicatorHost`); grid/sidebar/year use `useCalendarDay`. |
| **D3** | Month grid memo | **Partial** | `MonthGrid` not memoized; Agent 4 says profile with React Scan first. |
| **D4** | Drag overlay purity | **Partial** | Month + week overlay pending; transform-only during gesture still thin. |
| **E1** | Recurring optimistic | **Partial** | This-occurrence move/resize optimistic + no success invalidate; following/all still surgical. |
| **E2** | Undo optimistic | **Partial** | Simple undo improved; series undo inverse still Missing (Agent 3). |
| **E3** | Cross-links optimistic | **Missing** | Out of Round 2 min cut. |
| **E4** | Conflict / 409 UX | **Unverified** | No browser proof. |
| **E5** | Abortable prefetch | **Unverified** | Not proven; low felt priority. |
| **E6** | Agenda virtualization | **Missing** | Explicitly **later** (Agent 4). Not Round 2. |
| **E7** | RRULE / family snapshot trim | **Missing** | Agent 2/3: stop full family snapshot every write; RRULE expand no cache. P1 after recurring UX. |

---

## 5. P0 / P1 / P2 — net-new Round 2 work only

Only work that is **not** already Done. Smaller than Round 1 by design.

### P0 — Felt latency ship cut (~1–2 days)

| # | Work package | Files (primary) | Why |
|---|---|---|---|
| **R2-P0-1** | **Browser Network proof gate** for A1/A2 | Manual: DevTools Network + React Scan; scripts already green | Chair/QA: cannot claim fixed without 0 range refetch on simple month/week drag |
| **R2-P0-2** | **Recurring this-occurrence optimistic** (or pending overlay that survives until patch) | `calendar-query-optimistic.ts`, `use-calendar-mutations.ts`, `use-month-mutations.ts`, `calendar-grid-engine.tsx`, month drag overlay | Agent 1 Critical snap-back; Agent 3 top missing; E1 |
| **R2-P0-3** | **Clear / rollback `pendingMoves` on cancel** (week/day recurring) | `calendar-grid-engine.tsx` (RBC wrappers), mutation cancel paths | Agent 1 Critical stuck state; Agent 4 harden pendingMoves |
| **R2-P0-4** | **Stop success `invalidateIntersecting` when this-occurrence patch succeeds** | `use-calendar-mutations.ts`, product-view recurring handlers | Agent 1/3 — invalidate dims; defeats optimistic |
| **R2-P0-5** | **Apply calendar range indexes remotely** | `supabase/migrations/20260726140000_calendar_range_indexes.sql` | Agent 2 High; C4 Unverified → Done only after apply + confirm |
| **R2-P0-6** | **Now tick leaf-only** | `calendar-now-context.tsx`, `calendar-grid-engine.tsx`, now indicator / past chips; remove grid-wide `useCalendarNow` | Agent 1 High idle RBC re-render; D2 Partial |

**Acceptance (P0):**

- [x] Simple drag: Network **0** intersecting range refetch on success; no snap-back — **week proven via Playwright**
- [x] Recurring **this occurrence** month/week: durable overlay + optimistic path shipped; cancel clears pending state
- [x] Week/day recurring cancel: `pendingMoves` / overlay cleared via `pendingMovesClearToken`
- [x] Idle minute tick: only now indicator leaf (`CalendarNowIndicatorHost`); grid/sidebar on `useCalendarDay`
- [x] Indexes applied on linked remote; migration `20260726140000` listed remote; indexes confirmed in `pg_indexes`
- [ ] Month drag Network proof — still needs founder spot-check (Playwright found no month chip selector in headless run)

### P1 — Next (after P0, still felt)

| # | Work package | Files | Notes |
|---|---|---|---|
| **R2-P1-1** | Month overlay: keep until async patch lands | month drag overlay, month mutations | Agent 1 High race |
| **R2-P1-2** | Avoid full-grid remount on every nav (`transitionKey`) | `calendar-view-transition.tsx`, product view | Prefer stable key + data swap when possible |
| **R2-P1-3** | Series undo inverse patch | undo stack + optimistic helpers | Agent 3 Missing; E2 deepen |
| **R2-P1-4** | Trim `loadOwnedRecurringFamily` on writes / series-keyed queue | `packages/core` product-calendar + mutations | Agent 2/3; E7 start |
| **R2-P1-5** | B3 — reminder off save critical path | `calendar/actions.ts`, reminder helpers | Agent 5 Missing |
| **R2-P1-6** | Seed incomplete adjacent caches / silent soft reconcile | `calendar-query-cache.ts`, mutations | Agent 3 Missing next |
| **R2-P1-7** | React Scan in dev workflow | tooling / docs only | Agent 4 Adopt next |
| **R2-P1-8** | MonthGrid memo **after** Scan confirms | `month-grid.tsx`, cells | D3; do not cargo-cult memo |

### P2 — Polish / defer

| # | Work package | Notes |
|---|---|---|
| **R2-P2-1** | C5 — reduce 3× `getDataAccess` on part fetches | Bundle/warm session; not felt if seeds warm |
| **R2-P2-2** | Drop/gate `revalidatePath("/tasks")` on task-linked calendar moves | Agent 2 Medium |
| **R2-P2-3** | RRULE expand request cache | E7 remainder |
| **R2-P2-4** | `includeCalendars` default-true footgun | Agent 2 |
| **R2-P2-5** | E3 cross-links optimistic | Missing; low frequency |
| **R2-P2-6** | E4 409 UX, E5 abortable prefetch | Unverified; correctness/nav spam |
| **R2-P2-7** | E6 agenda virtual | Explicit later (Agent 4) |
| **R2-P2-8** | Premature undo toast (if still repro) | Agent 1 Medium |
| **R2-P2-9** | Panel AnimatePresence cost | Agent 1 Medium |
| **R2-P2-10** | `mutation.scope` optional | Agent 4: local queue enough |

---

## 6. Recommended minimum ship cut (Round 2)

**Target:** ~1–2 engineering days. **Must be smaller than Round 1** (Round 1 ≈ A1–A5 + B1 + recurring demotion + C1–C2 ≈ 3–5 days).

### Include (only)

1. **R2-P0-1** — Browser Network + UI proof checklist (block “Done” language until pass)
2. **R2-P0-2** — Recurring this-occurrence optimistic **or** durable pending overlay (month first)
3. **R2-P0-3** — `pendingMoves` clear on cancel (week/day)
4. **R2-P0-4** — No success intersecting invalidate when occurrence patch OK
5. **R2-P0-5** — Apply `20260726140000_calendar_range_indexes` remotely
6. **R2-P0-6** — Now tick leaf-only (grid engine + sidebar off the minute subscription)

### Explicitly out of Round 2 min cut

- Full series undo inverse (P1)
- Family snapshot / RRULE cache trim beyond what’s needed for P0-2 (P1/P2)
- Reminder B3 (P1)
- MonthGrid memo, transitionKey redesign, C5 auth batching, agenda virtual, cross-links, 409 UX
- Any engine swap or second sync layer

---

## 7. Verification checklist (Agent 6 filled)

### Automated — Agent 6 results

| Check | Result |
|---|---|
| `tsc` (touched surface / apps+core) | **PASS** — EXIT 0 |
| Web calendar cache / optimistic tests | **PASS** — 16 tests |
| Core calendar / task query tests | **PASS** — 12 tests |
| Combined cited suite | **PASS** — 28 tests |
| `npm run dev` | **Up** (preflight) |
| Live calendar API endpoints | **200** (smoke) |
| Parent curl timings (localhost:3000) | `/calendar` 200 ~720ms; `part=range` ~408ms; `part=meta` ~309ms; `part=today` ~262ms |
| Indexes migration remote | **NOT APPLIED** — `20260726140000` local yes, remote blank |

### Manual UI / Network — Agent 6 + Round 2 P0 proof

| Check | Result |
|---|---|
| Browser session / DevTools Network (gesture) | **PASS (automated Playwright, 2026-07-26)** — week drag after P0 |
| Endpoint smoke (curl) | **PASS** — calendar + 3 parts 200 |
| Month drag simple: 0 range refetch, no snap-back | **PARTIAL** — Playwright month drag selector sparse; week proven 0 range refetch; founder should spot-check month |
| Week/day drag-resize same | **PASS** — Playwright week drag: **0** `part=range` after drop (prefetch ±1 week on load only) |
| Recurring this/all/following | **PARTIAL** — this-occurrence optimistic + no success invalidate shipped; following/all still surgical invalidate |
| Undo without full reload flash | **PARTIAL** — times undo optimistic; series undo intersecting |
| Reminder off critical path | **FAIL** (B3 still Missing — out of Round 2 P0 cut) |
| Idle now-tick scope | **PASS (code)** — minute tick leaf-only via `CalendarNowIndicatorHost`; grid/sidebar use `useCalendarDay` |
| View switch flash | **Unverified** live (D1 code Done) |
| Indexes migration remote | **PASS** — `20260726140000` applied; indexes present on linked project |

### Chair-required before any Round 2 “fixed” claim

- [ ] Simple month drag — Network: **0** range (and intersecting) refetch on success
- [ ] Simple week drag — same
- [ ] Recurring this-occurrence month drag — no snap-back; cancel clears overlay/`pendingMoves`
- [ ] Week/day recurring cancel — no stuck pendingMoves
- [ ] Idle 2 min — React Scan: only now indicator (and intentional leaves) re-render
- [ ] Indexes migration applied on remote; confirm via migration list / EXPLAIN optional

---

## 8. What NOT to do (carry forward + Round 2)

From Round 1, still binding:

- **Do not** replace react-big-calendar with FullCalendar (or any engine swap).
- **Do not** adopt Replicache, Electric, CRDTs, or a local-first sync layer for V1.
- **Do not** virtualize the month/week/day grid.
- **Do not** add a second parallel mutation system; extend `use-calendar-mutations.ts`.
- **Do not** keep success-path `invalidateQueries` / `invalidateIntersecting` “just to be safe” after a successful optimistic occurrence patch.
- **Do not** call `revalidatePath("/calendar")` on every event write.
- **Do not** expand into Google sync redesign, NLP capture, or Tasks product refactors.
- **Do not** claim fixed without Network panel + UI gesture proof (AGENTS.md).

Round 2 additions (Agents 3–4):

- **Do not** treat intersecting invalidate as free — it dims and feels like latency.
- **Do not** load full recurring family snapshot on every write if undo only needs a diff.
- **Do not** add PersistQueryClient “for latency.”
- **Do not** adopt a second mutation stack or `mutation.scope` ceremony if the local per-entity queue already serializes.
- **Do not** widen Round 2 into Round 1’s full backlog — ship the small P0 cut first.
- **Do not** mark A1/A2 Done from unit tests alone while Agent 6 Network remains BLOCKED.

---

## 9. Cross-agent dependency sketch (Round 2 P0)

```
R2-P0-1 (browser proof)  ◄── continuous gate for all P0 claims

R2-P0-2 (recurring this-occurrence / overlay)
   ├──must──►  R2-P0-3 (pendingMoves cancel clear)
   └──must──►  R2-P0-4 (no success intersecting invalidate)

R2-P0-5 (apply indexes)     // independent; do early
R2-P0-6 (now leaf-only)     // independent; do early
```

---

## 10. Suggested PR slices (Round 2)

1. **PR-R2a — Prove + pendingMoves:** R2-P0-1 checklist runbook + R2-P0-3 cancel clear + tests for pending state machine.
2. **PR-R2b — Recurring this-occurrence:** R2-P0-2 + R2-P0-4 + optimistic/occurrence tests.
3. **PR-R2c — Idle + DB:** R2-P0-6 now leaf-only + R2-P0-5 apply indexes (ops) + confirm.

Keep P1 items for a follow-up PR after founder accepts felt P0.

---

## Active Skills Carryover

When implementing Round 2, reload:

- `superpowers:executing-plans` or `superpowers:subagent-driven-development`
- `superpowers:test-driven-development` for optimistic / pendingMoves helpers
- `superpowers:verification-before-completion` — **especially** browser Network proof
- Repo `AGENTS.md` Code quality (layering, immutability, colocated tests)

Do **not** load FullCalendar / Replicache / virtual-grid / PersistQueryClient experiments.

---

## Appendix — Preflight snapshot (2026-07-26)

| Check | Result |
|---|---|
| `tsc` | EXIT 0 |
| Web cache/optimistic tests | 16 pass |
| Core tests | 12 pass |
| Dev server | `npm run dev` up |
| Round 1 plan | Frozen — do not edit |
| Round 2 plan | This file |
