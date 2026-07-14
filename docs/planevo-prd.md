# Planevo — Product Requirements Document (PRD)

**Version:** 1.0 · **Author:** Anthony (Founder) with AI co-founder support
**Status:** Approved direction — supersedes all prior Planevo/Plan Pilot specs

---

## 0. Document Purpose

This PRD is the single source of truth for the Planevo rebuild. It captures every product, design, technical, and business decision made during the July 2026 strategy sessions. Anything not in this document is either undecided or explicitly deferred. When building with AI dev tools (Cursor, Claude Code, Codex), sections of this document can be pasted directly as context.

**Naming note:** The product ships under the name **Planevo** (domain: planevo.co). The founder has explicitly decided to stop spending time on renaming. A rename remains possible later but is not a blocker or an active workstream.

---

## 1. Product Vision & Thesis

### 1.1 One-sentence thesis
Planevo is the workspace that's ready before you are: Notion-caliber structural power (blocks, databases, views, relations) with none of the setup tax — structure grows around your work instead of being demanded before it.

### 1.2 The problem
Powerful workspace tools (Notion, Coda, Tana) make users earn the product before they can use it: hours of tutorials, template shopping, schema design, and dashboard decoration before real work happens. People spend so long building their productivity system that the system becomes the productivity. Many users — including the founder — bounce off Notion entirely because of this setup burden, despite wanting what it offers. Others report spending years "building their Notion life."

### 1.3 The position
- **Planevo is its own product** — never marketed as a Notion alternative, wrapper, or clone. No competitor comparisons appear anywhere on the website or in-app.
- **AI is present, not pushy.** Planevo is NOT positioned as an AI app (users are fatigued by AI-first products — "you're making another AI" was the consistent negative reaction to earlier framings). But AI is not hidden under the hood either. The final position, modeled partly on Sana: AI is a first-class, visible, welcoming surface that the user *chooses* to open — never the front door they're pushed through. The Notion-style workspace layer is the product; the AI layer is present, capable, and always optional.
- **"You are in charge"** is the core trust promise, cashed out concretely (see §9).

### 1.4 Core principles (every feature decision checks against these)
1. **Manual-first:** every single thing the AI can do, a user can do by hand in the UI. If the AI layer disappeared, Planevo would still be a complete product.
2. **Structure is never a prerequisite:** structure is something the workspace grows around work already happening (retroactive structure, silent inference, born-with-views).
3. **Progressive disclosure:** advanced power (formulas, rollups, complex relations, schema editors) is hidden behind simple defaults. Residents never see it; architects can always reach it.
4. **Present, not pushy AI:** AI surfaces are findable in seconds by those who want them and ignorable forever by those who don't. No sparkle-emoji buttons begging for clicks in core flows.
5. **Exploration over confinement:** users get real builders (agents, databases, views), not locked galleries. Confining users kills the discovery that makes them love tools.

---

## 2. Target Users & Personas

Modeled on Notion's internal framing (residents / gardeners / builders / architects). Planevo serves the full spectrum from V1 via progressive disclosure:

| Persona | Behavior | What Planevo gives them |
|---|---|---|
| **Residents** | Never touch a property editor. Use what exists. | Pre-built Tasks/Calendar/Files that work instantly; templates; silent AI-shaped defaults. |
| **Gardeners** | Tend what exists: add a property, tweak a view, duplicate a template. | Inline property editing, born-with-views, duplicate-and-strip, retroactive structure. |
| **Builders** | Design databases, relations, multi-view systems. | Full database kernel, relation tools, agent builder, integrations. |
| **Architects** | The small % wanting formulas, rollups, nested systems. | Fast-follow formulas/rollups, advanced config panels (hidden by default). |

**GTM reality:** the product serves all four from day one, but the realistic first 10–20 real users — reached via solo-founder channels (X, Reddit, Product Hunt, dev-journey content, TikTok/IG) — will skew **builder/gardener**. That is the practical feedback beachhead, not a product restriction. Launch, learn from whoever shows up, expand.

---

## 3. Strategic Analysis (settled conclusions)

