# Planevo — Functional Feature Specification

**Version:** 2.0 · **Date:** July 17, 2026  
**Companion to:** `planevo-prd.md` (strategy) and `planevo-founders-handbook.pdf` (founder reference)  
**Status:** Build-ready. **Supersedes feature spec v1.0 (kernel-first model).**

---

## How to read this document

The strategic PRD answers *why Planevo exists and what it's for*. This document answers *what exactly gets built*. Every feature below is written in four parts:

- **What it is** — the one-paragraph definition.
- **Behavior** — exactly what the user sees and does, including edge cases and empty states.
- **How it works** — the technical mechanism: tables touched, code path, AI involvement (if any), cost.
- **V1 boundary / later** — what ships at launch vs. what the feature grows into.

Feature IDs (`F-01`, `F-02`…) are stable references. Use them in Linear issues, commit messages, and AI prompts.

**The universal rule:** anything the AI can do, a human can do by hand. If a feature only exists in an AI form, it's a bug in this spec.

**v2 architecture rule:** Tasks, Calendar, and Files are **products with their own tables**. They are not workspace databases. Workspace is the Notion-style block canvas with **workspace-scoped custom databases**. Features connect through the **Ecosystem Link Layer (F-02)** — not a shared kernel.

### v1 → v2 ID map (deprecated IDs)

| v1 ID | v1 meaning | v2 status |
|---|---|---|
| F-08 | Four kernel "faces" | **Retired** — split into F-03, F-04, F-05, F-06 |
| F-03 | Universal databases | **Narrowed** → F-07 Workspace Databases only |
| Kernel Parts I | Universal kernel | **Retired** as product path — workspace DB subset remains F-07–F-11 |

---

# PART I — ECOSYSTEM FOUNDATION

---

## F-01 · Workspace Context

**What it is**
The organizational context a user works inside — School, Work, Personal. A user owns one or more workspaces. Each workspace holds **pages, embeds, and custom databases** — not canonical copies of Tasks, Calendar, or Files.

**Behavior**
- On first signup, one workspace is created from the onboarding routing answer ("Anthony's School Workspace").
- Workspace switcher in the sidebar header: create, rename (inline), delete (type name to confirm), switch. Double-click to manage.
- Switching workspace updates: page tree, workspace-scoped databases, filter context for products, toast target for linking, embed destination. **Does not duplicate or move Tasks/Calendar/Files data.**
- Deleting a workspace removes its pages, workspace databases, and `workspace_links` — **not** global tasks, events, or files (only associations).

**How it works**
- Table: `workspaces (id, owner_id, name, icon, settings_json, created_at)`.
- `settings_json` holds workspace UI prefs only — **not** product canonical pointers (`default_task_database_id` is deprecated).
- Active workspace stored in cookie / `user_preferences.active_workspace_id`.
- RLS: `owner_id = auth.uid()` on workspaces.

**V1 boundary / later**
V1: single-owner. Later: members, roles, shared workspaces.

---

## F-02 · Ecosystem Link Layer  ★ ARCHITECTURE

**What it is**
The Handoff layer. Separate products connect through explicit links and live embed references — never by sharing one database engine.

**Behavior**

**Workspace linking**
- When user creates a task/event/file while a workspace is active, **no auto-link**. Optional toast: `Add to [School]?` with **Add** / **Dismiss**.
- **Add** → creates `workspace_link` + live embed block on current workspace page (if on a page) or workspace home.
- Manual: **Add to workspace** on any task/event/file → picker for workspace → same result.

**Live embed blocks**
- BlockNote block types: `task_embed`, `task_board_embed`, `calendar_embed`, `calendar_strip_embed`, `file_embed`, `file_list_embed`.
- Embeds render live data from product tables. Edit task on embed → updates Tasks product. Delete source → embed shows graceful stale state with unlink option.

**Cross-feature links**
- Task ↔ Calendar: see F-03, F-04.
- File ↔ Task/Event: see F-05.
- All cross-links visible in native UI (buttons) — no drag-required.

**Filter: All ↔ This workspace**
- Each product sidebar route has a toggle. **This workspace** = items with `workspace_links` row for active workspace.
- Preference cached client-side: `planevo.tasks.scope`, `planevo.calendar.scope`, `planevo.files.scope` = `all` | `workspace`. **Never written to product rows.**

