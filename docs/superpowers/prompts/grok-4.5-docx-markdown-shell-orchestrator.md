# Grok 4.5 + Composer 2.5 — DOCX/PDF Markdown Shell (Not Google Docs)

> **Paste the prompt below into Cursor.** Both models write code — Grok 4.5 and Composer 2.5 are
> peer implementers, not chair and workers. Whichever model you paste into runs the fan-out and
> takes work items itself. Everything under "Reference" is what the sub-agents need to actually do it.

---

## THE PROMPT

```
The DOCX surface in Planevo Files currently renders as a Google Docs clone — File/Format/Insert
menubar, rulers, Arial toolbar, white page canvas from @eigenpal/docx-editor-react. That is the
WRONG product. Rip it out.

Replace it with Planevo's own markdown + live-preview editing shell — the same craft as our shipped
text/markdown editor (CodeMirror source, sanitized ReactMarkdown preview, split pane, selection bubble
toolbar, calm Files chrome). When a user uploads a .docx or opens one from disk, they edit inside
THIS shell, and saves go back to that exact same document (same file_sources row + storage object when
hosted, same file on disk via File System Access API when local) — never a separate derived copy,
unless the user explicitly chooses "Save a copy." Autosave, recovery-before-overwrite, version
conflict honesty, flush-on-close, and dual-destination save-a-copy from the prior DOCX rescue still
matter. The editing chrome must NOT be Google Docs.

Quality bar: industry golden standard for markdown split-pane editing inside Planevo's design system
— NOT "clone Google Docs," NOT "bit-identical OOXML WYSIWYG round-trip." The honest bar is: (1) the
shell looks and behaves like our markdown editor at /files, (2) edited content saves back to the
same .docx without silent data loss, (3) conversion limits are surfaced honestly when Word fidelity
cannot be preserved. This is a data-integrity feature: every defect class ends with a real person
losing a real document. Treat silent data loss as the worst possible outcome.

Fan out sub-agents and have sub-agents tackle each one individually. Use Grok 4.5 AND Composer 2.5
as peer implementers — both models write code, one agent per work item, each owning an exclusive set
of files so two agents never edit the same file at once. Send reasoning-dense items (DOCX↔markdown
conversion, autosave coordinator, transport validator, fidelity harness) to Grok 4.5; send
multi-file repo edits, shell wiring, and token/UI work to Composer 2.5. /loop on each item and have
a separate sub-agent check it via the real artifact — the running app in a browser with screenshots
in both light and dark themes, plus node:test on every pure-logic module. That critic must verify by
executing commands, never by reading the implementer's claims, and its default posture is rejection.
Always review across models — whatever Grok 4.5 wrote gets a Composer 2.5 critic and whatever
Composer 2.5 wrote gets a Grok 4.5 critic. If it doesn't clear the bar, keep going.

The anti-goal screenshot (Google Docs clone to REMOVE, not copy):
/Users/jabbo/.cursor/projects/Users-jabbo-PLANEVO/assets/image-b1bbd21d-3e77-4eb6-ab10-8a9e2a82a2c0.png

The craft target is our own markdown editor shell — split source + preview, bubble toolbar, Files
chrome — as rendered in apps/web/app/design/files-editor-preview.tsx and
features/files-product/text-document-editor.tsx. "Liquid glass" in the founder's inspo means calm
translucent editor surfaces via Planevo tokens (--color-files-editor-glass, --color-files-editor-solid),
NOT the liquid-glass-react package (banned except calendar popover), NOT Apple Liquid Glass gimmicks,
NOT vendor Google-blue chrome. Flat, calm, premium. No gradients, heavy shadows, or glow.

Do this in Next.js App Router + TypeScript strict + Tailwind with Planevo's CSS-custom-property
design tokens, Supabase (hosted project aixvpsmpiucticxutngp) for storage and the version
compare-and-swap RPC, node:test for all pure logic. Never hardcode a hex, font name, or arbitrary
pixel value. Pure logic lives in apps/web/lib/<domain>/ with colocated *.test.mjs; components wire
props to lib and own no business rules. No `any`. Work in the main checkout at /Users/jabbo/PLANEVO,
never a worktree. Do NOT apply the database migration — the founder applies it by hand via the hosted
SQL Editor.

Do NOT mount @eigenpal/docx-editor-react DocxEditor in the product UI. If you need eigenpal at all,
use @eigenpal/docx-editor-core headless conversion only — and only after confirming the installed
version exports what you need. The react adapter is WYSIWYG-only; it has no markdown+preview mode.

/loop until it's utterly perfect. Fan out sub-agents and ultracode.
```

