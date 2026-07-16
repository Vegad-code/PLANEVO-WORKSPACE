# Planevo — Functional Feature Specification

**Version:** 1.0 · **Date:** July 15, 2026 · **Companion to:** `planevo-prd.md` (strategy) and `planevo-founders-handbook.pdf` (founder reference)
**Status:** Build-ready. This document defines WHAT each feature is, HOW it behaves, HOW it works technically, and WHAT it becomes later.

---

## How to read this document

The strategic PRD answers *why Planevo exists and what it's for*. This document answers *what exactly gets built*. Every feature below is written in four parts:

- **What it is** — the one-paragraph definition.
- **Behavior** — exactly what the user sees and does, including edge cases and empty states.
- **How it works** — the technical mechanism: tables touched, code path, AI involvement (if any), cost.
- **V1 boundary / later** — what ships at launch vs. what the feature grows into.

Feature IDs (`F-01`, `F-02`…) are stable references. Use them in Linear issues, commit messages, and AI prompts.

**The universal rule that governs every feature in this document:** anything the AI can do, a human can do by hand. If a feature below only exists in an AI form, it's a bug in this spec.

---

# PART I — THE KERNEL

The kernel is everything the product is made of. Every "app" Planevo appears to be is a rendering of this.

---

## F-01 · Workspace

**What it is**
The top-level container. One user owns one or more workspaces; all pages, databases, records, agents, and files live inside exactly one. In V1, single-player only — no invitations, no sharing, no permissions beyond "you own it."

**Behavior**
- On first signup, exactly one workspace is created automatically, named from the onboarding routing question ("Anthony's School Workspace") — the user never sees a "create your first workspace" screen.
- Workspace has: name, icon (emoji or uploaded image), and a members list that in V1 contains one person.
- The user can rename it inline (click the name in the sidebar header → editable text field, saves on blur/Enter). Renaming is deliberately the first starter task (F-45).
- The user can create additional workspaces from a workspace switcher in the sidebar header. Switching swaps the entire sidebar and content area.
- Deleting a workspace requires typing its name to confirm — it cascades to everything inside it. Not reversible in V1 (no trash for workspaces).

**How it works**
- Table: `workspaces (id, owner_id, name, icon, created_at)`.
- Every other table carries `workspace_id` (directly or via parent chain) and an RLS policy that checks it against `auth.uid()`. This is enforced at the database, not in application code — a query for someone else's workspace returns zero rows even if the app has a bug.
- Workspace switching is a client-side route change (`/w/[workspace_id]/...`) plus a fresh scoped query; no page reload.

**V1 boundary / later**
V1: single-owner. Later (Wave 3): members, roles, per-object permissions, presence, invite flow — a distinct architecture project, never bolted onto this table casually.

---

## F-02 · Pages & the Block Editor

**What it is**
The canvas. A page is a document made of blocks (paragraphs, headings, lists, toggles, images, embeds, and — critically — embedded databases). Pages nest infinitely, forming the sidebar tree.

**Behavior**
- Creating a page: `+` in the sidebar, or `/page` inside another page, or Cmd+N. New pages open immediately with the cursor in the title field — no dialog, no template picker interrupting the flow.
- Typing `/` opens the block menu: Text, Heading 1–3, Bulleted list, Numbered list, To-do checkbox, Toggle, Quote, Divider, Code, Image, File, Table, **Database**, **Embed existing database**.
- Every block has a drag handle (⠿) on hover: click to select, drag to reorder, right-click for block actions (Duplicate, Delete, Turn into, Copy link to block, **Turn into records** — see F-10).
- Markdown shortcuts work while typing: `#` + space → H1, `-` + space → bullet, `[]` + space → checkbox, `>` + space → toggle.
- Text selection raises a floating toolbar: bold, italic, underline, strikethrough, code, link, color, **Turn into records**.
- Pages have: title, icon, optional cover image. All optional; a page with only a title is valid.
- Empty page state: no illustration, no tips banner, no "get started" card. Just a cursor and a faint `Type '/' for commands` placeholder that vanishes on keystroke. The empty page is not a teaching moment; it's a page.
- Autosave: no save button. Changes persist ~500ms after typing stops, with a subtle "Saved" indicator in the header that fades.

**How it works**
- Library: **BlockNote** (built on ProseMirror). Its JSON document format is stored verbatim in `pages.content_json` (JSONB).
- Table: `pages (id, workspace_id, parent_page_id, title, icon, content_json, database_id, position, is_archived, created_at, updated_at)`.
- `parent_page_id` is a nullable self-reference — that's the whole tree. `position` is a fractional index (not an integer) so reordering one page never rewrites its siblings.
- Sidebar drag-and-drop: **dnd-kit**. Dropping page A onto page B sets `A.parent_page_id = B.id` and computes a new fractional `position`.
- Saving: debounced PATCH to `packages/api`, which writes `content_json` and bumps `updated_at`. Optimistic local state; on failure, Sentry captures it and the indicator shows "Retrying."
- Block IDs inside `content_json` are stable UUIDs generated by BlockNote — this matters enormously for F-10 (retroactive structure), which needs to point at a specific block and know it later.

**V1 boundary / later**
V1: everything above, single-player. Later: real-time collaborative editing (Yjs + Supabase Realtime — architecture already studied, deliberately deferred), comments, page history/versioning, backlinks panel.

---

## F-03 · Databases

**What it is**
The structure. A database is a typed collection of records — the single primitive that expresses tasks, notes, projects, files, contacts, habits, and anything else. There are no special-purpose data types in Planevo; there are databases with different property sets.

**Behavior**
- Creating a database: `/database` in any page, or `+ New database` in the sidebar. The user picks a starting type: **Task**, **Notes**, **Project**, **Files**, or **Blank**.
- The database appears inline in the page, immediately populated with its default properties, default views, and *sensible empty state* — never a bare one-column table (see F-11, born-with-views).
- Database header shows: icon, name (editable inline), view tabs (F-05), `+ New` button, search, filter, sort, and a `…` menu (Duplicate, **Duplicate as template**, Export, Delete, Open as full page).
- A database can live inline in a page or as a full page of its own. Same object, two renderings — `Open as full page` promotes it.
- Deleting a database asks for confirmation and states the record count ("Delete Projects and its 24 records?").

**How it works**
- Tables: `databases (id, workspace_id, page_id, name, icon, template_type, created_at)`.
- `template_type` is one of `task | notes | project | files | custom` — it drives which defaults get instantiated at creation and nothing else. It is *not* a behavior switch; a Task database is a database whose properties happen to describe tasks. This is what keeps the kernel from splintering into special cases.
- Creating a database is a single transaction: insert `databases` row → insert N `database_properties` rows → insert M `views` rows → optionally insert seed `records`. All defaults live in one config file (`packages/core/src/defaults/database-templates.ts`), which is what makes F-11 pure code with zero AI cost.

**V1 boundary / later**
V1: as described. Later: database-level permissions, locked schemas, database templates published to a marketplace.

---

## F-04 · Properties (the 8 types)

**What it is**
Properties are the questions every record in a database answers. V1 ships exactly eight types. Formula and rollup are deliberately absent from V1 and deliberately *reserved* in the type system.

**Behavior**

| Type | What it does | Editing UI | Config options |
|---|---|---|---|
| **Text** | Free text, single or multi-line | Inline text input, expands on focus | none |
| **Number** | Numeric value | Inline numeric input | format: plain / currency / percent; decimal places |
| **Select** | One option from a defined set | Dropdown with colored pills; type to create new option inline | option list (name + color), default value |
| **Multi-select** | Zero-to-many options | Multi-pill picker; type to create inline | option list (name + color) |
| **Date** | Date, optionally with time, optionally a range | Calendar popover; typed input accepts "friday", "tmrw 6pm" | include time y/n; date range y/n; format |
| **Checkbox** | Boolean | Direct-click checkbox in cell | none |
| **Relation** | Link to record(s) in another database | Search-and-pick popover across the target database | target database; allow multiple y/n |
| **Person** | A workspace member | Avatar picker | allow multiple y/n |