**How it works**
```sql
workspace_links (
  id, workspace_id, resource_type, resource_id,
  created_by, created_at,
  UNIQUE(workspace_id, resource_type, resource_id)
)
```
- `resource_type`: `task` | `calendar_event` | `file`
- Queries: product list + optional `INNER JOIN workspace_links WHERE workspace_id = $active`
- Embed blocks store `{ resourceType, resourceId, embedVariant }` in `pages.content_json`.
- **Products never JOIN `databases`/`records` for cross-feature behavior.**

**V1 boundary / later**
V1: workspace links, three embed types, three cross-feature button pairs. Later: bi-directional backlink panel; smart link suggestions (F-18).

---

# PART II — THE THREE PRODUCTS

---

## F-03 · Tasks

**What it is**
The task app. Board-first, zero configuration, global scope. A real task system — not a workspace database wearing a mask.

**Behavior**

**Views**
- **Board** (default): columns by status (Not started / In progress / Done — renameable). Lumis-craft cards: title, priority badge, due date, subtask progress, assignee avatars, file count.
- **List**: dense rows, groupable by status or priority.
- **Table**: spreadsheet-style with sort/filter.

**Task card actions**
- Inline edit title, status drag, priority, due date.
- **Schedule** → creates/links calendar block (F-04) without leaving Tasks.
- **Attach file** → picker from Files (F-05).
- **Add to workspace** → F-02 flow.

**Creation**
- `+` / `N` / quick capture (F-15) → new row in `tasks`. Global. Toast offers workspace link if context active.

**Filter toggle**
- **All** | **This workspace** — client-cached (F-02).

**Empty state**
- Illustration + `Add your first task` + import hint. No "create task database."

**How it works**
```sql
tasks (id, user_id, title, status, priority, due_at, description_json,
       position, completed_at, created_at, updated_at)
task_subtasks (id, task_id, title, is_done, position)
```
- `status`: `not_started` | `in_progress` | `done` | `cancelled` (app enum, not Postgres ENUM)
- `priority`: `low` | `medium` | `high` | null
- RLS: `user_id = auth.uid()`
- Route: `/tasks` — dedicated React feature module, **not** `DatabaseFace`
- Due dates → Calendar auto-feed via read query (F-04), not duplicate storage

**V1 boundary / later**
V1: board/list/table, subtasks, priorities, statuses, due dates, cross-links. Later: custom fields (careful — may remain product-level, not workspace kernel); recurring tasks; assignments (needs collaboration).

---

## F-04 · Calendar

**What it is**
The calendar app. Main Calendar is a writable unified view; every named or
connected calendar also has a strictly isolated route.

**Behavior**

**Layout (V1)**
- Main and named calendars share Day / Week / Month. Year is Main-only.
- A toolbar selector contains Main, owned and connected calendars, Main
  visibility controls, creation, and management. Calendar identity does not
  live in the Agenda sidebar.
- Event blocks use a dedicated named spectrum or a validated custom color.
- Main includes calendars according to `is_included_in_main`; isolated routes
  ignore that preference.

**Calendar ↔ Tasks (founder decision — all three)**
1. **Assign:** every Agenda task belongs to one calendar while remaining
   unscheduled.
2. **Drag:** drag a task from Agenda onto the grid → creates or updates the
   canonical task-linked event.
3. **Native buttons:**
   - On task: **Schedule** → time picker → event linked to task.
   - On event: **Link task** / **Create task** → picker or inline create.

**Event creation**
- Click grid → new event. Global. Toast offers workspace link (F-02).
- Main-created events belong to Main; isolated creation targets that calendar.
- Outside Calendar, the user-selected default writable calendar is used.
- Each calendar chooses inherited-with-overrides or required-per-event color.
- **Add to Workspace** creates an explicit page containing a live calendar
  embed; it never copies event data.

**Google Calendar**
- Connected Google/ICS events remain isolated, recolorable, hideable, and
  read-only. Disconnecting purges the local mirror.

**Filter toggle**
- **All** | **This workspace** (F-02).