---

# Reference

Everything below is context the orchestrator and sub-agents need. Point them at this file.

## Read first, in this order

1. `AGENTS.md` — inviolable rules. This is what the harsh critics enforce.
2. `tmp/docx-audit-findings.md` — **40 findings (8 P0 / 15 P1 / 17 P2)**. Already produced; never
   re-run the audit. **Skip vendor-theming P0s #5–8** if the WYSIWYG surface is removed; re-apply
   any finding that still applies to the markdown shell path.
3. `tmp/docx-editor-resume.md` — current state and baselines.
4. `docs/design-brief.md` — token names.
5. `apps/web/app/design/files-editor-preview.tsx` — craft reference for the markdown shell (split,
   bubble, glass tokens).
6. `features/files-product/text-document-editor.tsx` — the shell to reuse or extract.

Then verify against disk before trusting any of it:

```bash
cd /Users/jabbo/PLANEVO && git status --short && git diff --stat
```

## Founder pivot — what changed since the prior orchestrator

The prior prompt (`grok-4.5-docx-editor-orchestrator.md`) wired `@eigenpal/docx-editor-react` as the
**editing surface** and chased Google Docs / OOXML byte-fidelity parity. **That direction is
revoked.** The founder does not want a Google Docs clone.

| Prior orchestrator | This orchestrator |
|---|---|
| `@eigenpal/docx-editor-react` WYSIWYG as the editor | Planevo markdown + preview shell |
| OOXML bit-identical round-trip bar | Honest content save into a valid `.docx` package |
| Theme vendor `.ep-root` / `colorMode` | Theme Planevo Files editor tokens only |
| Blind package diff vs original | Content-level fidelity + honest conversion warnings |
| Quality bar = "Google Docs opening Word" | Quality bar = Planevo markdown editor craft + save-back integrity |

## Anti-goal vs craft target

**Anti-goal** (remove this — screenshot for critics):

`/Users/jabbo/.cursor/projects/Users-jabbo-PLANEVO/assets/image-b1bbd21d-3e77-4eb6-ab10-8a9e2a82a2c0.png`

Shows: File/Format/Insert menubar, horizontal + vertical rulers, Arial 11 toolbar, white page slab,
vendor Google-blue chrome. Automatic FAIL if any of this ships.

**Craft target** (build this):

- `text-document-editor.tsx` — split pane (source left, sanitized preview right), draggable divider,
  Document / Markdown / Split view toggles in panel header.
- `markdown-bubble-toolbar.tsx` — selection-anchored formatting; no persistent Word toolbar.
- `globals.css` — `.files-editor-shell`, `--color-files-editor-glass`, `.files-doc-prose`,
  `.files-bubble` tokens. Glass = `color-mix` on paper/ink, not `liquid-glass-react`.

## Liquid glass ↔ Planevo token law (explicit reconciliation)

The founder cited "liquid glass markdown + preview" from the eigenpal/docx-editor ecosystem. **That
is not a mode in the installed package.** `@eigenpal/docx-editor-react@1.9.0` is WYSIWYG-only
(toolbar, rulers, paged canvas). A markdown playground exists upstream (eigenpal PR #595,
`@eigenpal/docx-editor-core/markdown` with `toMarkdown`) but is **not exported in the installed
1.9.0 core** — do not assume it is on disk; verify `node_modules/@eigenpal/docx-editor-core/package.json`
exports before importing.

Translate the inspo craft into Planevo law:

