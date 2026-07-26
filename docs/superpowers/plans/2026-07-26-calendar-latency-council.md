# Calendar Latency — Council Synthesis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make calendar interactions feel instant by finishing optimistic cache correctness, stopping refetch storms, and cutting sequential backend RTTs — without swapping RBC or adopting CRDT/Replicache.

**Architecture:** Keep TanStack Query as the source of truth. Optimistic patches must win the race against refetch (cancel → patch all intersecting caches → mutate → reconcile without blanket invalidate). Server actions stop double-loading via `revalidatePath`. Range load becomes parallel + lean; Today column stops scanning all tasks.

**Tech Stack:** TanStack Query v5, Next.js App Router server actions + `/api/product-calendar`, Supabase (`packages/core` queries), Framer Motion (`AnimatePresence`), react-big-calendar (keep), optional `@tanstack/react-virtual` for agenda only.

**Council source:** Agents 1–5 (Frontend / Backend / Industry / OSS / Gap), synthesized 2026-07-26. Phase 1–2 optimistic split estimated **~75–90% done**; remaining pain is incomplete optimistic coverage + refetch/render amplification.

## Global Constraints

- Workspace-first IA; Calendar stays an independent product (AGENTS.md).
- Tokens only — no hardcoded hex / arbitrary px in UI work.
- Pure logic in `apps/web/lib/calendar/`; React wires props; colocated `*.test.mjs`.
- Named object params; discriminated unions; no `any`; immutable cache patches.
- Do **not** swap RBC for FullCalendar; do **not** adopt Replicache/CRDT.
- Do **not** invent a second mutation stack beside `use-calendar-mutations.ts`.
- One primary agent implements; others are review-only.

---

## 1. Executive summary — why still slow after the first fix

The first latency pass correctly introduced:

- Split queries (`range` / `meta` / `today`) in `use-calendar-data.ts` + `/api/product-calendar`
- Pure optimistic patchers in `calendar-query-optimistic.ts`
- Central `useCalendarMutations` + `patchMergedCalendarCache`

That removed the *largest* blank-reload path for simple month drag. It did **not** remove the remaining latency classes:

| Residual class | What happens today | User feels |
|---|---|---|
| **Optimistic gaps** | Recurring / undo / cross-link / many panel saves still call full `invalidateCalendar(scope)` | Snap-back or full refetch after gesture |
| **Patch scope too narrow** | `patchMergedCalendarCache` only writes the *active* range key; adjacent prefetched weeks stay stale; RBC may remount from old placeholder | Event jumps then corrects |
| **No cancel-before-patch** | In-flight range refetch can overwrite optimistic `setQueryData` | Classic snap-back |
| **Invalidate storm** | Server `revalidatePath("/calendar")` + client triple invalidate + 3-part refetch = auth×3 and double work | Dim grid, jank after every write |
| **Backend waterfalls** | `loadCalendarWeek` still awaits `loadCalendars` then events/masters/exceptions/tasks sequentially; range path duplicates calendars already in meta | 6–8 RTT weeks |
| **Render amplification** | `popLayout` double-mounts grid; `isFetching` dims on meta/today; `CalendarNowProvider` ticks whole tree; month grid unmemoized | Constant micro-jank even when data is warm |
| **Heavy Today / RRULE** | `loadTodayColumnTasks` selects **all** tasks; RRULE expansion on every range fetch; family snapshot on every recurring write | Slow API even with warm UI |

**Verdict:** Phase 1–2 bought optimistic *primitives*. Phase 3 must make optimistic the *default path for every write*, stop refetching what we already patched, and cut serial server work. Industry + OSS agents agree: deepen TanStack Query — do not replace the calendar engine.

---

## 2. Council consensus priorities

### P0 — Ship first (felt latency on every interaction)

1. **Cancel in-flight queries before optimistic patch** (`cancelQueries` on intersecting range/meta/today keys).
2. **Patch ALL intersecting range caches**, not only the active key (fix no-op when cache incomplete; seed from nearest range when possible).
3. **Stop success-path full invalidate** for simple create/move/resize/delete/status/due; reconcile with returned row or surgical helper.
4. **Migrate recurring + undo off pessimistic full invalidate** onto optimistic + scoped reconcile (or single active-range invalidate max).
5. **Kill `revalidatePath("/calendar")` on hot mutation paths** (or gate to rare meta changes only) so RQ is not fighting RSC reload.
6. **`isFetching` dimming only for true range navigation** (`rangeQuery.isFetching && !isPlaceholderData`), never meta/today background refetch.
7. **Parallelize `loadCalendarWeek`** and **drop duplicate `loadCalendars` from range path**.

### P1 — Next (backend cost + remaining UX edges)