**How it works**
```sql
calendars (
  id, user_id, name, color, color_mode, is_main,
  is_included_in_main, is_default, deleted_at, purge_after, position
)
calendar_events (
  id, calendar_id, user_id, title, starts_at, ends_at, all_day,
  location, description_json, task_id REFERENCES tasks(id),
  google_event_id, source, created_at, updated_at
)
task_calendar_assignments (task_id, calendar_id, user_id, created_at, updated_at)
```
- RLS: `user_id = auth.uid()` on events; calendars via user_id
- Routes: `/calendar` for Main; `/calendar/c/[calendarId]` for isolation
- Unscheduled due dates stay in Agenda and never become grid chips
- Workspace embeds store `{ targetKind, calendarId, view, height }`
- Native deletion uses 30-day Trash; tasks survive calendar deletion

**V1 boundary / later**
V1: Day / Week / Month, Main Year, multi-calendar isolation, recurrence,
task scheduling, Google/ICS read sync, live Workspace editing, and calendar
Trash. Later: push edits to external providers.

---

## F-05 · Files

**What it is**
The file cabinet. Upload and it's organized — searchable, taggable, linkable. Every file is an AI source automatically.

**Behavior**

**UI (V1)**
- Untitled UI / CloudNest craft: greeting row, upload/drop zone, folder chips, filter tabs (All / Documents / PDFs / Images), searchable table (name, size, modified, shared-by placeholder for later), storage meter.
- **Upload or drop** → file appears in table immediately with processing status.
- Tags: inline add/remove on file row.
- Preview: PDF, image, text in side panel or full view.

**Cross-feature (full symmetry — founder decision)**
- On file: **Attach to task**, **Link to event**.
- On task: **Add file** (F-03).
- On event: **Attach file**.
- Workspace toast on upload (F-02).

**AI source**
- On upload → `source_chunks` ingestion (existing pipeline). No "add to knowledge base" step.

**Filter toggle**
- **All** | **This workspace** (F-02).

**How it works**
- Elevate `file_sources` — add `user_id` as primary owner; `workspace_id` deprecated on product path (use `workspace_links` instead).
```sql
file_links (id, file_source_id, target_type, target_id, created_at)
-- target_type: task | calendar_event
```
- Storage: Supabase Storage bucket `user-files` or existing `workspace-files` migrated to user-scoped paths.
- Route: `/files` — `FilesView` product module, **not** `DatabaseFace`
- Search: `file_sources` + full-text on name/tags; AI retrieval via `source_chunks`

**V1 boundary / later**
V1: upload, table, tags, preview, cross-links, AI ingestion. Later: folders/collections UI; OCR; Drive sync (F-32).

---

# PART III — WORKSPACE (NOTION CLONE)

---

## F-06 · Pages & the Block Editor

**What it is**
The Notion-style canvas inside a workspace. Everything is a block — text, headings, databases, ecosystem embeds.

**Behavior**
- Same as v1 F-02 with these changes:
- `/` menu adds: **Task embed**, **Task board**, **Calendar**, **File**, **File list** (F-02 embeds) in addition to Database, page, etc.
- Pages do **not** host canonical Tasks/Calendar/Files data — only embeds and links.
- Describe-to-build generates **pages and workspace databases** — not Tasks product schema.
- Workspace route: `/workspace` for directory; `/pages/[id]` for editor. **No auto-redirect to last page.**

**How it works**
- `pages` table unchanged. BlockNote `content_json`.
- Embed blocks reference F-02 resource IDs.
- Retroactive structure (F-12) promotes blocks → **workspace database records** only.

**V1 boundary / later**
As v1 F-02. Later: collaboration, comments, history.

---

## F-07 · Workspace Databases

**What it is**
Custom databases **inside Workspace only** — Projects, CRM, Reading list. The Notion builder path. **Not** the Tasks/Calendar/Files products.

**Behavior**
- Create via `/database` or sidebar. Templates: **Project**, **Notes**, **Blank** — **not** Task/Calendar/Files (those are products).
- Inline or full-page. Born-with-views (F-13).
- Can relate to other workspace databases. **Cannot** replace the Tasks product.

**How it works**
- `databases` table with `workspace_id` required. `template_type`: `project | notes | custom` — **`task | calendar | files` deprecated.**
- Same transaction pattern as v1 F-03 for workspace templates only.

**V1 boundary / later**
As v1. Later: marketplace templates.

---

## F-08 · Properties (workspace databases)

**What it is**
The eight property types for **workspace databases only**. Unchanged from v1 F-04.

**Behavior / How it works / V1 boundary**
Identical to v1 F-04. Does not apply to `tasks`, `calendar_events`, or `file_sources` product tables.