| Inspo craft | Planevo implementation |
|---|---|
| Split markdown + preview | Reuse `text-document-editor.tsx` split layout; default DOCX opens in **Split** |
| Calm translucent surfaces | `--color-files-editor-glass` / `--color-files-editor-solid` tokens |
| No Word chrome | No menubar, rulers, page canvas, or vendor portals |
| Premium flat | AGENTS.md: no gradients, heavy shadows, glow |
| `liquid-glass-react` | **Do not use** — repo bans it except calendar popover exception |

## Eigenpal / inspo repo note

Founder cited `github.com/superdoc/docx-editor.git` — that org path does not exist. Installed
package is `@eigenpal/docx-editor-react` from `github.com/eigenpal/docx-editor` (docx-editor.dev).
Same path shape; eigenpal is what was meant.

**Installed capabilities (1.9.0):**

- `@eigenpal/docx-editor-react` — React WYSIWYG adapter only. **Remove from product UI.**
- `@eigenpal/docx-editor-core` — headless OOXML parse/serialize, prosemirror pipeline. Usable for
  conversion if needed; no `/markdown` subpath in 1.9.0.
- `mammoth` (already in `apps/web/package.json`) — DOCX → HTML/Markdown extraction. V1 import path.

## This is a shell swap + rescue, not a greenfield build

~1,400 lines of DOCX save-back infrastructure already exist uncommitted in the main checkout. The ZIP
validator, recovery-before-overwrite ordering, version CAS, autosave coordinator, and API raw-bytes
protocol are production-grade. **Do not start over.** Swap the editing surface; keep the save paths.

### Keep (do not rewrite)

| Module | Why |
|---|---|
| `docx-document-transport.ts` | Structural ZIP validator on save (fix P0 ratio guard, keep entry/byte caps) |
| `lib/files/docx-autosave.ts` | Edit-generation coordinator, recovery-before-save ordering |
| `document-recovery.ts` + `document-recovery-writer.ts` | IndexedDB drafts; wire `writeStrict` |
| `docx-save-copy.ts` + panel `DocxSaveCopyMenu` | Native picker + Planevo Files copy |
| `api/product-files/[id]/document/route.ts` | Raw GET/PUT bytes + version headers |
| `local-document-state.ts` (+ test) | Local disk state machine — implement, de-orphan |
| `local-file-mirror.ts` / `local-file-repository.ts` | Local write-back |
| `supabase/migrations/20260731061347_finalize_docx_document.sql` | Version CAS RPC (founder applies) |
| `document-descriptor.ts` | `docx` in editable formats |

### Remove / replace

