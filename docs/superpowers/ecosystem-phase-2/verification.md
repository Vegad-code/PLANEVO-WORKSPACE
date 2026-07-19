# Phase 2 Tasks product verification

Verified on 2026-07-18 in `/Users/jabbo/PLANEVO` against code candidate `d4c690d`; unrelated
pre-existing working-tree changes were preserved.

## Decision

The release-candidate tests, strict TypeScript check, scoped lint, production build, and
Tasks kernel grep are green. Final review hardening is committed in `d4c690d`, including
endpoint-complete RLS, canonical file ownership, locked attachment lifecycle operations,
idempotency keys, transactional ordering/deletion, abandoned-reservation recovery, and
the visible cancelled/due-date/accessibility fixes. The additive migrations
`20260718150000_restrict_task_attachment_claim_acl.sql` and
`20260718160000_phase2_final_integrity.sql` have not been applied remotely. Qualifying
founder dogfood must not begin until both are applied and reverified. Phase 2 is **not
complete**: authenticated browser fidelity/interaction remains unverified, and Task 14
requires three consecutive weekday sign-offs in
`.superpowers/ecosystem-phase-2/dogfood-log.md`.

## Commit and cutover evidence

| Slice | Evidence |
|---|---|
| Task 0 / Tasks product-only page | `5e7bdd1 feat(web): complete tasks strangler cutover off DatabaseFace` |
| Task 9 / Lumis Tasks shell | `ac51539 feat(web): complete Lumis tasks product shell` |
| Task 10 / cross-feature actions | `5da290e feat(web): add Schedule, Attach file, and Add to workspace task actions` |
| Task 11 / product quick capture | Verified at `bdcf5cc feat(web): wire quick capture to tasks product table` |
| Task 12 / final empty-kernel check | Required scoped grep below returned no matches (ripgrep exit `1`, the expected no-match result) |
| Final review hardening | `d4c690d fix(tasks): close Phase 2 final review findings` |

All four commit objects were resolved fresh with `git show -s` on 2026-07-18.

## Fresh automated evidence

These commands were run from the paths shown on 2026-07-18; no result is copied from a
prior worker report.

| Gate | Command | Exact result |
|---|---|---|
| Core tests | `cd packages/core && npm test` | exit `0`; `155` tests, `155` passed, `0` failed, `0` skipped |
| Web tests | `cd apps/web && npm test` | exit `0`; `48` tests, `48` passed, `0` failed, `0` skipped |
| Web TypeScript | `cd apps/web && npx tsc --noEmit` | exit `0`; no output |
| Phase 2 scoped lint | `cd apps/web && npx eslint <Phase 2 files>` | exit `0`; `0` errors |
| Production build | `cd apps/web && npm run build` | exit `0`; compiled, typechecked, generated `24/24` static pages; `/design` prerendered and `/tasks` registered |
| Tasks kernel grep | `rg 'DatabaseFace\|createTaskWithRequiredFoundation\|getTaskFaceBundle\|recreateTaskDatabase' 'apps/web/app/(workspace)/tasks' apps/web/features/tasks-product` | no output; ripgrep exit `1`, explicitly normalized as the expected no-match result |
| Final hardening whitespace | `git diff --check d4c690d^..d4c690d` | exit `0`; no output; covers all 32 files in the final review fix |
| Route smoke | run `npm run dev` in `apps/web`, then `curl` `/tasks` and `/design` on `127.0.0.1:3000` | exit `0`; `/tasks HTTP 200`; `/design HTTP 200`; server log recorded both `GET` requests as `200` |

The route smoke proves server rendering and routing only. It does not prove layout,
client hydration, browser console health, or any interaction.

The repository-wide ESLint command still reports pre-existing failures outside the
Phase 2 Tasks file set in command-bar, database, editor, and shell code. Those unrelated
files were not changed to manufacture a green Phase 2 result; the exact Tasks scope is
clean and the production build passes.

## Hosted migration evidence

The repository has the Supabase CLI (`2.109.1`) and an existing linked project. A safe,
read-only status check was run:

```sh
cd /Users/jabbo/PLANEVO
node_modules/.bin/supabase migration list --linked
```

The command exited `0` and connected to the remote database. Its relevant rows were:

| Migration | Local ledger | Remote ledger | Latest ledger result |
|---|---:|---:|---|
| `20260718130000_task_in_review_status.sql` | `20260718130000` | blank | not recorded remotely |
| `20260718140000_task_attachment_claim.sql` | `20260718140000` | blank | not recorded remotely |
| `20260718150000_restrict_task_attachment_claim_acl.sql` | `20260718150000` | blank | **not applied remotely** |
| `20260718160000_phase2_final_integrity.sql` | `20260718160000` | not re-queried after creation | **not applied remotely** |

After the founder reported that both migrations had been run manually in the hosted SQL
Editor, the exact ledger command was repeated in this same Task 13 session. It again
exited `0` and returned blank remote values for both versions. Founder-supplied
screenshots show both SQL Editor runs returning `Success. No rows returned`—one for the
`tasks_status_check` update and one for the attachment-claim function/grants. Because
manual SQL Editor execution does not populate Supabase's migration ledger, read-only
schema introspection was then run against the linked remote database:

```sh
node_modules/.bin/supabase db query --linked \
  "select c.conname, pg_get_constraintdef(c.oid) as definition from pg_catalog.pg_constraint c where c.conrelid = 'public.tasks'::regclass and c.conname = 'tasks_status_check';"

node_modules/.bin/supabase db query --linked \
  "select p.proname, pg_get_function_identity_arguments(p.oid) as arguments, p.prosecdef as security_definer, pg_get_functiondef(p.oid) as definition from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'claim_task_attachment';"

node_modules/.bin/supabase db query --linked \
  "select p.proacl::text as acl, has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute, has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute, has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_execute from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'claim_task_attachment';"
```

All three queries exited `0`. The constraint result includes `not_started`, `in_progress`,
`in_review`, `done`, and `cancelled`. The function result has the exact arguments
`p_owner_id uuid, p_file_source_id uuid, p_task_id uuid`, reports
`security_definer: false` (invoker security), fixes `search_path` to an empty value, and
contains the expected owned-source lock, task ownership check, existing-link guard,
`file_links` insert, and claimed-metadata update.

The ACL query exposed one hardening discrepancy: the current remote ACL is
`{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`,
so `anon_execute` is `true`. The function is still invoker-scoped, so anonymous calls do
not bypass RLS, but this is broader than the migration's authenticated/service-role
intent. The new `20260718150000` forward migration explicitly revokes all function
privileges from `anon` and reasserts authenticated/service-role execute access. It was
created locally only; no ACL mutation was made here.

**Schema gate result:** `20260718130000` and `20260718140000` are **APPLIED MANUALLY /
migration ledger drift**.
Their runtime schema prerequisites are present. However, `20260718150000` and
`20260718160000` are **REQUIRED before production or qualifying dogfood security
sign-off**. This is schema evidence, not a live attachment or In review interaction test.

The ledger output also showed `20260717090000`, `20260717120000`, and
`20260718120000` as local-only. Do **not** run `db push` while this drift is unresolved;
it may attempt to replay SQL that is already present. An authorized migration operator
should verify each unrecorded migration's actual schema, then reconcile only proven
versions. For these two proven versions, the exact repair workflow is:

```sh
node_modules/.bin/supabase migration repair --linked --status applied \
  20260718130000 20260718140000
node_modules/.bin/supabase migration list --linked
```

That repair mutates the hosted migration ledger and was deliberately **not run** in this
documentation slice. Do not mark any earlier version applied without equivalent schema
evidence.

Because the ledger is already drifting, do not use `db push` blindly. An authorized
operator must first reconcile the proven manual applications or run the exact
`20260718150000` and then `20260718160000` SQL in the hosted SQL Editor. Then rerun the
ACL query above and verify the new functions, columns, indexes, and policies. The security
gate passes only when `anon_execute` is `false` for every Task attachment RPC while
`authenticated_execute` and `service_role_execute` remain `true`. Mark a version applied
in the ledger only after its schema evidence exists.

During founder dogfood:

1. Do not count or sign a Task 14 day until both `20260718150000` and `20260718160000`
   are applied and the remote integrity/ACL gates above pass.
2. In an authenticated browser, create/move a disposable task into **In review** and
   refresh to prove persistence. Create another disposable task with an attachment and
   confirm the task/file link survives refresh. Do not infer runtime readiness from the
   schema inspection alone.

## Lumis craft checklist — browser required

No item in this section is signed off by the automated gates.

- [ ] The board has four lanes in order: To do, In progress, In review, Done, with
  visible counts and calm equal-height lane treatment.
- [ ] A populated card shows the intended anatomy: monogram, title, priority, subtask
  progress, file treatment/count, tags, and due/overdue metadata where applicable.
- [ ] The toolbar exposes scope and Board/List/Table views with one clear Create task
  action.
- [ ] The create form visibly includes title, description, priority, due date, estimate,
  tags, attachments, Cancel, and Create task.
- [ ] The create control in each lane opens the same form with that lane preselected.
- [ ] The true empty state shows faint line-art scaffolding and first-task copy, without
  database recreation language.
- [ ] At every state, at most one marigold accent is visible; while the dialog is open,
  the dialog primary action owns the accent.
- [ ] `/design` visibly renders the task card, four lanes, toolbar, create form, empty
  state, list, table, Task Peek, and cross-feature action states.

Compare `/tasks` at `1780 x 1286` with the board source and the create modal at
`1764 x 1288` with the modal source listed in `design-qa.md`. Capture screenshots, check
the console, and record/fix every P0/P1/P2 mismatch before visual sign-off.

## Functional checklist — authenticated browser required

Use disposable dogfood data for destructive steps and refresh after every mutation that
claims persistence.

- [ ] Create a task from the toolbar with every field, refresh, and verify its values.
- [ ] Edit title, description, priority, due date, estimate, and tags in Task Peek;
  refresh and verify.