---

## F-09 · Views (workspace databases)

**What it is**
Table, board, calendar, list views over **workspace database records** only.

**Behavior / How it works / V1 boundary**
Identical to v1 F-05, scoped to workspace databases. Calendar **product** has its own UI (F-04) — this is not that.

---

## F-10 · Records & the Record Page (workspace databases)

**What it is**
Items in workspace databases. Expandable to record page with block editor.

**Behavior / How it works / V1 boundary**
Identical to v1 F-06.

---

## F-11 · Relations (workspace databases)

**What it is**
Links between workspace database records.

**Behavior / How it works / V1 boundary**
Identical to v1 F-07. Cross-feature links (task ↔ file) use F-02 / product tables — not `relations`.

---

# PART IV — EASE MECHANICS

*Scoped: workspace content and product capture. Not "kernel ease" — ecosystem ease.*

---

## F-12 · Retroactive Structure  ★ WORKSPACE FLAGSHIP

**What it is**
Write freely in workspace pages; promote writing into workspace database records afterward.

**Behavior / How it works**
As v1 F-10, but:
- Target is **workspace databases only** — never promotes into `tasks` table (use quick capture F-15 for tasks).
- "Turn into records" panel lists workspace databases + **+ New workspace database**.

**V1 boundary / later**
As v1 F-10.

---

## F-13 · Born-With-Views

**What it is**
No workspace database is born bare. Products ship pre-configured separately.

**Behavior**
- **Workspace Project DB:** Name, Status, Owner, Timeline, Tasks relation (to workspace DB or note "link tasks via F-02"), Board + Table views.
- **Workspace Notes DB:** Name, Tags, Created, List + Table.
- **Tasks product:** statuses and views in UI code — not template database.
- **Calendar product:** protected Main Calendar on signup.
- **Files product:** empty library with filters ready.

**How it works**
- `packages/core/src/defaults/workspace-database-templates.ts` (rename from database-templates; drop task/calendar/files templates)
- `packages/core/src/defaults/product-defaults.ts` — signup seed for tasks/calendars

**V1 boundary / later**
As v1 F-11.

---

## F-14 · Duplicate-and-Strip

**What it is**
Duplicate workspace databases and pages as clean templates.

**Behavior / How it works**
As v1 F-12. Applies to workspace databases and pages only.

---

## F-15 · Natural-Language Quick Capture

**What it is**
Global quick-add → **Tasks product** (`tasks` table).

**Behavior**
- `Cmd+K` or sidebar `+` → capture input.
- Parser extracts date, time, priority, `#workspace` hint for **toast** (not auto-link).
- Creates `tasks` row. Offers workspace link toast if active context.

**How it works**
- `packages/core/src/parsing/natural-capture.ts` → inserts into `tasks`, not `records`.
- **Cost: $0.**

**V1 boundary / later**
As v1 F-13.

---

## F-16 · Typed Import

**What it is**
Imports land organized into workspace pages, workspace databases, and optionally Tasks/Files products.

**Behavior**
- Notion export → pages + workspace DBs; task CSV may map to `tasks` table with preview.
- Files in export → `file_sources`.

**How it works**
As v1 F-14 with product table targets where appropriate.

**V1 boundary / later**
As v1 F-14.

---

## F-17 · Structure Detection

**What it is**
Quiet suggestions to convert repeated **workspace pages** into workspace databases.

**Behavior / How it works**
As v1 F-15. Workspace-scoped only.

---

## F-18 · Cross-Link Suggestions

**What it is**
Replaces kernel autolinking (v1 F-16) for ecosystem model.

**Behavior**
- Typing a task title in a workspace page → suggest **Link to task**.
- `@` menu searches: tasks, events, files, pages, workspace records.
- File name mention → suggest attach.

**How it works**
- Client index across product titles + page titles. No LLM.
- Accept → F-02 link or embed block.

**V1 boundary / later**
V1: @ picker + basic suggestions. Later: backlinks panel.

---

## F-19 · "Is-A" Object Types  ⚠ AT RISK

**What it is**
As v1 F-17. **Higher drop risk in v2** — products are separate; `#task` routing is harder.

**V1 boundary / later**
Build after Tier 2 or drop. F-15 + F-12 cover most value.

---

# PART V — PLANEVO AI

*Updated scope: retrieves across tasks, events, files, workspace pages — not "workspace kernel dump."*