8. **Auth once / batch parts** — avoid 3× `getDataAccess` for linked prefetch; prefer single warm session or batched endpoint for initial paint.
9. **`loadTodayColumnTasks` filter** — due today / overdue / incomplete only; index support.
10. **DB indexes** for range filters (`user_id, deleted_at, starts_at`, exceptions by `parent_event_id`, tasks due window).
11. **Defer reminder writes off the critical save path** (fire-and-forget or second mutation after event commit).
12. **Replace `popLayout` with non-remounting transition** (or keep previous grid mounted until next ready).
13. **Narrow `CalendarNow` consumers** so minute tick does not re-render product view + grid.
14. **`mutation.scope` / per-entity serial queue** for same-event rapid edits (TanStack `useMutation` scope or local queue).
15. **Wire unused surgical invalidate helper**; remove premature success toasts that fire before commit.

### P2 — Polish / measure (only after P0–P1)

16. Memo month grid / day cells; profile with React Scan before broader memoization.
17. `@tanstack/react-virtual` for dense agenda/list only — **not** month/week/day grids.
18. Abortable prefetch (AbortSignal on nav spam).
19. 409 conflict UX when server rejects stale write (toast + refetch that entity’s ranges).
20. RRULE expansion cache / materialize-at-write where safe; stop full family snapshot on every write if undo only needs diff.
21. Drag = overlay-only until drop (month already closer; ensure week/day RBC drag matches).

---

## 3. Phase-by-phase work packages

### Phase A — Optimistic correctness (P0 frontend) ~1–2 days

**Why first:** Fixes snap-back without waiting on backend.

| Package | Files | Work |
|---|---|---|
| A1. Multi-cache patch + cancel | `apps/web/lib/calendar/calendar-query-cache.ts`, `calendar-query-keys.ts`, `calendar-query-optimistic.ts` (+ tests) | Add `cancelCalendarQueries`, `patchAllIntersectingCalendarCaches({ queryClient, scope, eventWindow, patch })`. Use `queryClient.getQueriesData({ queryKey: calendarQueryScopePrefix(scope) })`. If merged read fails, patch range slice alone when range exists. |
| A2. Mutation runner upgrade | `apps/web/features/calendar-product/use-calendar-mutations.ts` | Before patch: cancel. Patch all intersecting. On success: optional `replaceEventId` / field reconcile from server row; **no** `invalidateQueries` for simple paths. On error: restore all snapshots. Add `mutation.scope` or serial queue keyed by `eventId`/`taskId`. |
| A3. Product-view demote invalidate | `apps/web/features/calendar-product/calendar-product-view.tsx` | Replace blanket `invalidateCalendar(scope)` after create/move/resize/delete/status/due/cross-link with mutation helpers. Keep invalidate only for: calendar CRUD, view prefs, external sync, scope switch. Recurring + undo: optimistic remove/patch occurrence family or single-range invalidate. |
| A4. Surgical invalidate | `use-calendar-data.ts` (`useInvalidateActiveCalendarRange` already exists — **wire it**) | Export `invalidateIntersectingRanges({ scope, start, end })`. Use after recurring series ops where full expansion cannot be client-patched safely. |
| A5. Fetching UX | `use-calendar-data.ts`, `calendar-product-view.tsx`, `calendar-view-transition.tsx` | Split `isFetching` → `isRangeFetching` / `isMetaFetching`. Dim/opacity only on range nav. |

**Tests:** extend `calendar-query-optimistic.test.mjs` + new `calendar-query-cache.test.mjs` for multi-key patch, cancel ordering, incomplete-cache no-op→partial patch, rollback restores all keys.

**Acceptance:** Drag event across week boundary; no snap-back; Network tab shows **0** range refetch on success for simple move.

---

### Phase B — Stop double load (P0 server + client contract) ~0.5–1 day

| Package | Files | Work |
|---|---|---|
| B1. Hot-path `revalidatePath` | `apps/web/app/(workspace)/calendar/actions.ts` | Remove or no-op `revalidatePath("/calendar")` (and `/tasks` where calendar already patches today) on event/task time mutations. Keep revalidate for calendar source CRUD / Google sync / rare meta. |
| B2. Toast timing | `calendar-product-view.tsx`, mutation hooks | Success toast only after `result.ok`; undo toast after restore applied; no toast before optimistic paint. |
| B3. Reminder off critical path | `actions.ts` (create/update event), reminder helpers | Commit event first; upsert reminder async (or separate action). Save must not await reminder permission/DB if it blocks. |

**Acceptance:** Single mutation → at most 0–1 background reconcile fetch; no RSC reload of `/calendar`.

**Ships with:** Phase A (otherwise removing revalidate without optimistic coverage worsens staleness).

---

### Phase C — Backend range RTT (P0/P1) ~1–2 days