| Module | Action |
|---|---|
| `docx-editor-vendor.tsx` | **Delete** or reduce to a thin conversion helper — no `DocxEditor` mount |
| `@eigenpal/docx-editor-react` + `styles.css` import | **Remove dependency** once nothing imports it |
| `docx-document-editor.tsx` vendor session | **Replace** body with markdown shell; keep status/conflict/recovery wiring |
| Vendor theming P0s (#5–8 in audit) | **N/A** once vendor UI is gone — do not spend cycles theming Google chrome |
| `read-only-document-viewer.tsx` mammoth path for docx | Already dead for open path; delete dead code (audit P2) |

### Reuse

| Module | How |
|---|---|
| `text-document-editor.tsx` | Extract shared split editor or pass `format="markdown"` with imported content |
| `markdown-bubble-toolbar.tsx` | Formatting affordances |
| `lib/files/markdown-commands.ts` | Bubble commands |
| `document-editor-panel.tsx` | Header chrome, view-mode toggles — **show Split/MD/Document for DOCX too** |
| `useResolvedTheme()` from `planevo-editor.tsx` | Theme hook if needed |

## Editing model (founder decision — do not re-ask)

**Markdown source + live preview (split pane default).** Not OOXML WYSIWYG. The user edits markdown
in CodeMirror; preview renders sanitized GFM beside it. Optional Document view (live preview in
editor) matches existing markdown files. Bubble toolbar on selection — never a Word menubar.

## DOCX round-trip strategy (founder decision — do not re-ask)

**Honest content save, not bit-identical OOXML.**

### Import (DOCX → markdown)

1. **V1:** `mammoth` `convertToMarkdown` (or `extractRawText` fallback) on open. Surface conversion
   warnings in a calm banner ("Some formatting may not carry over").
2. **Upgrade path:** When `@eigenpal/docx-editor-core/markdown` ships on npm, swap import to
   `toMarkdown` with image map handling — same shell, better fidelity.

Store the imported markdown in editor state. Optionally cache `importWarnings: string[]` in session.

### Export (markdown → DOCX bytes)

1. **V1:** Build a valid `.docx` package containing the edited markdown content as structured OOXML
   body text (headings, lists, bold/italic/links/tables where the exporter supports them). Accept
   that styles, headers/footers, comments, tracked changes from the original may not round-trip —
   **say so in UI**, do not silently drop without notice.
2. Implementation options (pick the smallest that passes tests):
   - Headless `@eigenpal/docx-editor-core` prosemirror pipeline if a markdown→doc path exists in core.
   - Minimal OOXML generator in `lib/files/docx-export.ts` (paragraphs, runs, basic styles).
   - Package surgery: keep `[Content_Types].xml`, `_rels`, `word/styles.xml` from original when
     possible; replace `word/document.xml` body from markdown — preserves more shell fidelity for
     simple edits.
3. **Serialize contract:** `docx-document-editor.tsx` exposes `serialize(): Promise<Uint8Array>` to
   the autosave coordinator — same interface as today, different implementation (markdown→bytes,
   not `editor.save()` from vendor).

### Fidelity harness reframe

`lib/files/docx-fidelity.ts` stays, but the bar changes:

- **Pass:** exported package is structurally valid; `word/document.xml` contains the edited text
  content; no required parts missing; autosave does not corrupt the archive.
- **Packaging drift** (recompression, editor metadata parts) is acceptable.
- **Fail:** silent loss of user-edited paragraphs, empty document body, or invalid ZIP.
- Drop blind "which package is the degraded copy" against Google Docs. Replace with content assertions
  on fixtures in `tmp/docx-fixtures/`.

## PDF scope (founder decision — do not re-ask)

**V1 boundary: PDF is preview-only, not markdown-editable.**

- Opening a `.pdf` stays the read-only iframe path (`read-only-document-viewer.tsx`).
- PDF cannot round-trip through markdown without a heavy extraction pipeline; do not pretend otherwise.
- If the founder later wants "Edit copy as Planevo document," that is a **Save a copy** flow
  (new `.md` or `.docx` entry) — out of scope unless explicitly added.
- Do not block this orchestrator on PDF editing.

## Task 1 is a gate

If `document-editor-panel.tsx` still has unstable `onSaveStateChange`/`onFlushReady` inline arrows,
opening any `.docx` throws "Maximum update depth exceeded." **Fix or verify this is already fixed
before any browser QA.** No visual claim is valid while Task 1 is open.

## Work items, model, and exclusive file ownership

Both models implement. Grok 4.5 = pure logic / conversion / coordinator. Composer 2.5 = shell / panel
/ tokens / browser QA. **Critic is always the other model.**

| # | Item | Implementer | Critic | Owns exclusively | After |
|---|------|-------------|--------|------------------|-------|
| 1 | **GATE** — render loop + docx opens | Composer 2.5 | Grok 4.5 | `document-editor-panel.tsx` (callback stability only) | — |
| 2 | **RIP VENDOR** — remove WYSIWYG surface | Composer 2.5 | Grok 4.5 | `docx-editor-vendor.tsx` (delete), remove `@eigenpal/docx-editor-react` import from editor | 1 |
| 3 | **MARKDOWN SHELL** — split editor for DOCX | Composer 2.5 | Grok 4.5 | `imported-document-editor.tsx` (new) OR extend `text-document-editor.tsx`; `docx-document-editor.tsx` body | 2 |
| 4 | DOCX→MD import | Grok 4.5 | Composer 2.5 | `lib/files/docx-import.ts` (+test), wire open path | 1 |
| 5 | MD→DOCX export | Grok 4.5 | Composer 2.5 | `lib/files/docx-export.ts` (+test), fixtures | 4 |
| 6 | Wire serialize → autosave coordinator | Grok 4.5 | Composer 2.5 | `docx-document-editor.tsx` adapters, `docx-autosave.ts` P0 fixes | 3, 5 |
| 7 | Recovery + conflict + state machine | Grok 4.5 | Composer 2.5 | `document-recovery-writer.ts` wire, `local-document-state.ts`, `local-document-content.ts`, `local-file-repository.ts` | 6 |
| 8 | Transport + API P0/P1 | Grok 4.5 | Composer 2.5 | `docx-document-transport.ts`, `route.ts` guards | 5 |
| 9 | Save-a-copy both destinations | Composer 2.5 | Grok 4.5 | `docx-save-copy.ts`, `actions.ts`, panel header (if not already) | 6 |
| 10 | Panel chrome — view toggles for DOCX | Composer 2.5 | Grok 4.5 | `document-editor-panel.tsx` (markdown view group for docx) | 3 |
| 11 | Token / glass shell polish | Composer 2.5 | Grok 4.5 | `globals.css` (only if shell gaps found) | 3 |
| 12 | Fidelity harness reframe | Grok 4.5 | Composer 2.5 | `lib/files/docx-fidelity.ts` (+test), `tmp/docx-fixtures/` | 5 |
| 13 | Audit P1 sweep (non-vendor) | both, split by file | the other model | per finding in `tmp/docx-audit-findings.md` | 7–9 |
| 14 | PDF boundary doc + dead code | Composer 2.5 | Grok 4.5 | `read-only-document-viewer.tsx` cleanup | 2 |
| 15 | Browser QA, both themes | Composer 2.5 | Grok 4.5 | none (screenshots to `tmp/docx-qa/`) | all + migration applied |

**Parallelism:** 4 ∥ 2 after gate. 5→6→7 sequential. 10 ∥ 11 after 3. 13 last among code tasks.

Item 13: split P1s by owning file; never two agents in the same file.

## Automatic FAIL for the harsh critic

Spawn a **fresh critic in the other model** per item. Reject on sight:

- Any `DocxEditor` from `@eigenpal/docx-editor-react` mounted in product UI.
- File/Format/Insert menubar, rulers, or Word page canvas visible in DOCX editor.
- `@eigenpal/docx-editor-react/styles.css` imported in the app bundle after Task 2.
- A spec or test modified to make something pass. **Weakening `local-document-state.test.mjs` is the
  most likely cheat.**
- Any test skipped, renamed, commented out, or assertions loosened.
- A module left orphaned — imported only by its own test.
- Any `any`, TODO, placeholder, stub, or thrown "not implemented".
- Any raw hex, arbitrary `[13px]` value, or raw Tailwind default where a Planevo token exists.
- `liquid-glass-react` used in Files editor.
- Competitor names in UI.
- Success claimed without pasted command output or screenshots (items 15+).
- PDF claimed as fully editable with markdown round-trip.

Two consecutive FAILs on one item → hand to the **other** model with the critic's fix list. Then
escalate to founder.

## Verification gates

```bash
cd /Users/jabbo/PLANEVO && npm test
cd /Users/jabbo/PLANEVO/apps/web && npx tsc --noEmit
cd /Users/jabbo/PLANEVO/apps/web && node --experimental-strip-types --test features/files-product/local-document-state.test.mjs
cd /Users/jabbo/PLANEVO/apps/web && node --experimental-strip-types --test lib/files/docx-import.test.mjs lib/files/docx-export.test.mjs
```

Reconcile test counts explicitly after adding import/export tests.

Baselines (verify disk — may have moved since rescue doc):

- `npm test` → reconcile total; DOCX modules contribute ~27+ tests.
- `tsc` → exactly **1 pre-existing unrelated error** (`create-gesture-suppress.ts` Timeout).
- `npm run lint` — only NEW errors in touched files count.

### Browser QA checklist (item 15)

Hosted path needs migration applied (saves 500 until then — expected).

- [ ] Open `.docx` → **split markdown shell**, not Google Docs chrome (compare to anti-goal screenshot).
- [ ] Light + dark theme screenshots in `tmp/docx-qa/`.
- [ ] Edit markdown → autosave → reopen → content persisted.
- [ ] Local disk file → edit → saves back to same path.
- [ ] Save a copy → both destinations work.
- [ ] Conflict banner + recovery draft on crash simulation.
- [ ] Conversion warning banner when mammoth reports issues.
- [ ] PDF still opens as read-only preview only.

## The 7 promises — final critic traces each with evidence

a) Upload a `.docx`, click it → lands in the **markdown shell editor**, never read-only viewer, never
   Google Docs chrome.
