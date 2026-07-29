# Planevo — Product Requirements Document (PRD)

**Version:** 2.0 · **Author:** Anthony (Founder) with AI co-founder support  
**Status:** Approved direction — **supersedes PRD v1.0 and all prior kernel-first specs**  
**Date:** July 17, 2026

---

## 0. Document Purpose

This PRD is the single source of truth for the Planevo rebuild. It captures every product, design, technical, and business decision made during the July 2026 strategy sessions, including the **July 17 ecosystem pivot** that retires the universal-kernel model.

Anything not in this document is either undecided or explicitly deferred. When building with AI dev tools (Cursor, Claude Code, Codex), sections of this document can be pasted directly as context.

**What changed in v2.0:** Planevo is no longer "one kernel expressing tasks, calendar, and files." It is a **productivity ecosystem** — separate first-class products (Tasks, Calendar, Files, Workspace) that handshake through a thin linking layer, the way Apple devices work together without being the same device.

**Naming note:** The product ships under the name **Planevo** (domain: planevo.co). The founder has explicitly decided to stop spending time on renaming.

**Companion doc:** `planevo-feature-spec.md` (build-ready feature definitions with stable `F-##` IDs).

---

## 1. Product Vision & Thesis

### 1.1 One-sentence thesis

Planevo is the **Work OS for normal people** — a productivity ecosystem where Tasks, Calendar, Files, and Workspace each do their own job brilliantly, connect seamlessly without setup, and never make you earn the product before you can use it.

### 1.2 The problem

Powerful workspace tools (Notion, Coda, Tana) make users earn the product before they can use it: hours of tutorials, template shopping, schema design, and dashboard decoration before real work happens. People spend so long building their productivity system that the system becomes the productivity.

Separately, task apps, calendar apps, and file apps force a false choice: **simple-but-rigid** or **powerful-but-DIY**. Users outgrow the simple tool and migrate to the powerful one — starting over.

### 1.3 The position

- **Planevo is its own product** — never marketed as a Notion alternative, wrapper, or clone. No competitor comparisons appear anywhere on the website or in-app.
- **An ecosystem, not an engine.** Tasks feels like a task app. Calendar feels like a calendar. Files feels like the best file cabinet in the world. Workspace is the Notion-grade block canvas for people who want structure — and it **embeds** the other products instead of swallowing them. They connect; they are not the same thing underneath.
- **AI is present, not pushy.** AI is a first-class, visible, welcoming surface the user *chooses* to open — never the front door they're pushed through.
- **"You are in charge"** is the core trust promise, cashed out concretely (see §9).

### 1.4 The Apple analogy (founder framing — use this when making tradeoffs)

AirPods, iPhone, and MacBook are different products with different jobs. Continuity makes switching feel magical — not because they share one database, but because they **handshake**. Planevo's magic is the same: create a task in Tasks, tap once to surface it in a School workspace page, schedule it on Calendar, attach a PDF from Files — one source of truth per feature, zero sync configuration.

### 1.5 Core principles (every feature decision checks against these)

1. **Manual-first:** every single thing the AI can do, a user can do by hand in the UI. If the AI layer disappeared, Planevo would still be a complete product.
2. **Zero configuration at the surface:** Tasks ships with board/list/table, statuses, priorities, due dates. Calendar ships with your week at a glance. Files ships organized the moment you upload. Structure is never homework.
3. **Progressive disclosure:** power (custom workspace databases, properties, relations, agents) is hidden behind simple defaults. Residents never see it; builders can always reach it — **inside Workspace**, not by reimplementing Tasks.
4. **Present, not pushy AI:** AI surfaces are findable in seconds and ignorable forever. No sparkle-emoji buttons in core flows.
5. **Exploration over confinement:** users get real builders (agents, workspace databases, views), not locked galleries.
6. **Global first, context optional:** Tasks, Calendar, and Files belong to the **user's life**, not duplicated per workspace. Workspace context filters and links — it does not own the data.
7. **Suggest, don't shove:** when workspace context could help (linking a new task to School), offer a calm one-tap toast — never auto-link, never modal, never blocking.

---

## 2. Target Users & Personas

Modeled on Notion's internal framing (residents / gardeners / builders / architects). Planevo serves the full spectrum from V1 via progressive disclosure:

| Persona | Behavior | What Planevo gives them |
|---|---|---|
| **Residents** | Never touch a property editor. Use what exists. | Tasks/Calendar/Files that work instantly; Home hub; silent defaults; optional workspace linking. |
| **Gardeners** | Tend what exists: tweak views, link items across features, organize files. | Native cross-feature buttons, workspace embeds, filter toggles, duplicate-and-strip in Workspace. |
| **Builders** | Design workspace databases, relations, multi-view systems, agents. | Full workspace database builder (Notion-style), relation tools, agent builder, integrations. |
| **Architects** | Formulas, rollups, nested systems. | Fast-follow formulas/rollups on **workspace databases**; advanced config panels (hidden by default). |

**GTM reality:** the product serves all four from day one, but the realistic first 10–20 real users will skew **builder/gardener**. That is the feedback beachhead, not a product restriction.

---

## 3. Strategic Analysis (settled conclusions)

### 3.1 Moat — the honest answer

There is **no hard technical moat**. Two real advantages:

1. **Ecosystem-native architecture head start.** Cross-feature linking, global products with workspace composition, and agent actions across Tasks/Calendar/Files/Workspace are designed in from day one — not retrofitted onto a single database engine pretending to be four apps.
2. **Focus gap.** Notion's growth motion is enterprise-first. Five-minute solo-user onboarding is not where their incentives point. Planevo owns the individual/small-user **setup-pain wedge** with a Work OS that actually feels like separate tools working together.

**Conclusion:** Planevo wins on execution, speed, and user love — not defensibility.

### 3.2 Migration from v1 kernel architecture

The codebase may temporarily contain kernel-era patterns (`template_type` faces, `DatabaseFace`, per-workspace task databases). **These are deprecated.** Migration follows a **strangler pattern** (see §8): ship real product surfaces alongside legacy routes, then delete faces feature by feature. No production user data crisis — early stage.

### 3.3 Notion import

**Notion import remains a committed feature** — organized, not dumped. Workspace pages and workspace databases import through the block/database path; tasks may map to the Tasks product tables where appropriate. Scheduled for Phase 5.

---

## 4. The Object Model — Ecosystem Architecture

### 4.1 Hierarchy (v2 — replaces kernel-first model)

```
Planevo Account (user)
├── Tasks          ← global product, own tables & UI
├── Calendar       ← global product, own tables & UI
├── Files          ← global product, own tables & UI
├── Workspace(s)   ← context + Notion-style block canvas
│   ├── Pages (blocks, embeds)
│   └── Workspace Databases (custom DBs — Projects, CRM, etc.)
├── Ecosystem Link Layer
│   ├── workspace_links (item ↔ workspace)
│   ├── cross-feature links (task ↔ event, file ↔ task, …)
│   └── live embed blocks (BlockNote references)
├── Planevo AI
└── Agents
```

**There is no universal kernel.** Tasks are not records in a template database. Calendar is not a calendar-view over all records. Files is not a Documents database. Those are **products**.

**Workspace databases** are the Notion-style builder substrate — scoped to a workspace, created inside pages, never powering the Tasks/Calendar/Files sidebar products.

### 4.2 Scope model — Hybrid (founder decision)

| Layer | Scope | Meaning |
|---|---|---|
| Tasks, Calendar, Files | **Global (user-owned)** | One task board for your life; one file library; calendars you own. |
| Workspace | **Context** | School vs Work vs Personal — filters views, toast targets, embed destinations. |
| Workspace databases | **Workspace-scoped** | Custom structure inside the Notion clone only. |
| View filter preference | **Client-cached** | "All" ↔ "This workspace" per product — `localStorage` / `user_preferences` UI blob only. **Never stored on task/event/file rows.** |

**Creation rule:** new tasks, events, and files are **global by default**. Workspace context does not auto-mutate data. A calm toast may offer: *"Add to [Workspace]?"* → one tap creates a `workspace_link` **and** a live embed block on the current page.

### 4.3 Database schema (Supabase / Postgres) — v2

**Global products (new / elevated):**

```sql
-- TASKS PRODUCT
tasks                 id, user_id, title, status, priority, due_at, description_json,
                      position, completed_at, created_at, updated_at
task_subtasks         id, task_id, title, is_done, position, created_at

-- CALENDAR PRODUCT
calendars             id, user_id, name, color, color_mode, is_main,
                      is_included_in_main, is_default, deleted_at, purge_after, position
calendar_events       id, calendar_id, user_id, title, starts_at, ends_at, all_day,
                      location, description_json, task_id (nullable FK → tasks),
                      google_event_id (nullable), source, created_at, updated_at
task_calendar_assignments task_id, calendar_id, user_id, created_at, updated_at

-- FILES PRODUCT (elevate existing)
file_sources          id, user_id, name, storage_path, mime_type, size_bytes,
                      ingestion_status, metadata_json, tags_json, created_at, updated_at
file_links            id, file_source_id, target_type, target_id, created_at
source_chunks         (existing — AI citations)

-- ECOSYSTEM LINK LAYER
workspace_links       id, workspace_id, resource_type (task|calendar_event|file|…),
                      resource_id, created_by, created_at
                      UNIQUE(workspace_id, resource_type, resource_id)
```