- [ ] Delete a disposable task and verify it remains absent after refresh.
- [ ] Create, toggle, and delete subtasks; verify count/progress and persistence.
- [ ] Pointer-drag and keyboard-drag within a lane and across lanes, including into and
  out of In review; refresh and verify order/status.
- [ ] Switch to List and verify the same tasks/data and open a task.
- [ ] Switch to Table and verify the same tasks/data and open a task.
- [ ] Schedule a task with a valid date/time range; verify the success state and the
  linked calendar event.
- [ ] Attach an owned file; verify the visible file count/link and persistence.
- [ ] Add a task to an owned workspace; verify the success state, duplicate-disabled
  picker state, and workspace link.
- [ ] Open quick capture, create a task without a database token, and verify it appears
  in `/tasks`.
- [ ] Undo a newly quick-captured task and verify that exact task remains absent after
  refresh.
- [ ] Change the workspace scope filter and verify only linked tasks appear; restore the
  global scope and verify all owned tasks return.

## Browser verification boundary

Fresh HTTP smoke checks returned `200` for `/tasks` and `/design`. This Task 13 session
exposed no browser, Chrome, or computer-control backend, matching the earlier discovery
failure recorded in `design-qa.md`. Therefore no screenshot, rendered comparison,
authenticated click-through, console inspection, drag interaction, or live mutation is
claimed as passed. These checks are mandatory manual work, not optional polish.

## Task 14 founder gate

1. Do not begin until the migration prerequisite above passes.
2. On at least **three consecutive weekdays**, the founder uses `/tasks` and completes
   every Lumis and functional checklist item defined in the dogfood log. Consecutive
   weekdays skip weekends but may not skip an intervening Monday-Friday.
3. After each day's run, append the actual ISO date, notes/issues, and the founder's
   dated sign-off. A partial day, proxy sign-off, or undated row does not count.
4. Any blocking regression pauses the gate. Fix and reverify it, then restart the
   three-consecutive-weekday count unless the founder explicitly records why the prior
   day remains valid.
5. Phase 2 must not be declared complete and Phase 3 must not advance until all three
   qualifying rows are signed by the founder.

## Safe rollback notes

### Tasks UI and actions

- Stop the affected deployment and redeploy the last known-good application artifact.
  Prefer deployment rollback or a new `git revert` commit; do not reset the shared branch.
- Leave the hosted tables and rows in place. A UI rollback must not delete `tasks`,
  `task_subtasks`, `calendar_events`, `workspace_links`, `file_sources`, `file_links`, or
  Storage objects. Product tasks may be temporarily hidden by the old UI, but remain
  recoverable for the forward fix.
- Disable new Phase 2 attachment/create traffic before changing the attachment RPC, and
  reconcile any `unclaimed` or `cleanup_pending` reservations through the existing safe
  cleanup path. Never bulk-delete user files as rollback.

### `20260718130000_task_in_review_status.sql`

- Preferred rollback: leave the widened status constraint installed. It is compatible
  schema and preserves every task/status while the old UI is restored.
- If a strict constraint rollback is unavoidable, first deploy code that no longer writes
  `in_review`, inventory affected rows, and transactionally map those rows to an agreed
  surviving status (normally `in_progress`) before restoring the old constraint. This
  changes status semantics but deletes no task. Never drop or truncate the `tasks` table,
  and never edit Supabase migration history by hand.

### `20260718140000_task_attachment_claim.sql`

- Preferred rollback: leave `claim_task_attachment(uuid, uuid, uuid)` installed but stop
  calling it from the rolled-back app; it is additive and preserves existing links.
- If removal is required, first drain old clients, reconcile pending reservations, and
  verify no deployed code calls the RPC. Then an authorized operator may revoke execute
  and drop only that function signature. Do not delete `file_sources`, `file_links`,
  Storage objects, or tasks, and do not mark the migration rolled back by manually editing
  the migration ledger.

### `20260718150000_restrict_task_attachment_claim_acl.sql`

- Leave this hardening migration applied during an application rollback. Revoking
  anonymous execute deletes no tasks, files, links, or Storage objects and does not block
  authenticated or service-role callers.
- Do not restore anonymous execute as a rollback shortcut. If the underlying RPC is
  retired, follow the `20260718140000` removal sequence instead and drop only the function
  after callers and pending reservations are reconciled.

### `20260718160000_phase2_final_integrity.sql`

- Prefer an application rollback while leaving the additive ownership columns, indexes,
  RLS policies, and invoker-security RPCs installed. They preserve data and narrow access.
- Before retiring any new RPC, drain old clients and inventory unclaimed,
  `cleanup_pending`, claimed, and detached attachment sources. Never drop link/source rows
  or Storage objects as a rollback shortcut.
- Do not make `file_sources.user_id` nullable again or restore one-sided polymorphic RLS.
  If a forward correction is needed, ship another additive migration after a two-user RLS
  and attachment-lifecycle rehearsal.