---

## F-20 · The Chat Surface

**What it is**
Full chat workspace — optional, never the front door.

**Behavior**
- Context chip shows scope: `Tasks · 3 files · This workspace` — assembled from product APIs.
- Empty state: `Ask about anything in your workspace.` — no prompt gallery.

**How it works**
- Context load: parallel queries to `tasks`, `calendar_events`, `file_sources`/`source_chunks`, `pages` — RLS-scoped by user.
- Unchanged streaming/tool architecture from v1 F-20.

**V1 boundary / later**
As v1 F-20.

---

## F-21 · Multi-Model Routing & the Gateway

Identical to v1 F-21.

---

## F-22 · Describe-to-Build

**What it is**
Generate **workspace pages and workspace databases** from description — preview before commit.

**Behavior**
- `track my freelance clients` → preview workspace database spec.
- Does **not** replace Tasks product. May offer: `Also create a task list?` as separate optional step → F-03.

**How it works**
- Output validated against workspace database schema (F-07). Create uses workspace `createDatabase()` path.

**V1 boundary / later**
As v1 F-22, scoped to workspace.

---

## F-23 · Grounded Q&A with Citations

**What it is**
Answers from tasks, events, files, and workspace pages with block-level citations.

**How it works**
- Retrieval: `source_chunks`, `pages.content_json`, `tasks.description_json`, event descriptions.
- As v1 F-23 otherwise.

**V1 boundary / later**
As v1 F-23.

---

## F-24 · Files as Sources

**What it is**
Every `file_sources` upload is automatically an AI source.

**Behavior / How it works**
As v1 F-24. Files product (F-05) is the upload path — no Documents database.

---

## F-25 · Artifact Generation

As v1 F-25. Saved artifacts are **workspace pages**.

---

## F-26 · Workspace Operations via Chat

**What it is**
AI creates/edits tasks, events, files, workspace pages/DBs through product APIs.

**Behavior**
- `add a task for physics friday` → `tasks` insert (Tier 1).
- `create a Projects database` → workspace DB (Tier 2).

**How it works**
- Tools in `packages/core/src/agent/tools.ts` call **product mutations** and **workspace mutations** — never `template_type` face resolution.

**V1 boundary / later**
As v1 F-26.

---

## F-27 · The Credit System

Identical to v1 F-27.

---

## F-28 · The Safety Tier Model

Identical to v1 F-28.

---

## F-29 · The Audit Log

Identical to v1 F-29.

---

# PART VI — AGENTS

---

## F-30 · The Agent Builder

**What it is**
Four-step agent builder open to every user.

**Behavior**
- **Knowledge scope** checkboxes: workspace pages, workspace databases, **Tasks**, **Calendar**, **Files**, integrations.
- Agents call product APIs — not kernel face queries.

**How it works**
As v1 F-30 with updated `knowledge_scope_json` shape:
```json
{ "pages": [], "databases": [], "tasks": true, "calendar": true, "files": true, "integrations": [] }
```

**V1 boundary / later**
As v1 F-30.

---

## F-31 · First-Party Agent Library

**Daily Digest** — reads `tasks` (due/overdue), `calendar_events` (today), optional Gmail.  
**Weekly Review** — tasks completed vs planned; creates workspace Review page.  
**Workspace Cleanup** — workspace pages and DBs only; propose-only.

As v1 F-31 otherwise.

---

## F-32 · Integrations (Composio)

**What it is**
Four integrations feeding **product tables**.

**Behavior**
- **Google Calendar** → `calendar_events` (not records).
- **Google Drive** → `file_sources`.
- **Gmail** → digest agent → `tasks` or workspace pages.
- **Canvas** → `tasks` with assignment metadata.

**How it works**
- As v1 F-32. **Remove:** "feeds the same kernel."

**V1 boundary / later**
As v1 F-32.

---

# PART VII — ONBOARDING & SURFACES

---

## F-45 · The Onboarding Fusion (ecosystem v2)

**What it is**
One routing question → living workspace + global products ready.

**Behavior**
1. **Routing question:** Work / Personal / School / Something else.
2. **Signup creates:**
   - One workspace with Getting Started page (checklist blocks, embeds).
   - Global Tasks (empty board, statuses configured).
   - Global default calendar.
   - Global Files (empty library).
   - **No** task/calendar/files template databases.