**Workspace (Notion clone — largely existing, clarified scope):**

```sql
workspaces            id, owner_id, name, icon, settings_json, created_at
pages                 id, workspace_id, parent_page_id, title, icon, content_json, …
databases             id, workspace_id, page_id, name, icon, template_type, created_at
                      -- template_type for workspace DBs only: project|notes|custom|…
                      -- NOT used for Tasks/Calendar/Files products
database_properties   id, database_id, name, type, config_json, …
records               id, database_id, position, created_by, …
record_values         id, record_id, property_id, value_json
relations             id, source_record_id, source_property_id, target_record_id, …
views                 id, database_id, type, name, config_json, …
```

**AI, agents, billing (unchanged in spirit):**

```sql
ai_conversations, ai_messages, agents, agent_actions, agent_sessions,
credit_ledger, integration_connections, user_preferences, onboarding_progress
```

**Deprecated (remove after strangler migration):**
- `databases.template_type IN ('task', 'calendar', 'files')` as product backing
- `workspaces.settings_json.default_task_database_id` and siblings as product pointers
- Face-database resolution (`getTaskFaceBundle`, etc.)

### 4.4 Schema decisions that protect the future (do not violate)

1. **`database_properties.type` is plain TEXT** — applies to **workspace databases only**. Formula/rollup reserved in TypeScript union.
2. **Cross-feature links use dedicated join tables** — never JSONB arrays of IDs on product rows for primary relationships.
3. **View filter state is never persisted on domain tables** — client cache only.
4. **Multi-tenant from day one:** Supabase Auth + RLS on every table.
5. **Product tables are user-scoped** (`user_id`); workspace tables are workspace-scoped (`workspace_id`). Link layer bridges them explicitly.

---

## 5. Feature Specifications — V1

### 5.1 Home (launch hub)

- Calm launch hub per founder override (Acme AI layout reference for **Home only**): greeting, filter chips, action cards, bottom composer.
- Cards route to **real products** (`/tasks`, `/calendar`, `/files`, `/workspace`) — never to database faces.
- Home does not render Tasks, Calendar, or Files inline.

### 5.2 Tasks (sidebar product)

- **Own product.** Lumis-craft reference for board UI: priorities, statuses, due dates, subtasks, assignees — **zero configuration**.
- Board (default), list, and table views at launch. Not a `DatabaseFace`.
- Global task store (`tasks` table). "Real database wearing a task app's clothes" means **fixed schema at the surface** with optional power later — not routing through the workspace kernel.
- Native actions: **Schedule** (→ Calendar), **Attach file** (→ Files), **Add to workspace** (→ link + embed).
- Filter toggle: **All ↔ This workspace** (client-cached preference).

### 5.3 Calendar (sidebar product)

- **Own product.** Main Calendar is a writable unified view; named and connected
  calendars are independently routable and strictly isolated.
- Own tables: `calendars`, `calendar_events`.
- **Calendar ↔ Tasks (founder decision):**
  - Agenda tasks are assigned to a calendar but stay off the grid until scheduled.
  - **Drag** task onto grid → scheduled time block linked to task.
  - **Native buttons** on each page — no cross-navigation required.
- Main and named calendars share Day / Week / Month; Year is Main-only.
- The toolbar calendar selector owns navigation, Main inclusion, creation, colors,
  defaults, Trash, and connected-calendar disconnect.
- Google/ICS events ingest into `calendar_events` and stay read-only.
- Workspace embeds reference Main or a calendar and edit canonical events live.
- Filter toggle: **All ↔ This workspace** (client-cached).

### 5.4 Files (sidebar product)

- **Own product.** Untitled UI / CloudNest craft reference: upload dropzone, table, filters, folders/collections, storage meter.
- Backbone: `file_sources` + `source_chunks` (already in codebase).
- Upload → organized, searchable, taggable. **Every file is automatically an AI source** — no knowledge-base setup step.
- Native actions: **Attach to task**, **Link to event**; reciprocal buttons on Tasks and Calendar.
- Optional workspace toast + embed on upload.
- Filter toggle: **All ↔ This workspace** (client-cached).

