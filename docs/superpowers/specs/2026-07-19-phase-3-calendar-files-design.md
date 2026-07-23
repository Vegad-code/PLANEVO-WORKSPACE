# Phase 3 — Calendar + Files Products Design

> **Status:** Approved for implementation planning · July 19, 2026  
> **Authority:** `docs/planevo-prd.md` v2.0 §8 Phase 3, `docs/planevo-feature-spec.md` F-04, F-05, F-02, F-03 (cross-links), `AGENTS.md`

---

## Goal

Ship the real **Calendar** and **Files** products. `/calendar` and `/files` stop using `DatabaseFace`. Calendar gets the founder reference layout (Today column + week time grid, multi-calendar sidebar). Files gets the CloudNest / Untitled UI cabinet on `file_sources`. Task due dates, drag-to-schedule, and Schedule buttons connect Calendar ↔ Tasks. Files cross-links complete the symmetry started in Phase 2.

**Dogfood Gate #2 (soft):** founder uses Calendar + Files alongside Tasks before Phase 4 embed blocks.

---

## Founder layout override (non-negotiable)

Per `AGENTS.md`, reference images are normally **craft-only**. **Founder override (July 19, 2026):** the attached Calendar and Files screenshots are **layout references for those product routes only** — same class of exception as Home/Acme AI.

| Product | Layout reference | What to clone | What NOT to clone |
|---------|------------------|---------------|-------------------|
| **Calendar** | Frappe/Sunsama-style week view (dark + light refs) | **Three-pane product layout:** calendar list sidebar · Today/to-dos column · week time grid; view toggles (Day/Week; Month post-V1); colored event blocks; event detail popover; current-time line | Reference app's global nav (My Works, Projects, Members, AI threads). Planevo `app-shell` owns global IA. |
| **Files** | CloudNest + Untitled UI refs | **Cabinet layout:** profile/greeting row · primary actions (Create / Upload or drop / Create folder) · folder chip grid · filter tabs · search · file table (name, size, modified, shared-by placeholder) · storage meter | Competitor branding, dark-theme-only palette. Map to Planevo tokens (`paper`, `ink`, `border`, `marigold` accent once). |

**Token law still applies:** no hardcoded hex/px. Translate screenshot density and hierarchy into Planevo tokens.

**One marigold per view:** Calendar = one primary CTA (e.g. `+ New event` or `Today` nav — pick one). Files = one primary CTA (`Upload or drop` **or** `+ Create` — not both marigold).

---

## Architecture

**Strangler cutover (Phase C + D).** Phase 1 laid `calendars`, `calendar_events`, `file_links`. Phase 2 laid Tasks product + `scheduleTask` cross-link. Phase 3 adds:

1. **`packages/core`** — product queries/mutations for Calendar and Files (user-scoped, not workspace kernel RPCs).
2. **`apps/web/features/calendar-product/`** — dedicated React module (sidebar, today column, week grid, event peek).
3. **`apps/web/features/files-product/`** — dedicated React module (cabinet shell, table, upload, preview).
4. **`apps/web/app/(workspace)/calendar/`** and **`files/`** — RSC pages load product data; server actions call core mutations.
5. **Cross-feature** — task due dates merged at render; drag task → `calendar_events` with `task_id`; Schedule (Phase 2) events visible on grid; file ↔ event links via `file_links`.
6. **Deprecate kernel paths** — remove `getCalendarFaceBundle`, `getFilesFaceBundle`, `get_workspace_calendar_records` from product routes.

**Prerequisite:** Phase 2 Tasks product on `/tasks` (no `DatabaseFace`). `scheduleProductTaskAction` and `schedule_task_idempotent` RPC exist.

---

## Calendar (F-04)