3. **Starter tasks** in **Tasks product** (not workspace DB): Rename workspace → Add real task → Drag to Done → Connect Google Calendar → Import.
4. Getting Started **embeds** link to live task board filter.

**How it works**
- `packages/core/src/defaults/starter-workspaces.ts` — pages + checklist content only.
- `packages/core/src/defaults/product-defaults.ts` — seed statuses, starter task rows in `tasks`.
- `create_starter_workspace` RPC rewritten: pages only + product seed function separate.

**V1 boundary / later**
As v1 F-45.

---

## F-46 · Command Bar

**What it is**
`Cmd+K` — search tasks, events, files, pages, workspace records; quick capture; commands.

**Behavior**
- Fuzzy index across **product titles** + page titles + workspace record primaries.
- NL capture → F-15 → `tasks`.

**How it works**
As v1 F-46 with multi-product index.

---

## F-47 · Home  ⚑ FOUNDER OVERRIDE 2026-07-16

**What it is**
Calm launch hub. Acme AI layout for Home only.

**Behavior**
- Action cards route to `/tasks`, `/calendar`, `/files`, `/workspace` — real products.
- Composer → quick capture, search, or AI thread.
- **No** database face links.

**How it works**
- Queries: `tasks` (due today), recent `pages`, recent `file_sources` — not face-databases.

---

## F-48 · Minimal Mode & Settings

Identical to v1 F-48. Settings adds **product scope defaults** (optional): default filter All/Workspace per product in UI prefs (client-synced).

---

## F-49 · Export

**What it is**
Full export: workspace pages + workspace DBs + **tasks + calendar events + files**.

**Behavior**
- `.zip`: Markdown pages, JSON workspace databases, `tasks.json`, `calendar.json`, `files/` binary + manifest.
- Re-importable (F-16).

**How it works**
- Inngest job. Product tables included alongside workspace tables.

---

# PART VIII — DEPRECATED & MIGRATION

## DEP-01 · Kernel Face Routes (remove after strangler)

| Route | Deprecated implementation | Replacement |
|---|---|---|
| `/tasks` | `DatabaseFace` + `getTaskFaceBundle` | F-03 Tasks module |
| `/calendar` | `DatabaseFace` + `getCalendarFaceBundle` | F-04 Calendar module |
| `/files` | `DatabaseFace` + `getFilesFaceBundle` | F-05 Files module |

## DEP-02 · Template databases for products

- `create_database_from_template('task'|'calendar'|'files')` for product purposes — **deprecated**.
- `workspaces.settings_json.default_*_database_id` — **deprecated**.

## DEP-03 · `get_workspace_calendar_records` RPC

- Replaced by Calendar product queries merging `calendar_events` + task due dates.

---

# PART IX — WHAT IS NOT BEING BUILT

As v1 Part VII, plus:

- **Universal kernel** as the implementation of Tasks/Calendar/Files
- **DatabaseFace** as final product UI
- **Per-workspace duplicate** task boards as canonical
- **Auto workspace-linking** on create without user tap
- **Storing view filter preference** on task/event/file rows

**Permanent rules:** unchanged from v1.

---

# APPENDIX — Feature Index by Phase (v2)

| Phase | Features |
|---|---|
| **P0 Foundation** | F-01, F-49 wiring, tokens, landing |
| **P1 Ecosystem foundation** | F-02, product schema migrations, F-45 seed rewrite, DEP flags |
| **P2 Tasks product** | **F-03**, F-15, cross-link buttons to F-04/F-05 |
| **★ Dogfood Gate** | Founder daily on Tasks + Calendar |
| **P3 Calendar + Files** | **F-04**, **F-05**, F-24 upload half |
| **P4 Workspace composition** | F-06 embeds, F-02 toast, F-07–F-11, F-12–F-14 |
| **P5 Planevo AI** | F-20–F-29, F-46 |
| **P6 Agents + Integrations** | F-30–F-32 |
| **P7 Import + polish** | F-16, F-45 polish, F-23–F-25, F-17–F-18, F-47–F-48 |
| **P8 Launch** | Stripe, beta, PH |
| **Cleanup** | DEP-01–DEP-03 removal |
| **At risk** | F-19 |

---

*Planevo Functional Feature Specification v2.0 · July 17, 2026*  
*Companion: `planevo-prd.md` · Supersedes v1.0*