### 5.5 Workspace (sidebar product — the Notion clone)

- BlockNote block editor: **everything is a block** (Notion parity).
- Nested page tree, describe-to-build, templates, never-blank starters.
- **Workspace-scoped custom databases** inline in pages (Projects, Reading list, CRM) — the builder path.
- **Live embed blocks** for ecosystem products: task board slice, calendar strip, file list, single linked items.
- Workspace switcher: create/rename/delete workspaces. Switching sets **context** for filters, toasts, and embeds — not a full data swap.
- **Retroactive structure (F-12)** applies to **workspace pages and workspace databases** — not to the Tasks product tables.

### 5.6 Ecosystem linking layer

- **`workspace_links`:** explicit association between a global item and a workspace. Created by toast confirm or "Add to workspace" action.
- **Live embed blocks:** BlockNote blocks referencing `resource_type` + `resource_id`; render in sync with source product.
- **Cross-feature links:** `task_id` on `calendar_events`; `file_links` for file ↔ task/event.
- **Unified search (V1 basic):** command bar searches tasks, events, files, pages by title.
- **No sync jobs** between products — one write path per product, links are pointers.

### 5.7 The ease mechanics (re-scoped for ecosystem)

**Tier 1 — workspace & products:**
1. **Retroactive structure** *(workspace flagship)*: promote blocks → workspace database records. Structure as enhancement inside Workspace.
2. **Born-with-views:** workspace databases ship with sensible views (F-11). Tasks/Calendar/Files ship with **product defaults** in their own schemas — not template databases.
3. **Duplicate-and-strip:** workspace databases and pages (F-12).

**Tier 2:**
4. **Natural-language quick capture** (F-13): global quick-add → `tasks` table (deterministic parser, no LLM).
5. **Typed import** (F-14): Notion/CSV → workspace pages + workspace DBs + optional task/file mapping.

**Tier 3:**
6. **Structure detection** (F-15): workspace pages only.
7. **Cross-link suggestions** (F-16): offer task/file/event links from writing — not kernel record autolinking.

**At risk:**
8. **"Is-a" object types** (F-17): may drop if routing stays unclear.

### 5.8 Planevo AI (the visible AI surface)

Unchanged in spirit from v1. Updated scope:

- Grounded in **tasks, calendar events, files (`source_chunks`), and workspace pages** via retrieval — not "dump the kernel."
- Describe-to-build generates **workspace pages and workspace databases** — previews before commit.
- Can create/edit tasks, events, files, pages through the same APIs the UI uses.
- Multi-model gateway, credit tiers — as v1.

### 5.9 Agents

Unchanged in spirit. Knowledge scope includes: workspace pages, workspace databases, **Tasks, Calendar, Files** (via product APIs), integrations.

First-party library: Daily Digest, Weekly Review, Workspace Cleanup.

Permission model: propose → confirm → execute → audit log.

### 5.10 Integrations

Composio infrastructure. **V1: Gmail, Google Calendar, Google Drive, Canvas.**

Integrations feed **product tables**, not a universal kernel:
- Google Calendar → `calendar_events`
- Drive → `file_sources`
- Gmail digest → tasks or workspace pages (agent-driven)
- Canvas assignments → `tasks`

### 5.11 Onboarding (updated for ecosystem)

1. **One routing question:** Work / Personal / School / Something else.
2. **Land in a living workspace:** Getting Started page, workspace pages seeded — **not** three template databases as canonical Tasks/Calendar/Files.
3. **Global products auto-exist:** user's task board, default calendar, and file library are created on signup (empty, configured, ready).
4. **First tasks ARE the onboarding:** starter tasks in the **Tasks product** teach the flow; workspace Getting Started page embeds/links them.
5. **Describe-to-build** in template picker — optional, rate-limited on Free.

### 5.12 Design & Brand

Unchanged from v1 PRD §5.8 with these IA corrections:

- **Tasks reference:** Lumis board craft (card treatment, priority badges, subtask progress).
- **Calendar reference:** dark Today + week grid mockup (connected to Tasks, own chrome).
- **Files reference:** Untitled UI + CloudNest (table, upload, folders).
- **Workspace reference:** Notion block canvas — craft-only for spacing/type, not IA clone.
- **Home reference:** Acme AI layout (founder override — Home only).
- Token system, illustration law, no competitor names — unchanged.

---

## 6. Pricing, Credits & Economics

Unchanged from v1 PRD §6 with one line edit:

| | Free | Plus $10/mo | Pro $20/mo |
|---|---|---|---|
| **All products** (Tasks, Calendar, Files, Workspace, ease mechanics) | Full | Full | Full |
| AI credits, models, agents, integrations, storage | (as v1) | (as v1) | (as v1) |

**Principle: the Work OS is never paywalled.** Charge for AI horsepower, automation, and storage — not for Tasks, Calendar, or Workspace.

---

## 7. Technical Architecture

### 7.1 Monorepo

Unchanged from v1 §7.1. Web-first; `packages/core` holds product queries, link layer, workspace DB logic, agent tools.

### 7.2 Tech stack

Unchanged from v1 §7.2.

### 7.3 Migration from kernel-era code

**Strangler pattern (mandatory):**

| Phase | Action |
|---|---|
| A | Add product tables + link layer migrations |
| B | Ship Lumis Tasks UI on `tasks` table; `/tasks` stops using `DatabaseFace` |
| C | Ship Calendar product UI on `calendar_events` |
| D | Ship Files cabinet on `file_sources` |
| E | Workspace embed blocks + link toast |
| F | Delete face-databases, template seed for task/calendar/files DBs |

**Carryover from old build:** BlockNote, dnd-kit, RLS patterns, `file_sources`, propose→confirm→execute, design tokens. **Dead:** Bruno, calendar-as-records product path, face-database routes as final architecture.

---

## 8. Roadmap — Phases (v2)

- **Phase 0 — Foundation:** monorepo, Supabase, tokens, landing. *(largely done)*
- **Phase 1 — Ecosystem foundation:** product schema migrations, link layer, global product creation on signup, deprecate face routes behind flags.
- **Phase 2 — Tasks product:** Lumis UI, board/list/table, native cross-feature buttons, strangler cutover for `/tasks`. **Dogfood Gate #1.**
- **Phase 3 — Calendar + Files products:** week grid, multi-calendar, file cabinet UI, cross-links, strangler cutover.
- **Phase 4 — Workspace composition:** embed blocks, link toast, workspace DB polish, retroactive structure on workspace content.
- **Phase 5 — Planevo AI + credits:** gateway, chat, describe-to-build (workspace), grounded Q&A on files, credit system.
- **Phase 6 — Agents + integrations:** builder, first-party agents, Composio (Gmail, GCal, Drive, Canvas).
- **Phase 7 — Import, onboarding v2, polish:** Notion import, onboarding fusion (ecosystem), structure detection, minimal mode.
- **Phase 8 — Beta & Launch:** closed beta, Stripe + legal, Product Hunt.
  - **Storage billing (already seamed in 2026-07-22):** per-tier GB caps (free 5 / plus 50 / pro 200) are enforced on every upload path, and used-bytes is metered live from `file_sources`. A user's plan reads from `public.user_billing.plan` — **the Stripe webhook must write the resolved plan here** on subscription create/update/cancel (that's the whole wiring; `resolveUserPlan` already reads it and defaults to free). Remaining for Stripe: checkout + webhook + `user_billing` upserts, and (optional) metered $/GB overage billing on top of the caps. See migration `20260722120000_files_billing_and_ratelimit.sql`.
  - **Ops to wire at launch:** schedule `scripts/gc-orphan-blobs.mjs --apply` (orphan-blob GC) and a periodic prune of stale `api_rate_limits` window rows — no cron infra exists yet (Supabase edge function + pg_cron is the intended home).

---

## 9. Trust, Legal & Compliance

Unchanged from v1 PRD §9.

---

## 10. Success Metrics

- **North star:** a new user has **working Tasks, Calendar, and Files** and a **seeded Workspace** in **< 5 minutes without a tutorial**.
- Activation: starter task completion (Tasks product), first file upload, first workspace link accepted.
- Dogfood gate: founder uses Tasks + Calendar daily; Workspace for notes/projects.
- Retention: D7/D30 of beta cohort.
- Economics: cost-per-user per tier.

---

## 11. Non-Goals (V1)

No team collaboration/permissions · no custom LLM/BYOK · no workflow-automation canvas · no enterprise SSO · no full mobile app · no open marketplace · no formulas/rollups at launch · no local-first · no calendar skins at launch · no competitor comparisons · no more than 4 integrations · **no universal kernel / database-face architecture** · no auto-linking items to workspace without user consent.

**Permanent rules:**
- Never train on paid third-party templates.
- Manual parity on every feature.
- View filter preferences never stored on product domain rows.
- No sparkle buttons in core flows.

---

*Planevo PRD v2.0 · July 17, 2026 · Supersedes v1.0*