### 3.1 Moat — the honest answer
There is **no hard technical moat**. Two real advantages:
1. **Agent-native architecture head start.** Every action — human or agent — flows through the same propose → confirm → execute → audit-log path from day one. Notion retrofits AI onto a decade-old block editor and must protect millions of existing workspaces; Planevo builds agentic schema mutation as a first-class primitive. This is a speed/architecture advantage, not an impossibility for Notion.
2. **Focus gap.** Notion's growth motion is enterprise-first (org wikis, admin controls, enterprise AI search). Five-minute solo-user onboarding is not where their incentives point. Planevo owns the individual/small-user setup-pain wedge.

**Conclusion:** Planevo wins on execution, speed, and user love — not defensibility. No complacency once it works.

### 3.2 "Why won't Notion just ship progressive disclosure?"
They could, technically. But changing defaults risks breaking muscle memory for millions of power users and invalidating their template/education ecosystem. For them it's a risky redesign; for Planevo it's the default with zero legacy users to disrupt.

### 3.3 Migration
**Notion import (Markdown/CSV export ingestion) is a committed feature** — most realistic early adopters have existing Notion workspaces. Import must land *organized, not dumped* (see ease feature #7). Scheduled for Phase 5 (see roadmap) — not needed for the founder-dogfood gate, required before public launch.

---

## 4. The Object Model

### 4.1 Hierarchy
```
Workspace → Pages → Databases → Views → Records → Agents
```
- **Pages** are the canvas (BlockNote-style block editor, infinitely nestable).
- **Databases** are the structure (typed properties).
- **Views** shape the same data (table, board, calendar, list).
- **Records** are the items.
- **Agents** operate on all of the above when invited, with confirmation.

There are **no standalone apps** for tasks/calendar/notes/files/CRM. One kernel expresses all of them. Sidebar entries (Tasks, Calendar, Files) are native-feeling entry points into the same kernel (see §5.2).

### 4.2 Database schema (Supabase / Postgres)

```sql
workspaces          id, owner_id, name, icon, created_at
pages               id, workspace_id, parent_page_id (nullable self-ref), title, icon,
                    content_json (BlockNote JSONB), database_id (nullable), position,
                    is_archived, created_at, updated_at
databases           id, workspace_id, page_id, name, icon,
                    template_type (task|notes|project|files|custom), created_at
database_properties id, database_id, name, type (TEXT column — NOT a Postgres ENUM),
                    config_json, position, is_primary, created_at
records             id, database_id, position, created_by, created_at, updated_at
record_values       id, record_id, property_id, value_json
                    UNIQUE(record_id, property_id)
relations           id, source_record_id, source_property_id, target_record_id, created_at
                    INDEX (source_record_id, source_property_id); INDEX (target_record_id)
views               id, database_id, type (table|board|calendar|list), name,
                    config_json (filters, sorts, group_by_property_id, visible_properties),
                    position, is_default
agent_actions       id, workspace_id, session_id, action_type, target_type, target_id,
                    payload_json, status (proposed|confirmed|executed|rejected),
                    created_at, confirmed_at
agent_sessions      id, workspace_id, user_id, context_page_id, context_database_id, created_at
agents              id, workspace_id, name, icon, description, instructions,
                    model_config_json, knowledge_scope_json, workflow_config_json,
                    visibility, is_active, created_at
credit_ledger       id, user_id, delta, reason (message|agent_run|describe_build|grant|reset),
                    model_used, created_at
```

### 4.3 Schema decisions that protect the future (do not violate)
1. **`database_properties.type` is plain TEXT with app-level validation** — never a native Postgres ENUM. Adding `formula` and `rollup` later must be a code-only, zero-migration change. Reserve those names in the TypeScript union now as "not yet implemented."
2. **Relations are a dedicated join table from day one** (never JSONB arrays of IDs), with an indexed reverse lookup — this is what makes rollups cheap when they arrive.
3. **`config_json` shapes reserved:** future formula = `{expression, return_type}`; future rollup = `{relation_property_id, target_property_id, aggregation: sum|count|avg|min|max}`.
4. **Property types in V1 (8):** text, number, select, multi-select, date, checkbox, relation, person/owner. Formula + rollup are the committed fast-follow after the core is stable.
5. **Relations are one-directional in V1.** Bidirectional sync (dual-write consistency, cascade deletes) is deferred deliberately.
6. **Open question deferred to the formulas fast-follow:** read-time computation vs. cached-with-invalidation. Do not decide prematurely.
7. **Multi-tenant from day one:** real Supabase Auth + RLS on every table. Never hardcode the founder's user ID.

---

## 5. Feature Specifications — V1

### 5.1 Workspace (the canvas)
- BlockNote block editor: rich text, headings, lists, toggles, embeds.
- Nested page tree with dnd-kit drag-reorder.
- Databases embeddable inline in any page.
- Never forces a blank start: templates, describe-to-build, and pre-populated starters all available — blank is a choice, not a hazing ritual.

### 5.2 Native-feeling entry points (one kernel underneath)
- **Tasks** (sidebar): opens the default Task database directly in board/list view. Feels like a task app; is a database. Priorities, statuses, due dates work with zero configuration.
- **Calendar** (sidebar): renders every date-carrying record across the workspace plus Google Calendar events (via integration) in one calendar. Creating an event creates a record; there is no sync problem because there are never two systems. Ships with **one clean calendar view in V1** — selectable visual skins (Sunsama-style / Google-style / Notion-Calendar-style) are a **post-V1 fast-follow**, not V1 scope.
- **Files** (sidebar): a Documents database. Uploads (Supabase Storage) are records — searchable, taggable, relatable to tasks/projects. Every file automatically becomes a **source** for Planevo AI. V1 file features: upload, organize, attach, preview. The full NotebookLM-style Q&A layer lives in Planevo AI (§5.4) and ships in Phase 5.
- **Workspace** (sidebar): the open canvas where all of the above already lives and can be freely rearranged.

### 5.3 The eight "always easier" mechanics
These are ongoing-ease features (not onboarding tricks) that make the fiftieth workspace as fast as the first. All eight are committed; build order is tiered:

**Tier 1 — built into the kernel from the start (data-model level):**
1. **Retroactive structure** *(the flagship identity feature)*: any written text/bullets can be promoted into records or a whole database after the fact ("make this a task list" → records, properties, views appear around existing content). Structure as enhancement, never homework. Must be designed into how blocks and records relate before the editor is built.
2. **Born-with-views:** creating a database never yields a bare table. Task DBs are born with board+list+calendar views, sensible statuses, default sort; Notes DBs with gallery+recent list. Users delete what they don't want instead of building what they do. Pure code, zero AI.
3. **Duplicate-and-strip:** any database/page re-instantiates as a clean skeleton (same properties/views/layout, no records) via first-class right-click action. "Your fourth project is the template for your fifth."

**Tier 2 — layered on once kernel is stable:**
4. **Natural-language quick capture:** "Physics homework friday 6pm #school" parsed deterministically (date/time/target database inferred) — no LLM, zero marginal cost, works in a global quick-add input.
5. **Typed import:** Notion import + CSV/Drive/Canvas ingestion lands *organized* — columns mapped to property types, dates recognized, files landing as sources. Bar: "works the moment it arrives, nothing to define."

**Tier 3 — the silent-noticing layer (needs real usage data; built last by design):**
6. **Structure detection:** quiet, dismissible, non-modal suggestions when repetition is detected ("these three similar pages could be one Projects database — convert?"). Heuristics first; small model calls only when heuristics are confident. Never nags.
7. **Cross-database autolinking:** when a record's text mentions another record's name, quietly offer the relation link. String-matching heuristics cover the base case; no LLM required.

**Flagged for careful design (build after Tier 2, deliberately):**
8. **"Is-a" object types** (Tana-supertag-style): typing `#task` anywhere makes that line a Task with inherited fields, joining the right database. **Open design question:** which database does `#task` route to when multiple task databases exist? Likely answer: a "default database per type" workspace setting. If it fights the kernel, features #1+#4 together cover most of its job — this is the only one of the eight allowed to be dropped if necessary.

### 5.4 Planevo AI (the visible AI surface)
A full chat workspace (Sana-style presence — welcoming, first-class, optional), NOT a buried command bar and NOT the app's front door.

**Capabilities:**
- Answer questions grounded in the user's workspace + uploaded file sources, with citations (the NotebookLM feature set: multi-document Q&A, study cards, cross-document summaries).
- Web search.
- Write reports, decks, essays grounded in the user's files.
- Create/edit tasks, calendar events, pages, databases, views, records.
- **Describe-to-build:** generate an entire workspace/database from a one-line description — always rendered as an editable **preview** (mock table with real property types + example rows) that the user can rename/edit inline before confirming. When output is wrong, the fix path is the same natural-language loop; the schema editor underneath remains for builders.
- Rich in-chat rendering (diagrams, tables, formatted documents).
- **Template/workspace design generation:** trained/prompted on **original Planevo-made template designs only.** ⚠️ **Hard rule: never train on or ingest paid third-party Notion templates — IP risk, permanently prohibited.** Image assets for templates may be generated via image APIs (e.g., Gemini image generation).

**Model strategy (multi-model, tiered):**
- One gateway (OpenRouter or Vercel AI Gateway) + Vercel AI SDK. Never four direct SDK integrations.
- Free: auto-routed cheap models only (DeepSeek/Kimi/GLM-class). No model picker.
- Plus: mid-tier models + auto-routing.
- Pro: frontier models (Anthropic, OpenAI, Gemini, xAI) with pick-your-model, plus auto.
- No custom API-key BYOK in V1.

### 5.5 Agents
Sana-style agent **builder** open to every user from day one (not a locked template gallery — confinement kills exploration). Builder flow, four steps:
1. **Persona** — name, icon, description, custom instructions.
2. **Knowledge** — which pages, databases, files, integrations this agent can see (scoped).
3. **Workflows** — what it may do and on what trigger (manual invoke, on-schedule, on-event e.g. "new file uploaded").
4. **Visibility** — where it appears.

Plus a **first-party agent template library** (built by Planevo) for one-click users: e.g., Daily Digest (what's due today, from your own data), Weekly Review (done vs. planned), Workspace Cleanup (propose-only auditor). These three are the launch set — patterns validated by the top of Notion's agent-marketplace usage data (scheduled digests dominate real usage).

**Permission & safety model (applies to ALL agent and AI actions):**
- Pattern: **propose → confirm → execute → audit log.**
- Tier 1 auto-execute: single-record create/edit within an explicitly open/invited context.
- Tier 2 confirm required: any schema change (create/delete database or property), any bulk operation (>1 record), any delete.
- Tier 3 hard-blocked in V1: cross-workspace actions; anything touching billing/auth.
- Every action writes to `agent_actions` (visible, plain-language audit trail — a trust feature, not just debugging).
- Scheduled agent jobs run via Inngest/Trigger.dev; reads are free-form, writes still require stored user confirmation rules.

### 5.6 Integrations
- **Composio is the integration infrastructure** — built as real working infra in V1 (managed auth, tool-calling loop). One API surface, never N direct OAuth implementations.
- **V1 ships exactly 4 live integrations:** Gmail, Google Calendar, Google Drive, Canvas LMS.
  - Canvas is included specifically for the founder's own student use (honest founder-personal-use rationale, not persona-fit rationale).
  - Gmail/Calendar justified by evidence: email digest + calendar agents are the most-used agent categories in Notion's marketplace data.
- **Deferred to demand-driven fast-follow:** Slack, Monday.com, Linear, GitHub — added when real users ask, which the existing Composio plumbing makes fast (weeks, not months).
- ⚠️ Pre-launch verification: Gmail restricted OAuth scopes normally require Google security verification (slow for solo devs). Confirm exactly how Composio's managed auth handles this before promising Gmail at launch.

### 5.7 Onboarding (the fused flow — Notion + Airtable + Linear patterns)
1. **One routing question** (Notion pattern): "What are you organizing?" — Work / Personal / School / Something else. One tap, no wizard.
2. **Land in a living workspace** (pre-population + Airtable's silent AI): user lands *inside* a working workspace matched to their answer — Tasks populated, Calendar wired, Notes page, Files area. Names and seed content silently adapted (a School user's board says Assignments/Exams/Readings). **No AI announcement, no sparkle buttons, no "personalize with AI" prompt** — any inference runs invisibly at fraction-of-a-cent cost. Everything editable in place.
3. **First tasks ARE the onboarding** (Linear pattern): the starter task board contains 4–5 real checkable items: Rename this workspace → Add your first real task → Drag it to Done → Connect Google Calendar → Import from Notion. Activation metrics fall out of this for free in PostHog.
4. **Describe-to-build lives where all AI lives:** present in the template picker as one option among "template / blank / describe it" — findable in ten seconds by those who want it, invisible to those who don't. Rate-limited on Free.

Onboarding path costs ≈ zero tokens per free signup by design.

### 5.8 Design & Brand
- **Aesthetic bar:** the Dribbble "Acme AI"/"Lumis" mockups' craft — premium spacing, card treatment (icon + title + one-line subtitle), dotted/grid background textures, restrained near-monochrome with one dark accent, soft-not-childish radii, confident type hierarchy. "Open it on a laptop in a cafe and look productive."
- **IA correction vs. those mockups:** they are agent-first ("Start Chat" as hero CTA); Planevo's home leads with the user's own workspace (recent pages, continue-where-you-left-off, entry-point cards). Agent reachable, never the front door.
- **Landing page embraces color;** in-app stays calm (paper+ink doing 90% of the work) with meaningful accents; a user-facing **minimal mode** setting mutes accent tokens.
- **Reference products for feel:** Wispr Flow, Sana Labs.
- **Proposed token system (PROVISIONAL — founder must see it rendered before committing):**
  - Colors: `paper` #F5F3ED · `ink` #1A1915 · `marigold` #E4A62F · `brick` #D14B32 · `meadow` #5E8A54 · `slate` #93A9BB. Principle: the brand palette IS the illustration palette.
  - Type: Display = Sentient or Gambetta (Fontshare, landing headlines only) · UI/body = General Sans · Utility/data = Geist Mono.
- **Illustration system:** colorful flat geometric vector (Darya Semenova–inspired GENRE, never her actual images — style isn't copyrightable, images are). Path: prototype with Recraft.ai now → commission an artist before launch (est. few hundred–low four figures) for an owned 6–10 piece set + character guide. Distinct from Notion's B&W sketch style by genre.
- **Brand signature law:** *line art = structure; filled color = your life and work.* Applies to illustrations, logo, and UI moments (empty database renders as faint line-art scaffolding that fills with color as records arrive). Landing hero: a figure in motion carried by hairline structure (the "cyclist" concept).
- **Mascot:** no AI-chatbot persona (Bruno is permanently dead). Notion-adjacent illustrated-people warmth, in Planevo's own colorful vector genre.
- **Logo:** minimal line-art mark obeying the signature law, generated via Recraft + refined; must survive at 16px. Wordmark: General Sans, lowercase.

---

## 6. Pricing, Credits & Economics

### 6.1 Tiers
| | Free | Plus $10/mo | Pro $20/mo |
|---|---|---|---|
| Workspace kernel (all views, templates, all 8 ease features) | Full | Full | Full |
| AI credits/mo (internal currency) | ~100 | ~1,500 | ~5,000 (fair-use) |
| Models | Auto-routed cheap only | Mid-tier + auto | Frontier + pick-your-model |
| Describe-to-build | Few/month | Regular | Effectively unlimited (fair-use) |
| Agents | 1 active, templates only | 3–5 active, full builder | Unlimited-ish + scheduled workflows |
| Integrations | 1 connection | All 4 | All 4 + priority new |
| File sources | ~50MB | ~1–5GB | ~10GB+ |

**Principle: the workspace itself is never paywalled.** Charge for AI horsepower and automation. Founder accepts early losses; prices adjust with real data. First lever if economics tighten: make Plus more tempting (margin lives there), not shrinking Free.

### 6.2 Credit system (applies to Planevo AI + agents, one shared pool)
- Every AI action burns credits. Multiplier = (model's real token cost ÷ cheapest model's cost), so margin per credit is identical across models; Pro users choosing frontier models cannot wreck unit economics.
- Cheap message = 1 credit; frontier message = 5–10; heavy agent workflow = 20+.
- **Free users never see numbers** — ChatGPT-style: "you've reached your AI limit, resets Tuesday." No meter, no anxiety.
- **Plus/Pro see a simple meter.**
- "Unlimited" always means generous soft cap / fair use. Never literal.
- Hard ceiling by construction: max token spend = users × cap × cost-per-credit.

### 6.3 Cost ledger
**Fixed (monthly):** Supabase Pro $25 + Vercel Pro $20 + domain ~$2.50 → **~$50 at launch**, growing to ~$150/mo around 1k users as Resend (~$20), Upstash (~$10), Sentry (~$26), Inngest (~$20), Composio (verify pricing) exit free tiers. PostHog free to 1M events.
**Variable per user:** Free ≤ $0.25/mo (capped); Plus ~$2.50/mo; Pro ~$6/mo typical. Gateway adds ~5% on raw token prices. Stripe: 2.9% + $0.30/transaction.
**Founder personal dev costs:** Cursor ~$20 + Claude ~$20 + ChatGPT ~$20 ≈ $40–60/mo. Apple Developer $99/yr deferred (no mobile V1).
**One-time/later:** Nevada LLC ~$425 (+~$350/yr) around the time real money flows; lawyer consult pre-launch.

### 6.4 Scenarios (Plus $10 / Pro $20)
| Scenario | Revenue | Costs (tokens+infra) | Profit/mo |
|---|---|---|---|
| Fear case: 500 free / 15 Plus / 5 Pro | $250 | ~$260 | ≈ breakeven |
| Modest: 1,000 free / 40 Plus / 15 Pro | $700 | ~$540 | ≈ +$160 |
| Healthy: 2,000 free / 100 Plus / 40 Pro | $1,800 | ~$1,140 | ≈ +$660 |

Breakeven ≈ 10 paying users against launch fixed costs. Freemium conversion industry norm: 2–5% — the model needs volume, not a better rate. Free users are capped-cost marketing (the Notion/Figma playbook). Track **cost-per-user per tier in PostHog from day one.**

### 6.5 Template marketplace (phased — NOT V1)
1. **V1:** free first-party template library (8–12 excellent templates) as an adoption weapon. No paywall.
2. **Once real user base exists:** premium first-party template **drops** at $2–10 (quality drops when ready — never a weekly-cadence promise; a weekly treadmill produces filler and is incompatible with solo building).
3. **Future phase:** open marketplace — users publish/sell templates and agents, Planevo takes a cut. Requires trust/review layer + legal review of money flows first.

---

## 7. Technical Architecture

### 7.1 Monorepo (web-first — the settled answer to "build once, expand easily")
Rationale: Planevo's heart is a Notion-grade block editor; all serious block-editor libraries (BlockNote/TipTap/ProseMirror) require the browser DOM (`contenteditable`, selection APIs). Building that natively in React Native is famously brutal (Notion itself wrapped web views for years). Therefore:

```
planevo/
├─ apps/
│  ├─ web/        Next.js App Router + TS strict + Tailwind  ← THE product
│  ├─ desktop/    Tauri wrapping the web app (Mac/Windows, weeks not months)
│  └─ mobile/     Expo/React Native, added later; block editor via web view initially
├─ packages/
│  ├─ core/       Platform-agnostic: types, API client, Supabase queries,
│  │              agent tool definitions, state, validation (~60–70% of real code)
│  └─ api/        Next.js API routes + Supabase edge functions serving every client
```

### 7.2 Final tech stack
| Layer | Choice | Notes |
|---|---|---|
| Frontend | Next.js App Router, TypeScript strict, Tailwind | |
| Editor | BlockNote (+ dnd-kit page tree) | Proven in prior build |
| Backend/DB/Auth/Storage | Supabase (Postgres, Auth, RLS, Storage) | **WorkOS CUT** — enterprise SSO only when enterprise exists |
| AI | Vercel AI SDK + gateway (OpenRouter or Vercel AI Gateway) → Anthropic, OpenAI, Gemini, xAI + cheap open models | One key, one bill, unified routing. Never 4 direct SDKs |
| Integrations | Composio | Managed auth + tools; Gmail/GCal/Drive/Canvas |
| Background jobs | Inngest or Trigger.dev (+ pg_cron for trivial crons) | Required for scheduled agents |
| Email | Resend | Transactional |
| Rate limiting/cache | Upstash Redis | Protects free tier from abuse |
| Payments | Stripe | ⚠️ Minor/entity issue must be resolved first (§9) |
| Analytics / Errors | PostHog / Sentry | Cost-per-user instrumentation day one |
| Hosting / VCS / Design | Vercel / GitHub / Figma | |
| Image gen | Gemini image API ("nano banana") for original template artwork | |
| Dev tools | Cursor, Claude Code, Codex — **pick ONE primary driver**; others are second opinions | Three-tool ping-pong causes architectural drift |

### 7.3 Old Planevo carryover
Fresh repo; only concepts carry over: the propose→confirm→execute→audit pattern (from old `executeAction.ts`), BlockNote + dnd-kit as chosen libraries, the name/domain. Everything else (Bruno persona, calendar-canonical data model, old onboarding, old task state machine) is dead.

---

## 8. Roadmap — Phases

Planevo V1 is scoped as a focused **12–16 week build** using Cursor, Codex, and Claude Code. The phases below define build order and gates, not fixed calendar deadlines.

- **Phase 0 — Foundation:** monorepo scaffold, Supabase schema + RLS, design tokens in Figma, logo v1, landing page + waitlist live.
- **Phase 1 — Kernel:** pages/blocks editor, database CRUD, properties, records, table view. *Gate: founder can build a real database by hand.*
- **Phase 2 — Views & Ease Tier 1:** board/calendar/list views, born-with-views, duplicate-and-strip, retroactive structure v1, 4 starter templates. **Dogfood Gate #1:** founder moves his real life into Planevo and does not advance until he'd rather use Planevo than Notion/Todoist for his own tasks.
- **Phase 3 — Planevo AI + credits:** gateway, chat surface, describe-to-build preview flow, credit system + tiers (no Stripe yet), NL quick capture.
- **Phase 4 — Agents + integrations:** agent builder (4-step), first-party agent library (Daily Digest, Weekly Review, Cleanup), Inngest scheduled jobs, Composio: Gmail, GCal, Drive, Canvas.
- **Phase 5 — Import, onboarding, files-AI, polish:** Notion/typed import, onboarding fusion, NotebookLM-style file Q&A, structure detection + autolinking v1, minimal mode.
- **Phase 6 — Beta & Launch:** 10–20 closed-beta users, waitlist to 500, Stripe + LLC/legal resolution, Product Hunt launch.

### 8.1 Post-V1 expansion (committed order, demand-gated)
1. **Fast-follow wave 1:** formulas + rollups; calendar view skins; bidirectional relations; next 2 integrations by user vote (likely GitHub/Linear given beachhead).
2. **Wave 2:** premium template drops; "is-a" object types (if design resolves); Slack/Monday integrations; mobile app (Expo, web-view editor).
3. **Wave 3:** team collaboration (shared workspaces, permissions, presence, conflict resolution — a distinct architecture project, never bolted on casually); desktop apps via Tauri earlier if demand.
4. **Wave 4:** open marketplace (templates + user-published agents, revenue share); enterprise features (then WorkOS returns).

---

## 9. Trust, Legal & Compliance

**"You are in charge" — concrete commitments:**
- Full data export anytime, open formats (Markdown + JSON, mirroring what import accepts).
- Every agent action visible and reversible (plain-language audit log in-product).
- Manual parity: anything AI can do, a human can do by hand — checked per feature shipped.
- No training on user data without explicit opt-in — stated plainly wherever AI is discussed.
- **Not promised in V1:** local-first/offline (CRDT-scale project). Keep out of marketing copy.

**Legal flags (pre-launch checklist, not optional):**
1. Founder is a minor; Stripe requires 18+ — resolve via properly structured entity/guardian arrangement + lawyer consult BEFORE the Stripe integration is built (Phase 6 blocker).
2. Nevada LLC (~$425 + ~$350/yr) around the time real money flows.
3. Never train on paid third-party templates (restated because it will be tempting).
4. Marketplace revenue-share phase requires its own legal review of money flows.
5. Privacy Policy / Terms / Cookie Policy must be consistent (prior build had advertising boilerplate contradicting the no-advertising cookie policy — do not repeat).

---

## 10. Success Metrics
- **North star:** a new user reaches a genuinely useful, personalized workspace in **< 5 minutes without a tutorial** (measured via onboarding-task completion in PostHog).
- Activation: % completing the Linear-style starter tasks.
- Dogfood gate: founder's own daily use (binary, honest).
- Retention: D7/D30 of beta cohort.
- Economics: cost-per-user per tier, weekly; conversion to paid (expect 2–5%).
- Launch: 500 waitlist pre-launch; Product Hunt day performance.

## 11. Non-Goals (V1) — restated to prevent relitigating
No team collaboration/permissions · no custom LLM/BYOK · no workflow-automation canvas · no enterprise pricing/SSO · no meeting-notes product · no full mobile app · no open marketplace · no formulas/rollups at launch · no local-first promise · no calendar skins at launch · no competitor comparisons in marketing · no weekly-template-cadence promise · no more than 4 integrations at launch · no second AI surface beyond Planevo AI + inline previews.
