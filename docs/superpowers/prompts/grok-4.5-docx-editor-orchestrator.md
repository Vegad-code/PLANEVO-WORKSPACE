# Grok 4.5 + Composer 2.5 — DOCX In-Place Editor + Autosave

> **Paste the prompt below into Cursor. Both models write code** — Grok 4.5 and Composer 2.5 are
> peer implementers, not chair and workers. Whichever model you paste into runs the fan-out and
> takes work items itself. Everything under "Reference" is what the sub-agents need to actually do it.

---

## THE PROMPT

```
I want you to make a DOCX uploaded to the Planevo Files feature open straight into a real editing
surface instead of a read-only preview, and autosave the user's work back into that exact same .docx
— the same file_sources row and storage object when it's hosted, the same file on disk via the File
System Access API when it's local — never a separate derived copy, unless the user explicitly chooses
"Save a copy," at the level of Google Docs opening a Word file.

It should be utterly perfect, production-grade, with every single thing done at top-tier quality —
from OOXML byte fidelity (tables, merged cells, images, headers, footers, numbering, footnotes, fonts,
RTL text all survive the round trip untouched) to crash-recovery durability to version-conflict
honesty to dark-mode token discipline to the exact wording of the save-status string, to anything you
could think of. This is a data-integrity feature: every defect class here ends with a real person
losing a real document. Treat silent data loss as the worst possible outcome and design every
decision backwards from that.

Fan out sub-agents and have sub-agents tackle each one individually so that the result is utterly
perfect. Use Grok 4.5 AND Composer 2.5 as peer implementers — both models write code, one agent per
work item, each owning an exclusive set of files so two agents never edit the same file at once. Send
the reasoning-dense items (the pure-logic state machine, the concurrency and data-loss coordinator,
the hand-rolled ZIP/OOXML parser, the fidelity diff engine) to Grok 4.5, and the multi-file repo edits
and UI/token/theming work to Composer 2.5. You should /loop on each item and have a separate sub-agent
check it via the real artifact — an actual .docx, unzipped and diffed part-by-part before and after
the round trip, plus the running app in a browser with screenshots in both light and dark themes.
That separate sub-agent should be a really harsh critic: it must verify by executing commands, never
by reading the implementer's claims, and its default posture is rejection. Always review across
models — whatever Grok 4.5 wrote gets a Composer 2.5 critic and whatever Composer 2.5 wrote gets a
Grok 4.5 critic, so no model is grading its own blind spots. If it doesn't clear the bar, it should
keep going.

Don't stop until each sub-agent is utterly wowed with the quality when compared with Google Docs
opening a Word file. It should literally compare them side by side blind and say which one is better:
take a real .docx, open it in Planevo and round-trip it, then present the original package and the
round-tripped package to a fresh critic with the labels stripped and make it say which one is the
degraded copy — if it can tell, the fidelity bar is not met and you keep going. Do the same blind
comparison on the code itself: put the DOCX modules beside already-shipped Planevo modules
(features/files-product/text-document-editor.tsx and the lib/calendar pure-logic modules) with the
names stripped and make a fresh critic say which body of code is better and why.

Do this in Next.js App Router + TypeScript strict + Tailwind with Planevo's CSS-custom-property design
tokens, Supabase (hosted project aixvpsmpiucticxutngp) for storage and the version compare-and-swap
RPC, node:test for all pure logic, and @eigenpal/docx-editor-react as the editing surface. Never
hardcode a hex, font name, or arbitrary pixel value — every color, type, space and radius is a token
in globals.css. Pure logic lives in apps/web/lib/<domain>/ with colocated *.test.mjs; components wire
props to lib and own no business rules. No `any`. Work in the main checkout at /Users/jabbo/PLANEVO,
never a worktree. Do NOT apply the database migration — the founder applies it by hand via the hosted
SQL Editor.

/loop until it's utterly perfect. Fan out sub-agents and ultracode.
```

---

# Reference

Everything below is context the orchestrator and sub-agents need. Point them at this file.

## Read first, in this order

1. `AGENTS.md` — inviolable rules. This is what the harsh critics enforce.
2. `tmp/docx-audit-findings.md` — **40 findings (8 P0 / 15 P1 / 17 P2)**, each with file:line, the
   exact failure interleaving, and a concrete fix. Already produced; never re-run the audit.
3. `tmp/docx-editor-resume.md` — current state and baselines.
4. `docs/design-brief.md` — token names.

Then verify against disk before trusting any of it:

```bash
cd /Users/jabbo/PLANEVO && git status --short && git diff --stat
```

## This is a rescue, not a greenfield build

~1,400 lines already exist, uncommitted in the main checkout, and the design is genuinely good — the
hand-rolled ZIP validator, the recovery-before-overwrite ordering, and the version CAS are
production-grade. **Do not start over.** A fresh agent handed 40 findings tends to rewrite; that is
the main way this run gets wasted.

## Task 1 is a gate

The feature currently throws `Maximum update depth exceeded` the moment any `.docx` is opened. No
browser verification, no screenshot, and no blind visual comparison is possible until it is fixed.
**Do not parallelize, and do not accept any visual claim, while Task 1 is open.**

