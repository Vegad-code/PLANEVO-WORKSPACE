# Phase 3 Calendar + Files verification

> Filled in July 19, 2026 by the Fable 5 ship orchestrator (code-first run,
> single review session after Task 15).

## Decision

**Status:** ✅ Automated gates green. `/calendar` is the three-pane product on
`calendars`/`calendar_events`; `/files` is the CloudNest cabinet on
`file_sources`. No kernel faces on either route. Manual QA items below need a
founder pass in the running app (dev server + real Supabase session).

## Commit evidence

| Slice | Commit | Deliverable |
|-------|--------|-------------|
| Task 1 — calendar types | `c38a458` | `types/calendar.ts`, week range helpers + tests |
| Task 2 — calendar queries | `a89a343` | `loadCalendars`, `loadCalendarWeek` (task due merge, workspace scope) |
| Task 3 — calendar mutations | `5eaa4a0` | event/calendar CRUD, `scheduleTaskFromDrag` via `schedule_task_idempotent` |
| Task 4 — files queries | `47af01d` | `loadProductFiles`, `mimeFamily`, `summarizeStorageBytes` |
| Task 5 — files mutations | `d20fcfc` | `createFileSourceRecord`, tags, delete, `attachFileToEvent` |
| Task 6 — scope prefs | `2678f81` | `planevo:calendar:scope`, `planevo:files:scope` |
| Task 7 — calendar sidebar | `93ed29c` | multi-calendar list + visibility + create (in `/design`) |
| Task 8 — today column | `a56503b` | Today/This week/Unscheduled, dnd-kit draggable rows |
| Task 9 — week grid | `ab4bb67` | 7-col time grid, due chips row, now line, day view, toolbar |
| Task 10 — event peek + create | `89de729` | anchored peek, slot-click create dialog, Zod actions |
| Task 11 — calendar cutover | `80a432a` | `CalendarProductView` + DnD schedule; `DatabaseFace` removed from `/calendar` |
| Task 12 — files cabinet shell | `dc389ff` | greeting header, action row (marigold Upload), folder chips |
| Task 13 — files table + upload | `d4efafc` | filter tabs, table, dropzone, storage meter, signed-upload API |
| Task 14 — files cutover | `afb69f6` | preview panel, `FilesProductView`; `DatabaseFace` removed from `/files` |
| Task 15 — cross-links + verification | _this commit_ | event peek pickers, file row pickers, this document |

## Automated gates (run July 19, 2026)

| Gate | Command | Result |
|------|---------|--------|
| Core tests | `cd packages/core && npm test` | **PASS** — 189 tests, 0 fail |
| Web tests | `cd apps/web && npm test` | **PASS** — 48 tests, 0 fail |
| TypeScript | `cd apps/web && npx tsc --noEmit` | **PASS** — no errors |
| Production build | `cd apps/web && npm run build` | **PASS** — `/calendar`, `/files`, `/api/product-files` built |
| Calendar kernel grep | `rg 'DatabaseFace\|getCalendarFaceBundle\|getFilesFaceBundle' 'apps/web/app/(workspace)/calendar' apps/web/features/calendar-product` | **PASS** — exit 1, no matches |
| Files kernel grep | `rg 'DatabaseFace\|getFilesFaceBundle' 'apps/web/app/(workspace)/files' apps/web/features/files-product` | **PASS** — exit 1, no matches |
| Token law grep | `rg 'bg-\[#\|text-\[#\|border-\[#\|\[\d+px\]' apps/web/features/calendar-product apps/web/features/files-product` | **PASS** — exit 1, no hardcoded hex / arbitrary px |

## Spec checklist (code-verified)

- [x] `/calendar` three-pane layout (calendars sidebar · Today column · week grid) — `calendar-product-view.tsx`
- [x] Multi-calendar visibility toggles — sidebar checkbox → `toggleCalendarVisibilityAction`; grid filters `is_visible`
- [x] Task due chips render from `tasks.due_at` on the grid's Due row — never duplicated into `calendar_events`
- [x] Drag task → grid creates `calendar_events` with `task_id` — `scheduleTaskFromDragAction` → `schedule_task_idempotent` (same write path as the Phase 2 Schedule button)
- [x] Schedule from Tasks appears on grid — `loadCalendarWeek` reads all user events in range
- [x] Day view ships; Month deferred post-V1 per spec
- [x] `/files` cabinet layout: greeting · actions · folder chips · filter tabs · table · storage meter
- [x] Upload pipeline: signed browser-to-storage upload (`/api/product-files`), `pending` → `ready` badge, failed-upload cleanup
- [x] Preview panel: image / PDF iframe / text snippet, tags inline add-remove
- [x] Cross-links: event peek → Attach file / Link task / Add to workspace; file row → Attach to task / Link to event
- [x] `All | This workspace` scope on both products via `workspace_links` (client pref keys `planevo:calendar:scope`, `planevo:files:scope`)
- [x] `/design` has Calendar product and Files product sections with component states
- [x] One marigold per view — Calendar: `Today` button; Files: `Upload or drop`
- [x] Planevo `app-shell` untouched — no reference-app global nav cloned

## Manual QA (founder pass in running app)

- [ ] `/calendar` three-pane matches reference at desktop width
- [ ] Toggle calendar visibility hides/shows events live
- [ ] Drag task from Today column onto grid → event appears with 1h block
- [ ] Click empty slot → create event → block renders in calendar color
- [ ] Event peek: attach file, link task, add to workspace round-trip
- [ ] `/files`: drop a PDF → processing → ready → preview opens
- [ ] Filter tabs + search + folder chips narrow the table
- [ ] Attach file to task from row menu → shows in task peek attachment count
- [ ] Storage meter reflects uploads
- [ ] Scope toggle on both products with a workspace open

## Notes / deferred

- Month view, Google write sync, recurring events, folder hierarchy, real
  sharing — all post-V1 per design spec.
- Overlapping events render stacked (no column packing yet) — V1.1 polish.
- Interrupted uploads can leave a `pending` row (visible with a Processing
  badge); delete from the row menu cleans up. Reservation-style recovery can
  come with the ingestion pipeline.

---

## Audit fix pass (July 19, 2026)

Post-ship remediation after full-stack audit. Code changes (uncommitted until founder commits):

| Fix | Deliverable |
|-----|-------------|
| P0 ecosystem links | Home upload + sidebar New file → `/files`; `/files/new` redirects to `/files` |
| P1 route boundaries | `loading.tsx` + `error.tsx` on `/calendar` and `/files` |
| P3 design hygiene | Removed legacy kernel `CalendarView` from `/design`; added `FilePreviewPanel` to files-product preview |
| Contract tests | `ecosystem-product-routes-contract.test.mjs` (51 web tests PASS) |

### Automated gates (audit fix re-run)

| Gate | Result |
|------|--------|
| Core tests | **PASS** — 189 tests |
| Web tests | **PASS** — 51 tests (includes ecosystem route contract) |
| TypeScript | **PASS** |
| Production build | **PASS** |

### Migration status (linked remote)

See [`MIGRATIONS.md`](MIGRATIONS.md). **Required Calendar/Files schema is already on linked remote** (`calendars`, `calendar_events`, `file_links`, `schedule_task_idempotent`). Ledger repair optional for four versions; icon catalog table exists but needs `node scripts/seed-icon-catalog.mjs` if using task icon picker.

### Manual QA — founder session

The checklist below is unchanged. Run together in `npm run dev` with a signed-in session. Audit fix only verified entry-point routing and automated gates — not visual/interaction fidelity.