- Adding a property: `+` at the right edge of the table header → name field + type picker → created immediately with no modal ceremony.
- Changing a property's type: allowed, with a warning if data will be coerced or lost ("Text → Number: 3 values can't be converted and will be cleared"). Conversion happens in a transaction; failures roll back entirely.
- Reordering properties: drag column headers. Hiding: per-view toggle (the property still exists, this view just doesn't show it).
- Every database has exactly one **primary property** (`is_primary = true`, always Text) — it's the record's title, it can't be deleted, and it's what shows on board cards and in relation pickers.
- Deleting a property: confirmation stating how many records have values in it.

**How it works**
- Tables: `database_properties (id, database_id, name, type, config_json, position, is_primary, created_at)` and `record_values (id, record_id, property_id, value_json)` with `UNIQUE(record_id, property_id)`.
- **`type` is a plain TEXT column, never a Postgres ENUM.** This is Schema Law 1. Adding `formula` and `rollup` later must be a code-only change with zero migration. The TypeScript union in `packages/core` reserves those names *today* as `// not yet implemented` so nobody invents a conflicting name later.
- Values are stored as JSONB (`value_json`), which means one storage path for all eight types. Validation is application-level, in `packages/core/src/validation/property-value.ts`, and is shared identically by the UI, the API, and every agent tool — an agent physically cannot write a value shape the UI would reject, because it's the same function.
- `config_json` shapes are reserved now for the future: formula = `{expression, return_type}`, rollup = `{relation_property_id, target_property_id, aggregation}`. Reserved, documented, not built.

**V1 boundary / later**
V1: eight types. **Fast-follow Wave 1:** formula, rollup. Later: file/media property, URL, email, phone, created/edited-time, auto-number, button.

---

## F-05 · Views

**What it is**
Views are lenses over the same records. Four ship in V1: table, board, calendar, list. Changing data in one view changes it everywhere, because there is only one set of records — views are pure presentation config.

**Behavior**

**Table view** — the spreadsheet. Rows are records, columns are properties. Column resize (persisted), reorder, hide/show. Click any cell to edit in place. Click the row's expand icon to open the record as a page (F-06). `+ New` appends a row inline with the cursor in the primary field.

**Board view** — kanban. Cards grouped by a Select or Person property (configurable; defaults to Status for task databases). Drag a card between columns → writes the new value to that property. Columns respect the Select option order and colors. Empty columns still render (an empty "Done" column is information). Collapse columns. `+` at the top of each column creates a record pre-set to that column's value.

**Calendar view** — month grid (V1's only layout). Records with a Date property render on their date. Drag a record to another day → writes the new date. Click an empty day → creates a record with that date pre-filled. Multi-day ranges render as spans. Records with no date simply don't appear (no "unscheduled" tray in V1).

**List view** — dense, minimal rows. Primary property plus up to three chosen properties inline. Best for notes and reading. Groupable by any Select property.

**Universal to all views:**
- **Filters:** stackable conditions (`Status is not Done` AND `Due date is before next week`). Filter chips show in the toolbar; clicking one edits it. Each filter has a type-appropriate operator set.
- **Sorts:** multi-level, drag-reorderable (`Priority descending, then Due date ascending`).
- **Search:** filters the current view by primary-property text as you type.
- **View tabs:** every database has tabs across the top. `+` adds a view; each view has a `…` menu (Rename, Duplicate, Change type, Set as default, Delete).
- View config is per-view and persistent — a filter applied to "My Week" never touches "All Tasks."

**How it works**
- Table: `views (id, database_id, type, name, config_json, position, is_default)`.
- `config_json` holds `{filters: [], sorts: [], group_by_property_id, visible_properties: [], column_widths: {}, calendar_date_property_id}`.
- Filters compile to parameterized Supabase queries — never string-concatenated SQL. Since values live in `record_values` (EAV), filtering on a property is a join against `record_values` with a JSONB predicate; the `(record_id, property_id)` unique index carries this.
- Drag-to-change (board column, calendar date) is a single `record_values` upsert. Optimistic UI: the card moves instantly, reverts with a toast if the write fails.
- View switching is client-side only — the records are already loaded; a different component renders them.

**V1 boundary / later**
V1: table, board, calendar, list. **Fast-follow:** calendar week/day layouts and the visual skins (Sunsama-style / Google-style) that were explicitly cut from V1. Later: gallery view, timeline/Gantt, chart view, saved per-view "my" filters.

---

## F-06 · Records & the Record Page

**What it is**
A record is one item in a database. Every record is also a page — expanding it opens a full canvas where its properties sit above a block editor. This is what makes "a task" and "a document about that task" the same object.

**Behavior**
- Expanding a record (click the ⤢ icon on a row/card, or press Space with it selected) opens it in a side peek by default; a `⤢` in the peek promotes it to a full page.
- The record page shows: primary property as the title (large, editable), all properties in a stacked list beneath it (each editable inline, hidden-in-view properties still appear here), then a horizontal rule, then a full block editor.
- The block editor inside a record is the *same* editor as F-02 — same `/` menu, same blocks, same behavior. A task can contain headings, checklists, embedded databases, images.
- Multi-select: shift-click or drag-select rows in table view → a bulk action bar appears (Set property…, Delete, Duplicate, Move to…). **Every bulk action is Tier 2** — it confirms before executing, including when a human initiates it.
- Deleting a record: soft delete to trash, restorable for 30 days.

**How it works**
- Tables: `records (id, database_id, position, created_by, created_at, updated_at)` + `record_values` for the typed data + a `content_json` field on the record for its page body (same BlockNote format as F-02).
- The record page is not a separate component tree from the page editor — it's the page editor with a properties header slot. One editor, one set of bugs.

**V1 boundary / later**
V1: as described. Later: record comments, record history, per-record locking.

---

## F-07 · Relations

**What it is**
A link between a record in one database and a record in another (or the same). Relations are how a Task points at a Project, and a Project points at a Client.

**Behavior**
- Adding a relation property: pick the target database. Optionally allow multiple.
- Editing a relation cell: a popover with search across the target database's primary property, showing matches as you type, plus `+ Create "Q3 Launch" in Projects` at the bottom — so a missing target never blocks the flow.
- Related records render as pills showing the target's primary property; clicking a pill opens that record in a peek.
- Removing a relation removes the link only, never the target record.
- **V1 relations are one-directional.** Task → Project does *not* automatically create a Project → Tasks property. If the user wants the reverse view, they add a filtered view on Tasks. This is a deliberate cut, and it's honest: bidirectional sync means dual-write consistency and cascade rules, and that's a real project, not a checkbox.

**How it works**
- Table: `relations (id, source_record_id, source_property_id, target_record_id, created_at)`.
- **A dedicated join table, never a JSONB array of IDs.** This is Schema Law 2, and it is the single most important structural decision in the schema. Indexes: `(source_record_id, source_property_id)` for forward lookups and `(target_record_id)` for reverse lookups.
- The reverse index is what makes rollups cheap when Wave 1 arrives. If relations lived in a JSONB array, "sum the hours of all tasks linked to this project" would require scanning every record's JSONB in the workspace. With the join table, it's an indexed lookup. **This index is why the fast-follow is a feature and not a rewrite.**
- Deleting a record deletes its relation rows via `ON DELETE CASCADE`.

**V1 boundary / later**
V1: one-directional, indexed both ways. **Wave 1:** bidirectional sync + rollups (the schema is already ready). Later: relation-based filters ("tasks whose project is Active"), self-relations for hierarchies.

---

# PART II — THE FOUR FACES

These are the sidebar entry points. Each one *feels* native. Each one *is* the kernel. Nothing can desync, because there was never a second system.

---

## F-08 · Tasks / Calendar / Files / Workspace

**What it is**
Four sidebar destinations that make the kernel feel like four purpose-built apps.

**Behavior**

**Tasks** — opens the workspace's default Task database directly in board view. Statuses, priorities, and due dates work with zero configuration. It looks and feels like a task app. Everything a task app does (drag to done, filter to today, group by priority) works because those are database operations wearing a task app's clothes.

**Calendar** — renders **every date-carrying record in the entire workspace** in one calendar, plus Google Calendar events once connected (F-31). Tasks with due dates, project milestones, notes with dates: all of it, one grid, color-coded by source database. Creating an event here creates a record in a chosen database. **There is no sync problem because there are never two systems** — Planevo's calendar isn't mirroring your tasks, it's *showing* them.

**Files** — a Documents database. Uploads become records with properties (name, type, size, tags, related project). Searchable, taggable, relatable to any other record. **Every file automatically becomes an AI source** (F-24) the moment it lands — no "add to knowledge base" step, ever.

**Workspace** — the open canvas: the page tree, undisguised. Everything above lives here and can be rearranged freely.

**How it works**
- These are **routes, not tables**. `/tasks` resolves the workspace's default task database (`databases.template_type = 'task'`, oldest one, or the workspace's `default_task_database_id` setting) and renders the standard database component with `view = board`.
- `/calendar` is the calendar view component with a workspace-wide query: every `record_values` row whose `property_id` points at a Date-type property, joined to its record and database. Color by `database_id`.
- `/files` resolves the workspace's Files database; uploads go to Supabase Storage, and a record is created carrying the storage path.
- If a face's underlying database has been deleted, the route offers to recreate it in one click rather than 404ing.

**V1 boundary / later**
V1: as described, one calendar layout. Later: calendar skins, per-face customization, additional faces (Habits, Reading) as pure template + route additions.

---

# PART III — THE EIGHT EASE MECHANICS

Onboarding gets a user to their first workspace. These make the fiftieth as fast as the first. **This is the product's identity: structure is never homework.**

---

## F-10 · Retroactive Structure  ★ FLAGSHIP

**What it is**
The reason Planevo exists. Write freely first; turn writing into structure afterward. Select any text, bullets, or checkboxes and promote them into records — or into an entire new database — with the original writing preserved as the content.

**Behavior**
- User writes a meeting note with a bulleted list of follow-ups. They select the bullets. The floating toolbar shows **Turn into records**.
- Clicking it opens a small inline panel (not a modal — it appears in the flow, beneath the selection):
  - **Where:** a picker — an existing database (Tasks, Projects…) or **+ New database**.
  - **Preview:** the selected lines shown as rows, with detected properties as columns. If a bullet reads `Email Sarah about pricing — friday`, the preview shows `Name: Email Sarah about pricing` / `Due: Friday`. Detection is the same deterministic parser as F-13.
  - The user can edit the preview inline: rename a column, change a detected type, drop a column, fix a value.
  - **Confirm** → records created; the selected blocks in the page are replaced by an inline view of those records (a small linked table). The writing isn't destroyed — it became the records, and the page now shows them live.
- Reverse path: any inline database view can be `…` → **Turn back into text**, which flattens records back into bullets. Structure is reversible, which is what makes trying it safe.
- Single-block version: right-click any block → **Turn into record**.
- If the selection is heterogeneous (headings + paragraphs + bullets), the panel promotes only the list-like blocks and says so plainly: `4 of 7 selected blocks can become records.`

**How it works**
- **This is why block↔record architecture must exist before the editor is written.** The mechanism: each BlockNote block has a stable UUID. When a block is promoted, we create a `records` row and store the originating `block_id` on it. The blocks in `content_json` are replaced with a single `database_view` block referencing the new/target database with a filter scoped to those records.
- Property detection reuses `packages/core/src/parsing/natural-capture.ts` — the exact same deterministic parser as F-13. Zero LLM calls, zero marginal cost.
- New-database creation reuses the F-03 transaction and F-11 defaults, so a database born from retroactive structure arrives with views already on it.
- The whole operation is one transaction. If any part fails, the page is untouched.
- **Cost: $0.** This is the flagship feature and it uses no AI. That's not a compromise — a deterministic parser that always behaves the same way is *better* here than a model that's right 90% of the time.

**V1 boundary / later**
V1 (P2): text/bullets/checkboxes → records or a new database, reversible. Later: promote a table block into a database; promote across pages ("turn every checkbox in this section of the workspace into tasks"); a quiet suggestion when a page looks promotable (that's F-15, and it's deliberately last).

---

## F-11 · Born-With-Views

**What it is**
No database is ever born a bare table. Creating one yields a working, opinionated setup that the user *deletes from* rather than *builds up to*.

**Behavior**
- Creating a **Task** database gives you, immediately: properties `Name (text, primary)`, `Status (select: Not started / In progress / Done, colored)`, `Due (date)`, `Priority (select: Low / Medium / High)`; views `Board (grouped by Status, default)`, `List`, `Calendar (by Due)`; default sort Priority desc; the board's three columns visible even though they're empty.
- **Notes** database: `Name`, `Tags (multi-select)`, `Created (date)`; views `List (default, sorted by Created desc)`, `Table`.
- **Project** database: `Name`, `Status`, `Owner (person)`, `Timeline (date range)`, `Tasks (relation → Tasks)`; views `Board (by Status)`, `Table`, `Calendar`.
- **Files** database: `Name`, `Type (select)`, `Tags (multi-select)`, `Added (date)`, `Related (relation)`; views `Table (default)`, `List`.
- **Blank** database: `Name (text, primary)` + one Table view. Blank is a choice, not a punishment — but it's the *fifth* option, not the default.
- Everything is immediately editable. Deleting the Priority property takes two clicks. That's the point: **deleting is faster than building.**

**How it works**
- One file: `packages/core/src/defaults/database-templates.ts`, exporting a typed config per `template_type` describing properties, views, and seed records.
- `createDatabase(workspace_id, template_type)` reads that config and executes one transaction. Pure code. **Zero AI. Zero cost. Zero latency.**
- The same config powers F-45's starter workspaces, so a School workspace's task board is the Task template with renamed Select options — not a parallel code path.

**V1 boundary / later**
V1 (P2): four templates + blank. Later: user-defined defaults ("always give my task databases an Energy property"), team-shared defaults.

---

## F-12 · Duplicate-and-Strip

**What it is**
Your fourth project is the template for your fifth. Any database or page re-instantiates as a clean skeleton — same structure, no content.

**Behavior**
- Right-click any database in the sidebar or hit its `…` menu → two distinct items:
  - **Duplicate** — full copy including records.
  - **Duplicate as template** — copies properties, views, filters, sorts, colors, layout, and the page body's structure; **drops every record**. The copy opens named `Q4 Launch (copy)` with the name selected for immediate retyping.
- Same for pages: **Duplicate as template** keeps headings, callouts, embedded database *structure*, and layout, and clears the filled-in text.
- This is a first-class right-click action, not buried in a submenu. The whole feature is worthless if it's hard to find.

**How it works**
- `duplicateDatabase(id, {stripRecords: true})` in `packages/core`: deep-copies the `databases` row, all `database_properties` (with new IDs, preserving `config_json` including Select option colors), all `views` (rewriting property IDs inside `config_json` to the new IDs — this ID remapping is the entire technical difficulty of the feature), and skips `records` entirely.
- Page duplication walks `content_json`, assigns fresh block UUIDs, and clears text nodes while preserving block types and nesting.
- Pure code, one transaction, no AI.

**V1 boundary / later**
V1 (P2): databases and pages. Later: "save as my template" into a personal template shelf; publish to marketplace (Wave 4).

---

## F-13 · Natural-Language Quick Capture

**What it is**
A global quick-add that understands how people actually type. `Physics homework friday 6pm #school` becomes a task in the School database due Friday at 6pm — with **no LLM and no marginal cost**.

**Behavior**
- `Cmd+K` (or the `+` in the sidebar) opens a single-line input, centered, nothing else on screen.
- As the user types, matched fragments highlight live and a preview chip row appears beneath: `📅 Fri Jul 17, 6:00 PM` · `🗂 School` · `⚑ High`.
- Recognized patterns:
  - **Dates:** `today`, `tmrw`, `friday`, `next tuesday`, `jul 17`, `7/17`, `in 3 days`, `every monday` (recurring is parsed and flagged as unsupported in V1 with a clear message rather than silently dropped).
  - **Times:** `6pm`, `18:00`, `at noon`, `9-10am` (range).
  - **Target database:** `#school`, `#work` — matches database names and aliases, fuzzy.
  - **Priority:** `!high`, `!!`, `!low`.
  - **Person:** `@anthony`.
- Everything not matched becomes the record's title. The highlighting shows exactly what was consumed, so it's never a mystery.
- Enter creates the record and shows a toast: `Added to School · Undo`. The input stays open for the next capture.
- If no `#database` is given, it goes to the workspace's default task database.
- Ambiguity is resolved by *showing*, not asking: the chips are the confirmation. If they're wrong, the user edits the text and watches them change.

**How it works**
- `packages/core/src/parsing/natural-capture.ts` — a deterministic tokenizer + rule set. **No LLM.** Date parsing via a battle-tested library (chrono-style), pinned to the user's timezone.
- Runs on every keystroke, client-side, sub-millisecond. No network round trip for the preview.
- Enter → one `records` insert + N `record_values` inserts.
- The same parser powers F-10's property detection. One parser, one behavior, one place to fix bugs.
- **Cost: $0 forever.** This is deliberate: quick capture is the highest-frequency action in the product, and putting a paid model call in that path would be an economic mistake and a latency mistake.

**V1 boundary / later**
V1 (P3): as described. Later: recurring tasks (needs a real recurrence model — parsing it is easy, storing and materializing it is the actual work); voice capture; email-to-workspace address.

---

## F-14 · Typed Import

**What it is**
Imports land **organized, not dumped**. Notion exports, CSVs, Drive docs, and Canvas items arrive with types recognized, dates parsed, and views already on them.

**Behavior**
- `Settings → Import`, or the starter task, or drag a `.zip`/`.csv` anywhere onto the workspace.
- **Notion export (.zip of Markdown + CSV):** Planevo reads the export structure — Notion writes databases as CSV plus a folder of per-record Markdown pages. Behavior:
  - Page hierarchy is preserved (nested folders → nested pages).
  - Each CSV becomes a database. Column types are *inferred*: a column of `Not started/In progress/Done` becomes a Select with those options (colors auto-assigned); a column of dates becomes a Date; `Yes/No` becomes Checkbox; a column whose values match another CSV's titles becomes a **Relation**.
  - Each record's Markdown body becomes its record page content.
  - Notion's inline databases, callouts, toggles, and code blocks map to their BlockNote equivalents. Unsupported blocks (Notion AI blocks, synced blocks) become plain text with a note, never silently vanish.
  - Imported databases get born-with-views applied (F-11) — a Notion table with no views becomes a Planevo database with table + board + calendar where the properties allow it.
- **Preview before commit:** a summary screen — `12 pages · 3 databases · 247 records. Tasks: Name (text), Status (select, 3 options), Due (date), Project (relation → Projects).` The user can override any inferred type before confirming.
- **CSV:** same inference, one database.
- Progress is shown per-item; failures are listed at the end with reasons and don't abort the rest.
- Import is **idempotent by run** — re-importing the same file creates a new set, never merges silently. Merge is a later feature and pretending otherwise would corrupt data.

**How it works**
- Runs as an **Inngest background job** (imports of hundreds of records must survive a closed tab).
- Type inference: deterministic heuristics over the column's full value set (all-parseable-as-date → Date; ≤15 distinct values with repeats → Select; matches target DB titles → Relation). **Heuristics first.** A tiny model call is permitted *only* for ambiguous column naming, and only after heuristics run — cost is fractions of a cent per import, not per row.
- Markdown → BlockNote via a mapping layer in `packages/core/src/import/markdown-to-blocks.ts`.
- Relation resolution is a second pass after all records exist (you can't link to a record that isn't imported yet).

**V1 boundary / later**
V1 (P5): Notion export, CSV, Drive docs, Canvas items. Later: Todoist/Asana/Trello importers; incremental re-import with merge; live two-way sync (probably never — it's a lock-in pattern).

---

## F-15 · Structure Detection

**What it is**
The quiet noticing layer. When the workspace sees repetition, it offers — once, softly, dismissibly — to convert it into structure.

**Behavior**
- Trigger example: the user has created a third page whose title matches a pattern (`Client — Acme`, `Client — Bolt`, `Client — Corvin`) and whose bodies share a heading structure.
- What appears: a **single-line, inline, dismissible bar** at the top of the page — not a modal, not a toast, not a badge on the sidebar: `These 3 pages look alike. Turn them into a Clients database? · Yes · Not now · Never suggest this`.
- `Yes` → the F-10 preview panel, pre-filled. `Not now` → gone for 30 days for this pattern. `Never suggest this` → that pattern is permanently silenced for this workspace.
- **Hard rules on this feature:** it never interrupts typing; it never appears more than once per session; it never appears in the first 7 days of a workspace's life; if dismissed twice, it stops for good. A suggestion that nags is worse than no suggestion.
- Other detections: 5+ similar checkbox lists across pages → "Track these as tasks?"; a text property whose values repeat heavily → "Make Status a Select?"

**How it works**
- Runs as a **scheduled Inngest job**, nightly, per workspace — never in the request path. The UI only reads a `suggestions` table; it never computes.
- Detection is **heuristics-first**: title-pattern similarity (common prefix/suffix), structural similarity of `content_json` (heading sequence hashing), value cardinality on text properties. A small model call is permitted only to *name* the proposed database ("Clients") and only when heuristics are already confident. Ceiling: fractions of a cent per workspace per night, and it's skippable entirely for workspaces below a size threshold.
- Dismissals are stored per-pattern-hash so "never" actually means never.
- **This is built LAST (P5), by design.** Guessing what patterns matter before there's real usage data would produce a feature that annoys people. PostHog data from P0–P4 replaces the guess.

**V1 boundary / later**
V1 (P5): the three detections above. Later: detections learned from aggregate behavior (opt-in only, per the no-training promise).

---

## F-16 · Autolinking

**What it is**
Relations accrete from writing instead of schema ceremony. Mention a record's name in another record, and the link is offered.

**Behavior**
- User types `Blocked by Q4 Launch` in a task's body. `Q4 Launch` is the title of a record in Projects. The phrase gets a subtle dotted underline, and a small inline affordance appears: `↗ Link to Q4 Launch in Projects?` — accept with Tab, ignore by typing on.
- Accepting: if the task has a relation property targeting Projects, the value is set. If not, the user is asked once whether to add one (`Add a "Project" relation?`), because silently creating schema is a Tier 2 action even when a human triggers it.
- The `@` trigger does this explicitly: typing `@` in any editor opens a record search across the workspace; picking one inserts a live mention pill.
- Suggestions never fire on short/common titles (`Notes`, `To do`) — a minimum length and an ambiguity check prevent underlining half the document.

**How it works**
- Client-side string matching against an in-memory index of record titles for the workspace (primary properties only), refreshed on load and on record creation. Trigram/prefix matching, debounced.
- **No LLM.** Cost: $0.
- Accepting writes a `relations` row (F-07) or, if it's a mention pill, embeds a reference node in `content_json` that renders live (a renamed record updates the pill everywhere).

**V1 boundary / later**
V1 (P5): titles, `@` mentions, single-workspace. Later: backlinks panel ("what mentions this record?") — which the `(target_record_id)` index already supports for free.

---

## F-17 · "Is-A" Object Types  ⚠ DESIGN RISK

**What it is**
Type `#task` on any line, anywhere, and that line *becomes* a Task — inheriting the Task type's properties and joining the right database. Borrowed from Tana's supertags.

**Behavior (proposed)**
- In any page, typing `#` shows workspace object types (Task, Note, Project, Client…). Selecting one converts the current block into a record of that type, rendered inline with its properties available on the line.
- The line lives in two places at once: it's still a block in the page, and it's now a record in a database — one object, two renderings. Editing either updates both.

**The open design question — stated honestly**
Which database does `#task` route to when the workspace has three task databases (Work Tasks, School Tasks, Home)? Candidate answers:
1. **Default database per type** — a workspace setting mapping `task → School Tasks`. Simple, predictable, one setting to forget about.
2. **Contextual routing** — route by the page's location in the tree (a page under "School" routes to School Tasks). Magical when right, infuriating when wrong.
3. **Disambiguate on use** — `#task` prompts a picker the first time per page, then remembers. Adds friction to the fast path, which is the entire point of the feature.

Current lean: **(1), with (3) as the fallback when no default exists.**

**How it works**
Mechanically it's F-10 (block↔record) applied at single-block granularity with a type registry on top: an `object_types` concept mapping a tag to a `template_type` + a default `database_id`.

**V1 boundary / later**
**This is the only one of the eight mechanics permitted to be dropped.** Rationale, stated plainly so it isn't relitigated later: F-10 (retroactive structure) plus F-13 (quick capture) already cover ~80% of what `#task` delivers. If, when P2 is done, the routing question doesn't have a clean answer that survives contact with the real kernel, this ships in Wave 2 or not at all. **Build it after Tier 2, deliberately, or don't build it.**

---

# PART IV — PLANEVO AI

**Positioning, restated because every implementation decision below descends from it:** AI is *present, not pushy*. It is a first-class, welcoming, visible surface the user **chooses** to open — never the front door they're pushed through. The home screen leads with the user's own workspace. There are no sparkle buttons in core flows.

---

## F-20 · The Chat Surface

**What it is**
A full chat workspace — the AI's home. Not a cramped sidebar, not a buried command bar. A real place, one confident click away, and ignorable forever.

**Behavior**
- Reached from a persistent but quiet sidebar entry (`Planevo AI`) or `Cmd+J`. Never auto-opens. Never has a notification dot. Never interrupts.
- Layout: conversation thread center, a sources rail on the right (what this conversation can see), a thread list on the left. Threads persist and are searchable.
- Composer: text input, attach-file button, a **context chip** showing what's in scope (`📁 This workspace` / `📄 3 files` / `🗂 Tasks database`), and — on Pro only — a model picker.
- Responses stream. Tool calls render as inline status lines (`Reading Projects database…`, `Searching the web…`) so it's never a spinner-and-pray.
- Rich rendering: tables, diagrams, formatted documents, code. Any generated artifact has `Save to workspace` → becomes a page.
- Empty state: no example prompt gallery shouting at the user. A single line — `Ask about anything in your workspace.` — and the sources rail showing what it can see. Presence, not pressure.

**How it works**
- **Vercel AI SDK** for the chat loop, streaming, and tool calling. One interface across every provider.
- Every request: `packages/api/chat` → Upstash rate-limit + credit check (F-27) → Supabase context load (RLS-scoped) → gateway → model → tool calls → stream back.
- Tables: `agent_sessions` (thread), plus messages, plus `agent_actions` for anything the model proposes to *do*.
- **Context assembly is scoped, never dumped.** Workspace structure (database names, property names) is always in the system prompt — it's small and it's what lets the model reason about the schema. Record *content* enters only via retrieval against explicitly scoped sources. We never stuff a workspace into a context window.

**V1 boundary / later**
V1 (P3): as described. Later: voice, shared threads (needs collaboration first), thread branching.

---

## F-21 · Multi-Model Routing & the Gateway

**What it is**
One gateway, one key, one bill — routing to Anthropic, OpenAI, Gemini, xAI, and cheap open models. **Never four direct SDK integrations.**

**Behavior**

| Tier | Models | Picker |
|---|---|---|
| **Free** | Auto-routed cheap only (DeepSeek/Kimi/GLM-class) | **None.** No picker, no model names, no decision to make. |
| **Plus** | Mid-tier + auto | Limited |
| **Pro** | Frontier: Anthropic, OpenAI, Gemini, xAI | Full pick-your-model, plus Auto |

- Auto-routing is invisible and unannounced: a one-line question gets a cheap model; a "write me a report from these 6 files" gets a stronger one. The user is never told which model answered unless they're on Pro and asked for a specific one.
- No BYOK in V1.

**How it works**
- **OpenRouter or Vercel AI Gateway** (final pick made at P3 start on price + reliability), fronted by the Vercel AI SDK so the choice is a config change, not a rewrite.
- Routing heuristics: prompt length, whether tools are needed, whether retrieval is involved, task type. Deterministic rules, not a model deciding which model to call.
- The gateway's unified usage reporting is *what makes the credit ceiling enforceable* (F-27). That's the reason for the ~5% fee — not convenience, **enforceability**.

**V1 boundary / later**
V1 (P3): as described. Later: per-workspace model preferences; BYOK (Pro only, if asked for repeatedly).

---

## F-22 · Describe-to-Build

**What it is**
The thesis in thirty seconds. Describe what you want to track; get a real, working database. **Always as an editable preview, never as a fait accompli.**

**Behavior**
1. User types `track my freelance clients and invoices` — in the chat surface, or from the template picker's third option (`template / blank / describe it`).
2. **A preview renders.** Not a description of what it would build — an actual mock table: real property types, real Select options with colors, 2–3 example rows, and the views it would come with (`Table · Board by Status · Calendar by Due`).
3. **Everything in the preview is editable inline before anything is created.** Rename a column, change a type via dropdown, delete a column, edit an example value, rename the database.
4. Buttons: **Create** · **Edit with a message** · **Discard**.
5. `Edit with a message` keeps the same loop: `make status a checklist instead` → the preview updates. The natural-language loop *is* the fix path — the user is never dumped into a schema editor to repair the AI's output. (The schema editor still exists, always, for builders who prefer it.)
6. **Create** → the database exists, the preview becomes the real thing in place, and an audit entry is written.
7. Example rows are created as real records with a `Sample` tag and a one-click `Clear examples` — so the database is never a lie about being populated, and never a chore to clean.

**How it works**
- The model is given the workspace's existing schema (so a new Invoices database can relate to an existing Clients database) and a strict output contract: a JSON database spec validated against the same Zod schema the manual creation path uses. **An invalid spec never reaches the UI** — it's rejected and retried once, then falls back to a template suggestion.
- The preview is rendered from the spec client-side. **Nothing is written to Postgres until Create.** The spec lives in `agent_actions` with `status = 'proposed'`.
- Create → the same `createDatabase()` transaction as F-03. **One code path.** The AI's output goes through the exact same door as a human's clicks.
- **This is Tier 2** (schema change) — confirmation is structural, not a setting.

**V1 boundary / later**
V1 (P3): databases + views + sample rows. Later: describe-to-build entire multi-database workspaces; describe-to-modify (`add a priority field to Tasks and show it on the board`).

---

## F-23 · Grounded Q&A with Citations

**What it is**
Ask questions about your own workspace and files; get answers with citations pointing at the exact source.

**Behavior**
- `what did I decide about pricing?` → an answer, with inline citation chips (`[Meeting Notes · Jul 3]`) that open the source at the right block on click.
- Sources rail shows what was searched. If the answer isn't in the workspace, it says so — and offers web search rather than inventing.
- Multi-document: `compare what these three docs say about the timeline` — real cross-document synthesis.
- Study cards, summaries, and outlines from any set of sources (the NotebookLM feature set, in-product).
- **If a claim can't be cited, it isn't stated as fact.** The model is instructed to mark uncited synthesis explicitly.

**How it works**
- Retrieval over: `pages.content_json`, `records` + `record_values`, and file text extracted at upload (F-24). Embeddings in Postgres via `pgvector` on Supabase — no separate vector DB, no second bill, no sync problem.
- Chunking at block boundaries, which is why citations can point at a *block* and not just "somewhere in this page."
- **RLS applies to retrieval.** The search query runs as the user; the model cannot retrieve what the user cannot read. Cross-workspace retrieval is impossible by construction, not by prompt instruction.
- Embedding on write (debounced), as an Inngest job. Cost: a fraction of a cent per page, once.

**V1 boundary / later**
V1 (P5 — files-AI): as described. Later: audio overviews; per-source pinning; citation confidence display.

---

## F-24 · Files as Sources

**What it is**
Every file uploaded to the workspace **automatically** becomes something the AI can read and cite. There is no "add to knowledge base" step, ever.

**Behavior**
- Drag a PDF into Files (or attach it in chat, or connect Drive) → it's a record with properties, and it's a source. Immediately. No toggle, no ceremony, no second inbox.
- The file's record page shows a preview (PDF, image, text, docx) and the extracted text is searchable.
- The sources rail in chat lists them; the user can scope a conversation to specific files.
- Limits by tier: Free ~50MB, Plus ~1–5GB, Pro ~10GB+.
- If text extraction fails (a scanned image PDF), the record says so plainly and offers OCR rather than silently being an empty source.

**How it works**
- Upload → Supabase Storage → `records` row in the Files database with the storage path → Inngest job: extract text (pdf parsing / docx / plain), chunk, embed to `pgvector`, mark ready.
- Extraction failures are surfaced on the record, logged to Sentry, never silent.

**V1 boundary / later**
V1: upload/organize/attach/preview (P2); extraction + embedding + Q&A (P5). Later: OCR for scans; audio/video transcription.

---

## F-25 · Artifact Generation

**What it is**
The AI writes real documents — reports, essays, decks, summaries — grounded in the user's own sources, and saves them into the workspace as pages.

**Behavior**
- `write a project update from the last two weeks of the Tasks database and my meeting notes` → a drafted document, rendered formatted in chat, with citations.
- `Save to workspace` → becomes a real page (blocks, headings, tables — not a wall of markdown text), placed where the user chooses.
- Iteration happens in chat: `make it shorter`, `add a risks section`.

**How it works**
- Retrieval (F-23) → generation → markdown → BlockNote blocks via the same converter as F-14's import path. One converter.
- Saving is a normal `pages` insert. The artifact is not a special object — it's a page. Everything that works on pages works on it.

**V1 boundary / later**
V1 (P5): documents. Later: slide decks as a real format; export to docx/pdf.

---

## F-26 · Workspace Operations via Chat

**What it is**
The AI can operate the workspace — create and edit tasks, events, pages, databases, views, records — through exactly the same doors a human uses.

**Behavior**
- `add a task to prep for the physics test friday` → a record, created, with a toast and an audit entry. Tier 1 (single record, invited context): it just happens.
- `mark everything in Done older than a month as archived` → Tier 2 (bulk): a preview of the 14 affected records, then **Confirm** / **Cancel**.
- `delete the Old Projects database` → Tier 2 (schema + delete): explicit confirmation naming the object and its record count.
- Everything lands in the audit log (F-29).

**How it works**
- Tools defined once in `packages/core/src/agent/tools.ts`, sharing the *same* validation and the *same* write functions as the UI. **There is no agent-only write path.** This is the architectural claim in the strategy PRD, made concrete: an agent cannot create a state the UI couldn't.
- Every tool call is classified by tier (F-28) before execution.

**V1 boundary / later**
V1 (P3): create/edit records, pages, databases, views. Later: cross-database operations; scheduled operations (that's agents, F-30).

---

## F-27 · The Credit System

**What it is**
One shared pool of credits across chat and agents, priced so that model choice can never break the economics.

**Behavior**
- **Free:** ~100 credits/month. **The user never sees a number.** When exhausted: `You've reached your AI limit for now — resets Tuesday.` No meter, no counter, no anxiety, no upsell shouting.
- **Plus:** ~1,500/month, with a simple meter in settings. They're paying; they get visibility.
- **Pro:** ~5,000/month fair-use, meter shown.
- Rough costs: cheap message ≈ 1 credit · frontier message ≈ 5–10 · describe-to-build ≈ 5–15 · heavy agent workflow ≈ 20+.
- **"Unlimited" never appears in Planevo's marketing or UI as a literal claim.** It always means a generous soft cap. That's how AI companies avoid bleeding out, and saying it plainly is part of the trust promise.
- Running out never breaks the workspace. Every manual feature keeps working. The workspace is not paywalled — the AI horsepower is.

**How it works**
- Table: `credit_ledger (id, user_id, delta, reason, model_used, created_at)` — an append-only ledger, never a mutable counter. Balance = sum. Auditable, debuggable, refundable.
- **The multiplier law:** credits charged = (that model's real token cost) ÷ (the cheapest model's cost), rounded up. Margin per credit is therefore *identical* across models — a Pro user picking the most expensive frontier model cannot damage unit economics, because the price already scaled.
- Enforcement: pre-flight check in Upstash (fast) against a cached balance; post-flight true-up written to the ledger from the gateway's reported usage.
- **Hard ceiling by construction:** max spend = users × cap × cost-per-credit. There is no code path that spends more. Surprises are structurally impossible, not "monitored."
- PostHog receives cost-per-user-per-tier events. That's the Monday number.

**V1 boundary / later**
V1 (P3): as described, no Stripe. **P6:** Stripe wiring — blocked until the entity/lawyer step. Later: credit top-ups; annual plans.

---

## F-28 · The Safety Tier Model

**What it is**
The permission model governing **every** AI action in the product. Not a setting. Not a preference. Structure.

| Tier | Scope | Behavior |
|---|---|---|
| **Tier 1 · auto-execute** | Single-record create/edit inside an explicitly open or invited context | Happens immediately. Toast + undo + audit entry. |
| **Tier 2 · confirm required** | **Any** schema change (create/delete database or property); **any** bulk operation (>1 record); **any** delete | Preview of exact effects → explicit Confirm. No "don't ask again." |
| **Tier 3 · hard-blocked in V1** | Cross-workspace actions; anything touching billing or auth | Not confirmable. Not a setting. The code path does not exist. |

**How it works**
- `classifyAction(tool, params) → tier` in `packages/core/src/agent/safety.ts`, called on **every** tool invocation — chat, agent, scheduled job, no exceptions.
- Tier 2 writes `agent_actions` with `status = 'proposed'` and returns the preview. Only a user confirmation flips it to `confirmed` → executes → `executed`.
- Tier 3 throws before reaching any write function. It's blocked in the tool layer *and* by RLS at the database — two independent walls, because one wall is a bug away from zero walls.
- **Scheduled agents obey identical tiers.** A scheduled agent that wants to do a Tier 2 write queues the proposal and surfaces it for confirmation on next open — it does not get a pass for running at 7am.

**V1 boundary / later**
V1: as described. Later: user-configurable Tier 1↔2 boundaries for specific trusted agents (only after real usage proves it's wanted, and never for deletes).

---

## F-29 · The Audit Log

**What it is**
A plain-language, user-readable history of everything the AI has done or proposed. **A trust feature, not debugging plumbing.**

**Behavior**
- Sidebar → `Activity`. Reverse-chronological, human sentences: `Daily Digest created 3 tasks from your Gmail · today 7:02am · Undo` · `You confirmed: Added "Priority" to Projects · Jul 12 · Undo`.
- Filter by agent, by date, by action type, by status (proposed / confirmed / executed / rejected).
- **Undo** on anything reversible. Creates undo by deletion; edits undo by restoring the prior `value_json` (which the log stores).
- Entries are written for proposals *and* rejections — so "what did it try to do?" is answerable, not just "what did it do?"

**How it works**
- Table: `agent_actions (id, workspace_id, session_id, action_type, target_type, target_id, payload_json, status, created_at, confirmed_at)`.
- `payload_json` stores both the intended change and the prior state — that's what makes undo real rather than aspirational.
- Rendering: a formatter mapping `action_type` + payload → an English sentence. **No raw JSON is ever shown to the user.** If it can't be said in plain English, the log entry is wrong.

**V1 boundary / later**
V1 (P3): as described. Later: export the log; per-object history ("what happened to this record?").

---

# PART V — AGENTS

---

## F-30 · The Agent Builder

**What it is**
A real four-step agent builder, **open to every user from day one** — not a locked preset gallery. Confining users to presets kills the exploration that makes people love tools.

**Behavior**

**Step 1 · Persona** — name, icon, description, and custom instructions (free text: *"You're my TA. Be blunt. Never reschedule anything without asking."*).

**Step 2 · Knowledge** — explicit scoping. Checkboxes over pages, databases, files, and connected integrations. **Nothing is in scope by default.** An agent sees exactly what it was handed, and the scope is visible on the agent's card forever.

**Step 3 · Workflows** — what it may do, and when:
- **Actions:** which tools it can call, each individually toggled (read records / create records / edit records / send email…). Tier 2 actions show a `requires your confirmation` label that cannot be turned off.
- **Triggers:** Manual (invoke from the command bar) · Schedule (daily at 7am, weekly Monday…) · Event (`on new file uploaded`, `on record enters Done`).

**Step 4 · Visibility** — where it appears: sidebar, command bar, a specific database's toolbar, or nowhere (schedule-only).

- A `Test run` button executes once against real scope with **all writes forced to propose-only**, so the first run can never surprise anyone.
- Agent cards show: last run, next run, actions taken this week, current scope.

**How it works**
- Table: `agents (id, workspace_id, name, icon, description, instructions, model_config_json, knowledge_scope_json, workflow_config_json, visibility, is_active, created_at)`.
- Running an agent = a system-prompted chat session (F-20) with its tools filtered to `workflow_config_json.actions` and its retrieval filtered to `knowledge_scope_json`. **It is not a second engine.** One engine, different configuration.
- Scheduled/event runs execute on **Inngest** with retries, timeouts, and failure alerting to Sentry.
- Credits burn from the owner's pool (F-27). Agents cannot exceed the cap; a capped agent skips its run and logs why rather than failing silently.

**V1 boundary / later**
V1 (P4): as described. Later: agent-to-agent handoff; per-agent credit budgets; publishing agents to a marketplace (Wave 4).

---

## F-31 · First-Party Agent Library

**What it is**
Three excellent pre-built agents for one-click users — chosen from **evidence**, not imagination.

**Why these three:** in the largest agent marketplace in this category, scheduled digests dominate actual usage (email digest ≈ 24K users, calendar ≈ 19K, morning brief ≈ 14K). Boring, recurring, useful wins. The long tail of hyper-niche agents is noise — Planevo doesn't chase it; the builder (F-30) lets users make their own.

**Behavior**

**Daily Digest** — runs each morning at a chosen time. Reads: tasks due today/overdue, today's calendar, (optionally) unread Gmail flagged as important. Produces a short brief on the home screen and optionally an email. **Read-only by default** — it never reschedules anything on its own.

**Weekly Review** — Sunday evening. Done vs. planned, what slipped and how far, what's due next week, one plain observation (`Three tasks slipped from last week — all tagged Physics`). Creates a Review page in the workspace.

**Workspace Cleanup** — weekly, **propose-only, permanently**. Finds: databases with no views used in 60 days, records with empty required properties, duplicate-looking records, orphaned pages. Every finding is a proposal with a Confirm button. **This agent has no auto-execute path at all** — not because of the tier rules, but because it's designed that way. An agent that tidies without asking is an agent that deletes something that mattered.

**How it works**
- Shipped as seeded `agents` rows with locked-by-default configs, editable by the user (they're normal agents, not privileged ones).
- Same execution path as F-30. Same tiers. Same audit log. Same credit burn.

**V1 boundary / later**
V1 (P4): these three. Later: more first-party agents driven by what users actually build in F-30 — the builder is also the research instrument.

---

## F-32 · Integrations (Composio)

**What it is**
One pipe. **Exactly four live connections at launch:** Gmail, Google Calendar, Google Drive, Canvas LMS.

**Behavior**
- `Settings → Integrations` — four cards, each with Connect / Connected (scopes listed in plain English) / Disconnect.
- **Gmail:** read messages (agents can digest/triage); create drafts. **Sending email is Tier 2, always.**
- **Google Calendar:** two-way. External events appear in the Calendar face (F-08); Planevo records with dates can push out. Event creation from Planevo is Tier 1; editing an *external* event is Tier 2.
- **Google Drive:** browse and import docs; imported files become records + AI sources (F-24).
- **Canvas LMS:** pull assignments/due dates into a Tasks database. Read-only. (Honest rationale: this exists because the founder is a student and wants it for himself — not because it fits the beachhead persona.)
- Free tier: 1 connection. Plus/Pro: all four.
- Everything an integration brings in **feeds the same kernel**: emails → records, Drive files → sources, Canvas assignments → tasks. No integration gets its own private data model.

**How it works**
- **Composio** handles managed OAuth and pre-built tool actions. Agents call Composio tools through the identical tool-calling loop as internal tools — an integration is not a special case in the agent engine.
- Adding integration #5 is configuration + a settings card, not an engineering project. That's the entire reason for taking a dependency here.
- ⚠️ **Pre-launch blocker to verify:** Gmail's restricted OAuth scopes normally require Google security review — slow and painful for solo devs. **Confirm exactly how Composio's managed auth absorbs this before promising Gmail at launch.** Known indie-dev trap. Verify at P4 start, not P6.

**V1 boundary / later**
V1 (P4): four. **Fast-follow, by user vote:** Slack, Linear, GitHub, Monday — plumbing already exists, each is weeks.

---

# PART VI — ONBOARDING & SURFACES

---

## F-45 · The Onboarding Fusion

**What it is**
Three proven patterns fused into one path. **The entire free-tier onboarding costs ≈ zero AI tokens by design.**

**Behavior**

**Step 1 · One routing question.** After signup: *"What are you organizing?"* — `Work` / `Personal` / `School` / `Something else`. One tap. No wizard, no survey, no five-screen questionnaire.

**Step 2 · Land in a living workspace.** Not a blank canvas. Not a template gallery. The user lands **inside a working workspace** matched to their answer: Tasks populated, Calendar wired, a Notes page, a Files area. Names silently adapted — a School user's board reads `Assignments / Exams / Readings`; a Work user's reads `Backlog / In progress / Done`.
- **No AI announcement. No sparkle button. No "personalize with AI" prompt.** The user just notices it's right.
- Everything is editable in place, immediately.

**Step 3 · The first tasks ARE the onboarding.** The starter board ships with real, checkable items:
1. `Rename this workspace` 2. `Add your first real task` 3. `Drag it to Done` 4. `Connect Google Calendar` 5. `Import from Notion`
- They're real tasks in a real database. Completing them teaches the product by using it. Deleting them is allowed and fine.
- Activation metrics fall out of PostHog for free — completing task N *is* funnel step N. No separate instrumentation.

**Where describe-to-build lives:** in the template picker as one of three options (`template / blank / describe it`). Findable in ten seconds by the AI-curious; never acknowledged by the AI-averse. Rate-limited on Free.

**The distinction that defines the AI voice — the rule this whole feature exists to express:**
A **button demanding a decision** (`✨ Personalize with AI`) makes the user *confront* AI. **Silent labor already baked into the screen** means the user just notices the product understood them. **Planevo always chooses the second.** This outlives onboarding — it's how F-15 and F-16 behave forever: like autocomplete. Present when relevant, invisible when not.

**How it works**
- The routing answer selects a seed config from `packages/core/src/defaults/starter-workspaces.ts` — the same `database-templates.ts` machinery as F-11 with renamed Select options and seeded records. **Pure code.**
- Any inference is invisible and optional; the path works fully with zero model calls. This is a hard requirement: 1,000 free signups must cost ~$0 in tokens to onboard.

**V1 boundary / later**
V1 (P5). Later: a second routing question only if PostHog data proves it improves activation — not because it feels more thorough.

---

## F-46 · Command Bar

**What it is**
`Cmd+K`. Search, navigation, creation, and AI invocation in one input.

**Behavior**
- Opens instantly, empty, centered. Typing searches pages, databases, and records by title (fuzzy).
- Typing a natural-language capture pattern (F-13) shows `Create task: …` with parsed chips as the first result.
- `>` prefix → commands (`New database`, `Import`, `Settings`, `Toggle minimal mode`).
- `@` → jump to a record. `#` → jump to a database.
- Invoking an agent: type its name → `Run Daily Digest`.
- Recent items when empty. Arrow keys + Enter throughout. Escape closes. Never traps focus.

**How it works**
- Client-side fuzzy index of titles (same index as F-16's autolinking — one index, two features), refreshed on mutation. Sub-50ms, no network for navigation.
- **Not an AI surface.** It's a navigation surface that can *reach* AI. The distinction matters: a command bar that requires a model call to open is a slow command bar.

---

## F-47 · Home  ⚑ FOUNDER OVERRIDE 2026-07-16

> **This section was rewritten by founder decision on July 16, 2026.** The original F-47
> rejected the Acme AI reference layout; that rejection is revoked **for Home only**. The
> Acme AI screenshot is now the visual and layout reference for Home. Do not "correct"
> Home back to the old workspace-first layout. `AGENTS.md` carries the matching rule.

**What it is**
The calm launch hub — the default landing page after login, and its own first-class route. Not the Workspace canvas, not Tasks, not Calendar, not Files: Home links into all of them but renders none of them inline. Layout follows the Acme AI reference: left sidebar, large open center, centered greeting, action cards, bottom composer.

**Behavior**
- Optional filter chips at top (`All · Workspace · Tasks · Files · Agents`) — light local filters over the action cards, not persisted queries.
- Centered greeting: time-of-day + first name (`Good afternoon, Anthony`), secondary line `What do you want to organize today?`.
- A 2×3 grid of Planevo-specific action cards: Create new page · Add new task · Open workspace · Upload first file · Connect calendar · Import from Notion. As real data accrues, cards may evolve into Continue-where-you-left-off / Due-today / Recents / Daily Digest.
- Bottom composer (`Search, create, or ask Planevo…`): one input that will grow into quick capture (F-13), search/navigation (F-46), and Planevo AI. It offers AI without forcing it — no sparkle styling, no auto-opened chat, and every card action has a manual path.
- The main sidebar carries separate destinations: Home, Workspace, Tasks, Calendar, Files, Planevo AI, Integrations, Settings.

**How it works**
Straight kernel queries for anything data-backed (recents, due-today when those cards arrive). Composer submissions that address the AI create a normal `ai_conversations` thread — same surface as F-20, no separate engine. No AI in the render path — home must be instant.

---

## F-48 · Minimal Mode & Settings

**What it is**
A user-facing toggle that mutes accent tokens for people who want pure calm, plus the standard settings surface.

**Behavior**
- `Settings → Appearance → Minimal mode`. On: accents (marigold, brick, meadow) desaturate to ink/paper; Select colors become grayscale; the AI layer's slate goes neutral. Structure and legibility are untouched.
- Settings sections: Account, Appearance, AI (model preference on Pro, credit meter on paid), Integrations, Import/Export, Data & Privacy, Billing (P6).
- **Data & Privacy** states plainly: full export anytime; no training on user data without explicit opt-in; what each integration can see.

**How it works**
- One Tailwind config, one token layer. Minimal mode swaps a CSS variable set. This is *why* everything is tokenized — the palette is provisional and must be swappable in one line, and a user-facing toggle proves the tokenization is real.

---

## F-49 · Export

**What it is**
The trust promise, made mechanical. Full export, anytime, open formats.

**Behavior**
- `Settings → Export` → `.zip`: Markdown for every page (folder structure mirroring the tree) + JSON for every database (schema + records + views) + all uploaded files.
- The export format is **exactly what the importer accepts** (F-14). A Planevo export re-imports into Planevo losslessly — which is the only honest proof that an export is real and not a checkbox.
- Per-database CSV export from any database's `…` menu.
- No "contact us to export." No paid-tier gate on leaving. Free users can export everything.

**How it works**
- Inngest job → assembles → Supabase Storage → signed download link, emailed via Resend when ready.
- **Wired in P0.** Not P6. The promise is architectural, and a promise you build last is a promise you break.

---

# PART VII — WHAT IS NOT BEING BUILT

Restated so it doesn't get relitigated at 1am in Phase 3.

**Not in V1:** team collaboration / shared workspaces / permissions · real-time multiplayer editing · comments · formulas · rollups · bidirectional relations · calendar skins or week/day layouts · gallery/timeline/chart views · mobile app · desktop app · open marketplace · user-published agents · BYOK / custom API keys · workflow automation canvas · enterprise SSO (WorkOS is cut until enterprise exists) · meeting notes product · local-first / offline · recurring tasks · more than 4 integrations · any second AI surface beyond Planevo AI + inline previews · competitor comparisons in any marketing copy.

**Permanent rules, not scope decisions:**
- Never train on or ingest paid third-party templates. Original Planevo designs + original generated artwork only. This one is permanent and non-negotiable.
- "Unlimited" always means fair-use soft cap.
- No sparkle buttons in core flows.
- Manual parity on every feature shipped.
- No Stripe code before the entity/lawyer step (founder is a minor; Stripe requires 18+).

---

# APPENDIX — Feature Index by Phase

| Phase | Deadline | Features |
|---|---|---|
| **P0 Foundation** | Aug 9, 2026 | F-01 (schema+RLS), F-49 (export wiring), landing + waitlist |
| **P1 Kernel** | Oct 4, 2026 | F-02, F-03, F-04, F-06, F-07, table view (F-05) |
| **P2 Views + Ease T1** | Nov 22, 2026 | F-05 (board/calendar/list), F-08, **F-10**, F-11, F-12, F-24 (upload half) |
| **★ Dogfood Gate** | Nov 23–29 | No features. Two weeks of real life in the product. P3 blocked until it beats Notion/Todoist for the founder's own use. |
| **P3 Planevo AI** | Jan 24, 2027 | F-20, F-21, F-22, F-26, F-27, F-28, F-29, F-13, F-46 |
| **P4 Agents + Integrations** | Mar 21, 2027 | F-30, F-31, F-32 |
| **P5 Import + Polish** | May 2, 2027 | F-14, F-45, F-23, F-24 (AI half), F-25, F-15, F-16, F-47, F-48 |
| **P6 Beta → Launch** | ≤ Jul 2027 | Stripe (post-legal), beta, Product Hunt |
| **Deferred / at risk** | — | F-17 (is-a types) — the only mechanic permitted to drop |

---

*Planevo Functional Feature Specification v1.0 · July 15, 2026*
*Companion documents: `planevo-prd.md` (strategy) · `planevo-founders-handbook.pdf` (founder reference)*