## Work items, model, and exclusive file ownership

Both models implement. The split is by the shape of the work, not by seniority: Grok 4.5 takes the
reasoning-dense pure-logic and concurrency items, Composer 2.5 takes the multi-file repo edits and
the UI/token surface. **The critic is always the other model** (last column).

| # | Item | Implementer | Critic | Owns exclusively | After |
|---|------|-------------|--------|------------------|-------|
| 1 | **GATE** — render loop | Composer 2.5 | Grok 4.5 | `document-editor-panel.tsx` | — |
| 2 | ZIP false-rejection | Grok 4.5 | Composer 2.5 | `docx-document-transport.ts` (+test) | 1 |
| 3 | Vendor theming (4 × P0) | Composer 2.5 | Grok 4.5 | `docx-editor-vendor.tsx`, `globals.css` | 1 |
| 4 | **HARD STOP** — state machine | Grok 4.5 | Composer 2.5 | `local-document-state.ts`, `local-document-content.ts`, `local-file-repository.ts`, `local-file-mirror.ts` | 1 |
| 5 | Conflict wedge / close destroys work | Grok 4.5 | Composer 2.5 | `docx-autosave.ts` (+test) | 1 |
| 6 | Wire the strict recovery writer | Grok 4.5 | Composer 2.5 | `docx-document-editor.tsx`, `document-recovery.ts` | 5 |
| 7 | Save-a-copy 2nd destination | Composer 2.5 | Grok 4.5 | `docx-save-copy.ts`, `actions.ts`, panel header | 1, 6 |
| 8 | P1 sweep (15 findings) | both, split by file | the other model | per finding — check ownership first | 2–7 |
| 9 | OOXML fidelity harness | Grok 4.5 | Composer 2.5 | `lib/files/docx-fidelity.ts` (+test), `tmp/docx-fixtures/` | 2 |
| 10 | Suite health + API P1s | Composer 2.5 | Grok 4.5 | `document-recovery.test.mjs`, `route.ts` | 1 |
| 11 | Browser QA, both themes | Composer 2.5 | Grok 4.5 | none (read-only + screenshots) | all + migration applied |

2 ∥ 3 ∥ 4 ∥ 10 are safe in parallel. 5→6→7 is strictly sequential. 8 last among code tasks.

Item 8 is the one place both models write concurrently — split the 15 P1s by owning file first, and
never hand two agents findings that live in the same file.

## The hard stop

`apps/web/features/files-product/local-document-state.ts` is one line:

```ts
throw new Error("Local document state machine is not implemented.");
```

Its spec `local-document-state.test.mjs` is fully written (6 scenarios) and cannot even import — it
also imports `DOCX_MIME_TYPE` and `validateLocalEditableFileMetadata` from `local-document-content.ts`
where they do not exist; they live in `local-file-mirror.ts` and must be **moved, not duplicated**.
The module is additionally **orphaned**: nothing imports it but its own test, while
`local-file-repository.ts` carries the same logic inline. De-orphaning it is part of the fix.

## The 8 P0s

1. **Render loop — the feature does not run.** `document-editor-panel.tsx:1389` passes inline arrows
   for `onSaveStateChange`/`onFlushReady`; the editor lists them in effect deps and calls back with a
   freshly allocated object, so React never bails out. The text path four lines above passes
   `setSaveState` directly — the correct pattern that was broken here. Hoist both into
   `useCallback(…, [])`, hold the parent callback in a ref.
2. **A conflict wedges the session, and closing then silently destroys every later edit.**
   `docx-autosave.ts:147`. `flush` can *never* reject (both `enqueue` and `flushChanges` swallow), so
   the close handler's catch/toast is unreachable dead code and the X always "succeeds". Drafts pile
   up at a stale base version and are rejected on reopen.
3. **The recovery-before-overwrite invariant is unenforced.** `docx-document-editor.tsx:206` — the
   wired adapter resolves successfully on blocked storage, failed open, abort, and quota, so the
   original is replaced with nothing behind it. The strict writer that enforces it
   (`document-recovery-writer.ts` → `writeStrict`) **exists, is unit-tested, and was never wired in.**
4. **The ZIP compression-ratio guard falsely rejects ordinary Word documents** — measured 288:1 and
   332:1 against a 100:1 cap. Affected files can't be opened (422) or saved (400), and the user is
   told their valid file is corrupt. It guards nothing: the server never inflates a DOCX. Delete the
   check, keep the entry-count and cumulative-bytes caps, add a >250:1 regression test.
5. **`DOCX_THEME` is an inline `style` prop, so every portal-rendered menu and dialog is unthemed** —
   vendor Google-blue-on-white chrome with drop shadows, in both themes.
6. **The library's shadcn HSL token layer is entirely unmapped**, including
   `.ep-root { color: hsl(var(--foreground)) }` — slate-950, never Deep Charcoal, unreadable in dark.
   Bare HSL triplets, so Planevo hex tokens can't drop in directly; add triplet mirrors in globals.css.
7. **`colorMode` hardcoded `"light"`.** `useResolvedTheme()` already exists at
   `features/editor/planevo-editor.tsx:66` — export and reuse it, do not re-implement.