b) Typing autosaves back to the **same** `file_sources` row + storage object.
c) A `.docx` opened from the computer writes back to that same file **on disk**.
d) "Save a copy" offers **both** destinations (computer + new DOCX in Planevo Files).
e) Closing the panel mid-edit saves **before** it closes.
f) A tab crash leaves a recovery draft that reopening actually **offers**.
g) A file changed elsewhere produces a real **conflict**, not a clobber.

## Founder decisions — do not re-ask

1. **Editing model:** Markdown source + live preview (split default). Not OOXML WYSIWYG.
2. **Chrome:** Planevo Files markdown shell. Not `@eigenpal` Google Docs UI.
3. **DOCX fidelity bar:** Honest content save into valid `.docx`; surface conversion limits. Not
   bit-identical OOXML / Google Docs parity.
4. **PDF V1:** Preview-only. No markdown edit round-trip.
5. **Migration:** Founder applies `supabase/migrations/20260731061347_finalize_docx_document.sql` by
   hand (project `aixvpsmpiucticxutngp`). **No agent applies it. No `supabase db push`. No Docker.**
6. **Scope:** Both save-back paths — hosted round-trip AND local-disk write-back.
7. **Save a copy:** Both destinations — native picker AND new DOCX in Planevo Files.
8. **Agents:** Grok 4.5 + Composer 2.5 only.
9. **Checkout:** `/Users/jabbo/PLANEVO` main checkout, never a worktree.
10. **Liquid glass:** Planevo token glass only; no `liquid-glass-react` in Files.

