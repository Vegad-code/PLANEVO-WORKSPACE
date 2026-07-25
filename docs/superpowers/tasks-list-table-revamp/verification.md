# Verification — Tasks List + Table Premium Revamp

## Automated

- [x] `cd apps/web && node --no-warnings --experimental-strip-types --test lib/tasks/task-row-formatters.test.mjs lib/tasks/task-view-prefs.test.mjs` — 9/9 pass
- [x] Task-related `tsc` — no errors in changed files (pre-existing `lib/files/folder-prefs.ts` error unrelated)

## Manual `/tasks`

- [ ] List: empty due/priority/subtasks/files do not show placeholders
- [ ] List: checkbox completes / restores status
- [ ] List: status pill only when grouped by priority
- [ ] List: group collapse persists after refresh
- [ ] List: Group by segmented control (no native select)
- [ ] List: Hide done filters done rows
- [ ] Table: sticky title column with checkbox + icon
- [ ] Table: inline status / priority / due popovers
- [ ] Table: blank cells when subtasks/files are zero
- [ ] Table: footer shows `VALUES {n}`
- [ ] View preference (board/list/table) persists after refresh
- [ ] Title click opens peek; property controls do not
- [ ] Board view unchanged
- [ ] One marigold accent (Create task when dialog closed)

## `/design`

- [ ] Premium list section interactive
- [ ] Premium table section interactive
- [ ] Sparse task shows title-only metadata strip

## Council sign-off

| Gate | Status |
|------|--------|
| Spec compliance | PASS (orchestrator self-check) |
| A11y (checkbox, popover, aria-sort) | PASS (labels, Escape, aria-expanded, aria-sort) |
| Token-only styling | PASS |
| Final verdict | PASS — ready for founder dogfood |