| Package | Files | Work |
|---|---|---|
| C1. Drop calendars from week load | `packages/core/src/queries/product-calendar.ts` (`loadCalendarWeek`), callers | Stop `await loadCalendars` inside week load when caller only needs events/tasks. Keep calendars in meta part only (`fetch-calendar-page-data.ts`). |
| C2. Parallelize week queries | `product-calendar.ts` | `Promise.all` standalone events + masters RPC (+ workspace id lists if needed). Exceptions still depend on master ids — second stage only. Target: 2–3 RTT vs 6–8. |
| C3. Today filter | `packages/core/src/queries/product-tasks.ts` (`loadTodayColumnTasks`) | Filter `due_at` window + incomplete statuses (product rule: match Today column UX). Add regression test. |
| C4. Indexes | new `supabase/migrations/YYYYMMDDHHMMSS_calendar_range_indexes.sql` | Propose: `(user_id, starts_at) WHERE deleted_at IS NULL`, exceptions `(parent_event_id, recurrence_id)`, tasks `(user_id, due_at) WHERE …`. Verify with `EXPLAIN` on local. |
| C5. Auth amplification | `apps/web/app/api/product-calendar/route.ts`, `use-calendar-data.ts` | Short term: ensure layout/page seeds all three caches (already in `page.tsx`) so client doesn’t triple-fetch on first paint. Medium: optional `part=bundle` for prefetch neighbor that returns range-only (meta/today already warm). |

**Acceptance:** Range API p95 drops materially; Today payload size shrinks for heavy task users.

---

### Phase D — Render jank (P1) ~1 day

| Package | Files | Work |
|---|---|---|
| D1. View transition | `calendar-view-transition.tsx` | Replace `AnimatePresence mode="popLayout"` with `mode="wait"` **or** crossfade without remounting both grids; prefer keep-alive previous until next committed. |
| D2. Now tick isolation | `calendar-now-context.tsx`, `calendar-product-view.tsx`, `calendar-grid-engine.tsx`, `calendar-now-indicator.tsx` | Move `useCalendarNow()` off product-view root. Only indicator / past-event chips subscribe. Or store `nowMs` in ref + forceUpdate on indicator only. |
| D3. Month memo | `month-grid.tsx`, `month-day-cell.tsx`, `month-week-row.tsx` | `memo` cells with stable callbacks; only after React Scan confirms. |
| D4. Drag overlay purity | `month-drag-overlay.tsx`, `calendar-grid-engine.tsx`, RBC wrappers | During drag, mutate overlay state only; commit via Phase A mutation on drop. |

**Acceptance:** Minute clock does not re-render toolbar/sidebar; view switch does not flash empty double-mount.

---

### Phase E — Hard cases & polish (P1/P2) ~1–2 days

| Package | Files | Work |
|---|---|---|
| E1. Recurring optimistic | `calendar-query-optimistic.ts`, mutations, recurrence dialog | Patch this/all/following with client rules matching server; on ambiguity invalidate intersecting ranges only. |
| E2. Undo optimistic | `undo-stack.ts`, product-view undo handler | Apply inverse patch to caches; avoid full invalidate. |
| E3. Cross-links | `event-cross-links.tsx` / product-view handlers | Optimistic link list patch; no range invalidate. |
| E4. Conflict UX | actions + mutations | Map unique/version conflicts → toast + `invalidateIntersectingRanges` for that event window. |
| E5. Abortable prefetch | `use-calendar-data.ts` | Pass `signal` from `queryFn` context; ignore abort errors. |
| E6. Agenda virtualization | agenda feature only | Add `@tanstack/react-virtual` if agenda list is the measured bottleneck — **not** grids. |
| E7. RRULE / snapshot cost | `product-calendar.ts`, recurrence mutations, undo RPCs | Cache expansion per master+window in request; snapshot family only when undo token requires it. |

---

## 4. Cross-agent dependencies (must ship together)

```
A1 + A2  ──must──►  A3 (product-view stop invalidate)
   │
   └──must──►  B1 (drop revalidatePath)
                 │
                 └──safe──►  C1–C2 (backend parallel)  // independent but verify after A+B

A5  ──with──►  D1 (fetch dim + transition)  // otherwise "fixed fetch" still looks slow

D2  independent of A/B/C but do before memo (D3)

E1/E2  require A1 multi-cache patch (recurring spans ranges)

C3 + C4  ship together (filter without index can regress)

Reminder B3  can ship with A3 save path; do not block A1
```

**Minimum lovable bundle (founder ship cut):** **A1–A5 + B1 + A3 recurring/undo demotion + C1–C2.**  
Everything else can follow in a second PR.

---

## 5. What NOT to do