## Open questions (escalate to founder if blocked)

1. **Export strategy fork:** If neither mammoth reverse nor eigenpal headless can produce valid DOCX
   bytes in V1, prefer (A) package-surgery preserving original styles shell, or (B) clean minimal
   OOXML generator — pick A for fewer "my styles vanished" support tickets.
2. **Default view for DOCX:** Split vs Document — default **Split** unless founder says otherwise.
3. **Remove `@eigenpal/docx-editor-react` from package.json** once core-only conversion works — do
   not leave dead weight, but do not remove until grep shows zero imports.

## Boundaries

**Do:** swap shell, keep save paths, implement import/export, fix non-vendor P0/P1s, browser QA both
themes, reframe fidelity harness.

**Do not:** mount vendor WYSIWYG; theme Google Docs chrome; chase OOXML bit-identity; claim PDF
markdown editing; apply migration; run `supabase db push` or Docker; create a worktree; use
`liquid-glass-react` in Files; hardcode hex; add competitor names in UI; commit without being asked.

## Current wiring (verify on disk)

```
document-editor-panel.tsx
  └─ format === "docx" → LazyDocxDocumentEditor
       └─ docx-document-editor.tsx (session: autosave, conflict, recovery)
            └─ docx-editor-vendor.tsx → DocxEditor (@eigenpal)  ← DELETE THIS PATH

text-document-editor.tsx
  └─ CodeMirror + ReactMarkdown split ← REUSE THIS PATTERN

read-only-document-viewer.tsx
  └─ pdf iframe; docx mammoth path dead ← cleanup
```

## Library note

`@eigenpal/docx-editor-react@1.9.0` — WYSIWYG only; **not the editing surface going forward.**
Upstream markdown export (`toMarkdown`) is newer than the installed core; use `mammoth` for V1 import
unless exports confirm `/markdown` on disk.
