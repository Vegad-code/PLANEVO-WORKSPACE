# Codex launch prompt

Copy everything inside the fence into Codex as the opening message.

---

```
You are continuing an in-progress calendar rebuild in this repo (Planevo, Next.js + TypeScript strict + Tailwind + Supabase). Work has already started. Your job is to finish it.

## Read these first, in this order, before writing any code

1. AGENTS.md (repo root) — inviolable product rules
2. apps/web/AGENTS.md — this is a MODIFIED Next.js build; read node_modules/next/dist/docs/ before using any Next API, do not rely on memory
3. docs/calendar-trajectory.md — where this has been, what is built, current state
4. docs/calendar-engine-build-spec.md — YOUR SPEC. Work orders WO-1 through WO-9, conventions, acceptance criteria, anti-scope
5. docs/calendar-audit-2026-07-25.md — the findings being fixed
6. docs/calendar-view-engine-and-aesthetic-2026-07-25.md — architecture and research behind the decisions

Do not skim these. The spec encodes decisions that took a full research pass; re-deriving them wastes your context and mine.

## What is already built — do not rebuild it

- Dead pre-RBC engine deleted (week-grid.tsx, event-block.tsx, CalendarNowIndicatorInline)
- apps/web/lib/calendar/view-config.ts — the 8 view axes as zod, presets Classic/Planner/Flow, resolveViewConfig()
- apps/web/lib/calendar/view-registry.ts — layout to renderer registry, with fallback for unbuilt layouts
- supabase/migrations/20260725120000_calendar_views_and_defaults.sql — calendar_views table + calendars.is_default
- CalendarViewRow + CalendarRow.is_default in packages/core/src/types/calendar.ts
- 5 passing tests in apps/web/lib/calendar/view-config.test.mjs

Extend these. Do not replace them.

## Start here

Begin at WO-1 and work in order. Do one work order at a time: implement it, run its verification block, paste the real output, commit, then move on. Never start WO-N+1 while WO-N is failing.

## Hard rules

- Never hardcode a hex, font name, or pixel value. Every color/space/radius is a CSS custom property in globals.css surfaced through the Tailwind theme. No bg-[#F5F3ED], no text-[13px].
- Relative imports must carry the .ts extension — extensionless breaks the test runner.
- Migrations: you WRITE them, a human APPLIES them via the hosted Supabase SQL Editor. Never run supabase db push. Never assume a migration is live. Make every migration idempotent and never write a backfill that moves existing user data.
- Every Postgres function is `language plpgsql security invoker set search_path = ''`. A security definer anywhere is a bug.
- Server actions follow the existing pattern in apps/web/app/(workspace)/calendar/actions.ts: zod schema, requireMutationDataAccess(), ownership re-check, actionError() wrapper, revalidatePath.
- Tests are *.test.mjs using node:test, colocated, importing .ts directly. New test directories must be added to the test glob in apps/web/package.json or they silently never run.
- Add no dependencies except `rrule` in WO-2. Nothing else.
- Do not copy code from Cal.com, Nextcloud, Radicale, Baikal, EteSync, Etar, or Fossify — all GPL/AGPL. Reading for ideas is fine. Schedule-X (MIT) is the only project you may take code from.
- Respect the anti-scope list in spec section 3. Notably: no attendees, no AI auto-scheduling, no new calendar UI library, do not replace react-big-calendar.

## Known pre-existing failure — do not chase it

apps/web/lib/calendar/format-now-indicator-time.test.mjs fails with '11 :10 AM' vs '11 : 10 AM'. It is an ICU spacing difference in untracked files from earlier work and is unrelated to everything you are doing. Baseline is 173/174 passing. Do not "fix" it, do not count it as a regression you caused.

## Verification bar — this is the part that matters

After every work order:

  cd apps/web && npx tsc --noEmit
  cd apps/web && npm test

Pass means: tsc silent, and test count at or above baseline with only the known format-now-indicator failure.

For anything visually observable, also load /calendar, switch every view, create/drag/resize an event, and check the browser console.

Then self-check before you claim done:
- Did I run both commands and paste the actual output, not a summary?
- Does every new piece of non-trivial logic have a test beside it?
- Did I introduce any hardcoded color, font, or pixel value? (grep to confirm)
- Did I introduce security definer anywhere? (grep to confirm)
- Are there code paths I changed but never executed?
- Did I guess at any behavior instead of reading the file?
- Would this survive someone deleting a calendar, a task, or an event mid-flow?

If any answer is uncertain, the work order is not done. Go back.

## Report honestly

At the end of each work order, output:
1. Files touched, one line each, with why
2. Real command output for tsc and npm test
3. Anything you skipped, guessed at, or could not verify — name it explicitly
4. Any migration you wrote, flagged as PENDING HUMAN APPLICATION
5. Anywhere the spec contradicted the actual code — stop and say so rather than silently picking one

Do not claim something works if you did not run it. A truthful "I could not verify X" is worth more than a confident wrong claim — this work gets reviewed line by line afterward, and fabricated verification wastes everyone's time.

Begin with WO-1.
```

---

## After Codex, before Cursor

Ask Codex for its final report, then hand Cursor this:

```
Continue the calendar rebuild in this repo. Read docs/calendar-engine-build-spec.md first — it is the authoritative spec. Read docs/calendar-trajectory.md for current state.

Codex completed work orders up to WO-__. Your job is touch-ups, not new architecture:
1. Run `cd apps/web && npx tsc --noEmit` and `npm test`. Fix any failure EXCEPT format-now-indicator-time.test.mjs, which is a known pre-existing ICU issue.
2. Audit Codex's work against the acceptance checklist for each completed work order in the spec.
3. Fix violations of the hard rules: hardcoded hex/font/px values, missing .ts on relative imports, security definer, missing tests, test directories not in the package.json glob.
4. Do not add features, do not refactor beyond the named files, do not add dependencies.

Report what you changed and what you found wrong.
```