- **Do not** replace react-big-calendar with FullCalendar (or any engine swap).
- **Do not** adopt Replicache, Electric, CRDTs, or a local-first sync layer for V1.
- **Do not** virtualize the month/week/day grid.
- **Do not** add a second parallel mutation system; extend `use-calendar-mutations.ts`.
- **Do not** “fix” latency by only memoizing month while leave/invalidate storms remain.
- **Do not** keep success-path `invalidateQueries` “just to be safe” after optimistic patch — that reintroduces snap-back.
- **Do not** call `revalidatePath("/calendar")` on every event write.
- **Do not** expand scope into Google sync redesign, NLP capture, or Tasks product refactors.
- **Do not** claim fixed without Network panel + UI gesture proof (AGENTS.md visual QA).

---

## 6. Verification checklist

### Automated

- [ ] `node --test apps/web/lib/calendar/calendar-query-optimistic.test.mjs`
- [ ] New cache multi-key / cancel tests green
- [ ] `packages/core` calendar + today-task query tests green
- [ ] `tsc` clean for `apps/web` + `packages/core` touched surface

### Manual — Network + UI (mandatory)

- [ ] **Month drag** event: paints immediately; no snap-back; **0 range refetch** on success
- [ ] **Week/day drag-resize**: same
- [ ] **Create event** from slot: optimistic chip → id swap; no full dim
- [ ] **Delete / complete / due change**: optimistic; rollback on forced error
- [ ] **Recurring this/all/following**: correct chips; at most intersecting-range refetch
- [ ] **Undo**: restores without full calendar reload flash
- [ ] **Navigate week** with warm prefetch: no meta/today-triggered opacity dip
- [ ] **Sit idle 2+ minutes**: now indicator moves; toolbar/sidebar do not re-render (React Scan)
- [ ] **View switch** day↔week↔month: no double-mounted empty flash
- [ ] **Heavy task user**: Today API returns filtered set; range API fewer sequential waits (DevTools timing)
- [ ] **Reminder set on save**: event appears instantly; reminder failure does not roll back event
- [ ] Forced **409/error**: toast + correct rollback

### Perf targets (directional)

| Interaction | Before (post Phase 1–2) | Target |
|---|---|---|
| Simple drag success refetches | 1–3 parts | 0 |
| Range API internal RTTs | 6–8 sequential | ≤3 parallel stages |
| Meta/today background refetch UI | dims grid | invisible |
| Now tick re-render scope | product tree | indicator-local |

---

## 7. Estimated impact per item

| ID | Item | Impact on felt latency | Effort |
|---|---|---|---|
| A1 | Cancel + patch all intersecting caches | **Critical** — kills snap-back | M |
| A2 | Mutation runner (no success invalidate) | **Critical** — stops post-gesture refetch | M |
| A3 | Product-view demote invalidate / recurring+undo | **Critical** — covers remaining hot paths | L |
| A4 | Wire surgical invalidate | High for series ops | S |
| A5 | Range-only fetching dim | Medium UX | S |
| B1 | Remove hot `revalidatePath` | **High** — stops double load | S |
| B2 | Toast after commit | Low UX trust | S |
| B3 | Reminder off save path | Medium on save | S |
| C1 | No calendars in range load | Medium API | S |
| C2 | Parallel `loadCalendarWeek` | **High** API | M |
| C3 | Today task filter | High for power users | S |
| C4 | Indexes | Medium–High at scale | S |
| C5 | Auth/part amplification | Medium cold load | S–M |
| D1 | popLayout fix | Medium nav jank | S |
| D2 | Now-tick isolation | Medium idle jank | S |
| D3 | Month memo | Low–Medium | S |
| D4 | Overlay-only drag | Medium week/day | S–M |
| E1–E2 | Recurring/undo optimistic depth | High on those flows | L |
| E3 | Cross-link optimistic | Low–Medium | S |
| E4 | 409 UX | Correctness | S |
| E5 | Abortable prefetch | Low–Medium nav spam | S |
| E6 | Agenda virtual | Niche | S |
| E7 | RRULE/snapshot trim | Medium API under recurrence load | M |

**Rough total for minimum lovable bundle (A1–A5 + B1 + A3 + C1–C2):** ~3–5 engineering days including tests and UI proof.

---

## Suggested PR slices

1. **PR1 — Cache correctness:** A1, A2, A5 + tests (no product-view behavior change yet beyond fetching dim).
2. **PR2 — Stop the storm:** A3, A4, B1, B2 (recurring/undo included).
3. **PR3 — Backend range:** C1, C2, C3, C4.
4. **PR4 — Render jank:** D1–D4, B3.
5. **PR5 — Hard cases:** E1–E7 as needed.

---

## Active Skills Carryover

When implementing this plan, reload:

- `superpowers:executing-plans` or `superpowers:subagent-driven-development`
- `superpowers:test-driven-development` for cache/patch helpers
- `superpowers:verification-before-completion` before claiming fixed
- Repo `AGENTS.md` Code quality (layering, immutability, colocated tests)

Do **not** load FullCalendar / Replicache / virtual-grid experiments.