### Product layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Planevo app-shell (global sidebar — unchanged)                          │
├──────────────┬─────────────────┬──────────────────────────────────────┤
│ Calendars    │ Today           │  Aug 2026 / W30    Day Week Month    │
│ ─────────    │ To-dos | Event  │  ← Today → Share                     │
│ ● Personal   │                 │  Mon Tue Wed Thu Fri Sat Sun          │
│ ● Work       │ Today           │  9am ┌─────┐                          │
│ ○ Holidays   │  □ Task A       │      │Event│                          │
│ + New cal    │  □ Task B       │  1pm ─── now line ───────────────    │
│              │ This week       │      └─────┘                          │
│              │  □ …            │                                       │
└──────────────┴─────────────────┴──────────────────────────────────────┘
```

### Data model (existing tables)

```sql
calendars (id, user_id, name, color, is_visible, position)
calendar_events (
  id, calendar_id, user_id, title, starts_at, ends_at, all_day,
  location, description_json, task_id, google_event_id, source
)
```

- **Multi-calendar:** sidebar list with visibility toggles and color dots (`color` token key: `slate`, `marigold`, `meadow`, `brick`, etc.).
- **Week grid (V1 default):** 7 columns, time axis 6am–10pm (configurable constants), 30-min snap optional V1.1.
- **Today column:** tasks due today + overdue + unscheduled picker list (read from `tasks` table, not kernel).
- **Task due dates:** `tasks.due_at IS NOT NULL` rendered as **distinct chips** on the all-day row or date header — not duplicated into `calendar_events` unless user schedules a time block.
- **Drag:** drag task from Today column onto grid → create `calendar_events` row with `task_id`, default 1h block at drop time.
- **Click grid:** empty slot → new event form (title, calendar picker, time).
- **Event popover:** title, time, calendar color, location, description, **Join meeting** placeholder (V1 disabled), RSVP pills craft-only (V1: Going? → store in `description_json` or omit).
- **Filter:** `All` | `This workspace` — `planevo:calendar:scope` localStorage; workspace filter via `workspace_links` on events + linked task dues.

### Views

| View | V1 | Notes |
|------|-----|-------|
| **Week** | Default | Reference screenshot |
| **Day** | Ship | Single column time grid |
| **Month** | Post-V1 | Do not block Phase 3 on month view |

### Cross-links (Calendar side)

| Action | Behavior |
|--------|----------|
| **Schedule** (from Task, Phase 2) | Already writes `calendar_events`; Phase 3 grid must show it |
| **Link task** (on event) | Picker → set `task_id` |
| **Create task** (on event) | Inline create → link |
| **Attach file** (on event) | `file_links` target `calendar_event` |
| **Add to workspace** | `workspace_links` toast (F-02) |

### Google Calendar

V1: read sync stub acceptable if ingestion pipeline not ready — **display** `source = 'google'` events if rows exist. Full Composio sync is Phase 6. Do not block cutover on Google.

---

## Files (F-05)

### Product layout (CloudNest / Untitled UI craft)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Welcome back, {name}          [+ Create] [Upload or drop] [Create folder]│
├─────────────────────────────────────────────────────────────────────────┤
│ Folder chips: UI UX Design · Legal Docs · …                             │
├─────────────────────────────────────────────────────────────────────────┤
│ View all | Documents | PDFs | Images          [Search…………]              │
├─────────────────────────────────────────────────────────────────────────┤
│ □ Name              Shared by    Size    Modified    ⋮                  │
│ □ report.pdf        You          2.1 MB  Today        ⋮                  │
├─────────────────────────────────────────────────────────────────────────┤
│ Storage ████████░░  9.2 GB of 10 GB                        [Upgrade]  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data model

- **Primary table:** `file_sources` with `user_id` owner (Phase 2 NOT NULL enforced).
- **Cross-links:** `file_links` → `task` | `calendar_event`.
- **Workspace scope:** filter via `workspace_links` where `resource_type = 'file'`.
- **Storage bucket:** continue `workspace-files` paths with user-scoped prefix migration if needed; V1 may list by `user_id` regardless of legacy `workspace_id`.
- **Folders V1:** `metadata_json.folder` or `tags` string array — chip UI over tags/folders; full folder tree post-V1.

### Behaviors

| Behavior | V1 |
|----------|-----|
| Upload or drop | Drag onto drop target → `file_sources` row + Storage upload + ingestion job |
| Filter tabs | MIME family: All, Documents, PDFs, Images |
| Search | Client filter on name + tags V1; server FTS later |
| Table | Sort by modified (default), name, size |
| Tags | Inline add/remove on row |
| Preview | Side panel: image, PDF (iframe), text snippet |
| Processing | Show `ingestion_status` badge (processing / ready / failed) |
| Shared by | Placeholder avatar "You" V1; collaboration later |
| Storage meter | Sum `size_bytes` for user vs plan cap constant (10 GB dev placeholder) |

### Cross-links (Files side)

| Action | Behavior |
|--------|----------|
| **Attach to task** | Picker or row menu → `file_links` |
| **Link to event** | Picker → `file_links` |
| **Attach file** (from Task, Phase 2) | Already works; Files product shows linked files in metadata |

---

## `/design` kitchen sink

Add sections to `apps/web/app/design/`:

1. **Calendar product** — week grid empty/filled, event block colors, today column states, calendar sidebar, event popover.
2. **Files product** — cabinet header, filter tabs, table row states (processing, selected, tagged), storage meter, preview panel.

Land components in `/design` **before** wiring `/calendar` and `/files`.

---

## Testing & verification gates

| Gate | Command / check |
|------|-----------------|
| Core tests | `cd packages/core && npm test` |
| Web tests | `cd apps/web && npm test` |
| Typecheck | `cd apps/web && npx tsc --noEmit` |
| Calendar kernel grep | `rg 'DatabaseFace\|getCalendarFaceBundle\|get_workspace_calendar_records' apps/web/app/(workspace)/calendar apps/web/features/calendar-product` → no matches |
| Files kernel grep | `rg 'DatabaseFace\|getFilesFaceBundle' apps/web/app/(workspace)/files apps/web/features/files-product` → no matches |
| Manual QA | See plan Task 14 |

---

## Out of scope (Phase 3)

- Workspace embed blocks (Phase 4)
- Month calendar view (optional stretch)
- Google Calendar write-back
- Recurring events
- Full folder hierarchy / Drive sync
- Team sharing / shared-by real avatars
- Calendar skins
- LLM classification

---

## Reference images (attach to orchestrator run)

| Asset | Path |
|-------|------|
| Calendar (dark) | `.cursor/projects/Users-jabbo-PLANEVO/assets/image-be1ace26-5303-469f-aac7-c6c331314938.png` |
| Calendar (light) | `.cursor/projects/Users-jabbo-PLANEVO/assets/image-79c8ae37-c7f4-43fe-a00c-a83777146d65.png` |
| Files (Untitled UI) | `.cursor/projects/Users-jabbo-PLANEVO/assets/image-7582d937-3a26-4774-957b-222e46c6d149.png` |
| Files (CloudNest) | `.cursor/projects/Users-jabbo-PLANEVO/assets/image-a893f2aa-6474-4895-8bf3-5b95f0bbd457.png` |

---

*Design spec v1.0 · July 19, 2026 · Pairs with plan `2026-07-19-ecosystem-phase-3-calendar-files.md`*