8. **`--doc-page-text` unmapped**, so page body text paints from a hardcoded `#000000` fallback.

5–8 share one root cause and largely one fix: move the map out of the inline style into a
`html .ep-root { … }` rule in `globals.css` (portals inherit it) and drive `colorMode` from the hook.

**Refuted — do not chase.** The `key={fileSourceId}:{initialVersion}` remount suspicion: autosave
never calls `load()`, so the key is stable. The real bug is that renaming an open file changes
`initialBytes` identity via the `repository` memo deps and blows away editor state (P1).

## Automatic FAIL for the harsh critic

Spawn a **fresh critic in the other model** per item — Composer 2.5 reviews Grok 4.5's work, Grok 4.5
reviews Composer 2.5's. It never sees the implementer's session, and no model ever grades its own
output. Reject on sight, no discussion:

- A spec or test file modified to make something pass. Check `git diff` on every `*.test.mjs`.
  **Weakening `local-document-state.test.mjs` is the single most likely cheat.**
- Any test skipped, renamed, commented out, or its assertions loosened.
- A module left orphaned — imported only by its own test. A passing test on dead code is a failure.
- Any `any`, TODO, placeholder, stub, or thrown "not implemented".
- Any raw hex, arbitrary `[13px]`-style value, or raw Tailwind default where a Planevo token exists.
- A duplicated constant (e.g. `DOCX_MIME_TYPE` defined twice instead of moved).
- A new `tsc` error. The pre-existing `lib/calendar/create-gesture-suppress.ts` Timeout error does
  **not** count — don't fix it, don't report it, don't let new errors hide behind it.
- Success claimed without pasted command output.

Two consecutive FAILs on one item → hand the item to the **other** model to implement from scratch,
with the critic's fix list as the brief. If that also fails, escalate to the founder with both
attempts and the critiques side by side.

The blind comparisons at the end are also cross-model: whichever model did not write the code runs
the labels-stripped code comparison, and a third fresh agent runs the labels-stripped .docx package
comparison so it has no idea which package Planevo produced.

## Verification gates

```bash
cd /Users/jabbo/PLANEVO && npm test
cd /Users/jabbo/PLANEVO/apps/web && npx tsc --noEmit
cd /Users/jabbo/PLANEVO/apps/web && node --experimental-strip-types --test features/files-product/local-document-state.test.mjs
```

Baselines taken before any agent wrote — reconcile against these, don't accept drift:

- `npm test` → **243 passing**. The new DOCX files contribute ~27 alone, so totals must be reconciled
  explicitly; a file may be silently not running.
- Per file: `docx-document-content` 4, `docx-document-transport` 9, `docx-save-copy` 4,
  `local-document-content` 4, `docx-autosave` 5, `document-recovery` 1 (+ leaks an async
  "quota exceeded" error after the test ends — item 10 owns it), `local-document-state`
  **fails to import**.
- `tsc` → exactly **1 pre-existing unrelated error**.
- `npm run lint` has pre-existing repo-wide errors per AGENTS.md — only NEW ones in DOCX files count.

## The 7 promises — the final critic traces each with file:line evidence

a) Upload a `.docx`, click it → lands in an **editor**, never the read-only viewer.
b) Typing autosaves back to the **same** `file_sources` row + storage object.
c) A `.docx` opened from the computer writes back to that same file **on disk**.
d) "Save a copy" offers **both** destinations (computer + new DOCX in Planevo Files).
e) Closing the panel mid-edit saves **before** it closes.
f) A tab crash leaves a recovery draft that reopening actually **offers**.
g) A file changed elsewhere produces a real **conflict**, not a clobber.

## Founder decisions — do not re-ask

1. **Migration**: the founder applies `supabase/migrations/20260731061347_finalize_docx_document.sql`
   by hand via the hosted SQL Editor (project `aixvpsmpiucticxutngp`). **No agent applies it. No
   `supabase db push`. No Docker.** A security audit cleared it as safe as written. Hosted DOCX saves
   return 500 until it lands — expected, not a bug to chase.
2. **Scope**: both save-back paths — hosted round-trip AND local-disk write-back.
3. **Save a copy**: both destinations — native picker (built) and new DOCX in Planevo Files (missing).
4. **Fidelity proof**: OOXML round-trip diffing plus real browser QA.

## Boundaries

**Do:** finish the state machine, fix the 8 P0s and 15 P1s, add the second save-a-copy destination,
build the fidelity harness, browser-QA in both themes.

**Do not:** apply the migration; run `supabase db push` or Docker; rewrite the working
transport/CAS/coordinator design; create a git worktree; add a dependency without exhausting what's
installed; hardcode a hex or arbitrary px; put competitor names in the UI; add gradients, heavy
shadows, or glow; commit without being asked.

## Library note

`@eigenpal/docx-editor-react@1.9.0` (`github.com/eigenpal/docx-editor`, docx-editor.dev) — installed
and wired. The founder cited `github.com/superdoc/docx-editor.git`, which doesn't exist under that
org; same path shape, eigenpal is what was meant.
