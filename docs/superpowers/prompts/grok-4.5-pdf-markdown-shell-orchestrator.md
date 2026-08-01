# Grok 4.5 + Composer 2.5 — PDF Markdown Shell (Not Adobe Clone)

> **Paste the prompt below into Cursor.** Both models write code — Grok 4.5 and Composer 2.5 are
> peer implementers, not chair and workers. Whichever model you paste into runs the fan-out and
> takes work items itself. Everything under "Reference" is what the sub-agents need to actually do it.

---

## THE PROMPT

```
The PDF surface in Planevo Files currently renders as a read-only browser iframe — no editing, no
autosave, no save-back to the same file. That is the WRONG product for text-centric PDFs users expect
to annotate or lightly edit. Rip out the preview-only dead end for extractable-text PDFs.

Replace it with Planevo's own markdown + live-preview editing shell — the same craft as our shipped
text/markdown editor and the DOCX markdown-shell pivot (CodeMirror source, sanitized ReactMarkdown
preview, split pane, selection bubble toolbar, calm Files chrome). When a user uploads a text-based
.pdf or opens one from disk, they edit inside THIS shell, and saves go back to that exact same
document (same file_sources row + storage object when hosted, same file on disk via File System
Access API when local) — never a separate derived copy, unless the user explicitly chooses
"Save a copy." Autosave, recovery-before-overwrite, version conflict honesty, flush-on-close, and
dual-destination save-a-copy must match the DOCX rescue bar. The editing chrome must NOT be an Adobe
Acrobat clone, NOT a PDF.js toolbar skin, NOT Google Docs.

Quality bar: industry golden standard for markdown split-pane editing inside Planevo's design system
— NOT "clone Acrobat," NOT "bit-identical PDF layout round-trip." The honest bar is: (1) the shell
looks and behaves like our markdown editor at /files, (2) edited content saves back to the same .pdf
for text-extractable documents without silent data loss, (3) conversion limits are surfaced honestly
when PDF fidelity cannot be preserved (scanned/image PDFs, complex layouts, embedded fonts). This is a
data-integrity feature: every defect class ends with a real person losing a real document. Treat
silent data loss as the worst possible outcome.

Fan out sub-agents and have sub-agents tackle each one individually. Use Grok 4.5 AND Composer 2.5
as peer implementers — both models write code, one agent per work item, each owning an exclusive set
of files so two agents never edit the same file at once. Send reasoning-dense items (PDF↔markdown
extraction, autosave coordinator, transport validator, fidelity harness) to Grok 4.5; send multi-file
repo edits, shell wiring, and token/UI work to Composer 2.5. /loop on each item and have a separate
sub-agent check it via the real artifact — the running app in a browser with screenshots in both light
and dark themes, plus node:test on every pure-logic module. That critic must verify by executing
commands, never by reading the implementer's claims, and its default posture is rejection. Always
review across models — whatever Grok 4.5 wrote gets a Composer 2.5 critic and whatever Composer 2.5
wrote gets a Grok 4.5 critic. If it doesn't clear the bar, keep going.

The anti-goal is any third-party PDF chrome pasted into Files — Acrobat-style toolbars, annotation
palettes, page thumbnails sidebars, vendor blue chrome, or a bare iframe as the only editing surface
for text PDFs. The craft target is our own markdown editor shell — split source + preview, bubble
toolbar, Files glass tokens — as rendered in apps/web/app/design/files-editor-preview.tsx and
features/files-product/text-document-editor.tsx. "Liquid glass" in the founder's inspo means calm
translucent editor surfaces via Planevo tokens (--color-files-editor-glass, --color-files-editor-solid),
NOT the liquid-glass-react package (banned except calendar popover), NOT Apple Liquid Glass gimmicks,
NOT vendor chrome. Flat, calm, premium. No gradients, heavy shadows, or glow.

Do this in Next.js App Router + TypeScript strict + Tailwind with Planevo's CSS-custom-property
design tokens, Supabase (hosted project aixvpsmpiucticxutngp) for storage and the version
compare-and-swap RPC, node:test for all pure logic. Never hardcode a hex, font name, or arbitrary
pixel value. Pure logic lives in apps/web/lib/<domain>/ with colocated *.test.mjs; components wire
props to lib and own no business rules. No `any`. Work in the main checkout at /Users/jabbo/PLANEVO,
never a worktree. Do NOT apply any database migration — the founder applies it by hand via the hosted
SQL Editor.

/loop until it's utterly perfect. Fan out sub-agents and ultracode.
```

---

# Reference

Everything below is context the orchestrator and sub-agents need. Point them at this file.

## Read first, in this order

1. `AGENTS.md` — inviolable rules. This is what the harsh critics enforce.
2. `docs/superpowers/prompts/grok-4.5-docx-markdown-shell-orchestrator.md` — **sibling orchestrator**
   for DOCX. PDF reuses its shell swap + rescue patterns; do not re-invent autosave/recovery ordering.
3. `tmp/docx-audit-findings.md` — cross-read transport/recovery/conflict findings that apply to any
   binary document save-back path (not DOCX-specific).
4. `docs/design-brief.md` — token names.
5. `apps/web/app/design/files-editor-preview.tsx` — craft reference for the markdown shell.
6. `features/files-product/text-document-editor.tsx` — the shell to reuse or extract.
7. `features/files-product/read-only-document-viewer.tsx` — **current PDF V1** (iframe preview only).
8. `packages/core/src/files/document-descriptor.ts` — `pdf` format; today **not** in
   `isEditableDocumentFormat`.
9. `features/files-product/document-editor-panel.tsx` — routing: PDF falls through to
   `LazyReadOnlyDocumentViewer`.

Then verify against disk before trusting any of it:

```bash
cd /Users/jabbo/PLANEVO && git status --short && git diff --stat
```

## Founder pivot — what changed since preview-only PDF

| Prior state | This orchestrator |
|---|---|
| PDF opens in read-only `<iframe>` | Text-extractable PDFs open in markdown shell |
| No save-back path | Same-file autosave for hosted + local disk |
| `isEditableDocumentFormat` excludes `pdf` | `pdf` editable when import probe succeeds |
| No PDF libs in `package.json` | Add `pdfjs-dist` (extract) + `pdf-lib` (export) — justify in PR |
| Scanned PDFs silently useless | Honest banner + preview-only fallback |
| Quality bar = "browser can display PDF" | Quality bar = Planevo markdown craft + save-back integrity |

## Anti-goal vs craft target

**Anti-goal** (reject on sight):

- Full Acrobat/Preview chrome cloned into Files (toolbars, side panels, vendor colors).
- PDF.js default viewer UI mounted as the editing surface.
- Bare iframe as the **only** surface for a text PDF the user clearly expects to edit.
- Silent claim that layout/fonts/images round-trip through markdown.

**Craft target** (build this):

- `text-document-editor.tsx` — split pane (source left, sanitized preview right), draggable divider,
  Document / Markdown / Split view toggles in panel header.
- `markdown-bubble-toolbar.tsx` — selection-anchored formatting; no persistent PDF toolbar.
- `imported-document-editor.tsx` — pattern for binary→markdown shell (generalize or fork for PDF).
- `globals.css` — `.files-editor-shell`, `--color-files-editor-glass`, `.files-doc-prose`,
  `.files-bubble` tokens. Glass = `color-mix` on paper/ink, not `liquid-glass-react`.

## Liquid glass ↔ Planevo token law (explicit reconciliation)

Translate any "glass PDF editor" inspo into Planevo law:

| Inspo craft | Planevo implementation |
|---|---|
| Split markdown + preview | Reuse `text-document-editor.tsx` split layout; default PDF opens in **Split** |
| Calm translucent surfaces | `--color-files-editor-glass` / `--color-files-editor-solid` tokens |
| No Acrobat chrome | No page thumbnails rail, annotation toolbars, or vendor portals |
| Premium flat | AGENTS.md: no gradients, heavy shadows, glow |
| `liquid-glass-react` | **Do not use** — repo bans it except calendar popover exception |

## Current PDF path (verify on disk)

```
document-editor-panel.tsx
  └─ format === "pdf" (and docx/markdown/text/planevo handled above)
       └─ LazyReadOnlyDocumentViewer
            └─ read-only-document-viewer.tsx → <iframe src={previewUrl} />

document-descriptor.ts
  └─ format "pdf" from .pdf extension / application/pdf mime
  └─ isEditableDocumentFormat → false for pdf today

document-capabilities.ts
  └─ pdfAnnotations: true on paid plans (utility dock label only — not real editing yet)

lib/queries/product-files.ts
  └─ previewUrl = signed storage URL for iframe src
```

**There is no** `pdf-import.ts`, `pdf-export.ts`, `pdf-document-editor.tsx`, or raw-bytes PDF PUT
path in the API today. DOCX has all of these — **clone the architecture, not the OOXML specifics.**

## What DOCX already solved — reuse vs invent

### Reuse (generalize or thin-wrap — do not rewrite)

| DOCX module | PDF reuse |
|---|---|
| `imported-document-editor.tsx` | Extract shared `ImportedMarkdownShell` or fork `pdf-imported-document-editor.tsx` with same serialize contract |
| `lib/files/docx-autosave.ts` | Generalize to `document-bytes-autosave.ts` OR copy pattern into `pdf-autosave.ts` (same recovery-before-save ordering) |
| `document-recovery.ts` + `document-recovery-writer.ts` | Same IndexedDB draft shape for `Uint8Array` PDF bytes |
| `docx-save-copy.ts` + panel save-copy menu | Mirror as `pdf-save-copy.ts` — native picker + Planevo Files |
| `docx-document-transport.ts` | Mirror as `pdf-document-transport.ts` — structural PDF validator on save |
| `api/.../document/route.ts` raw GET/PUT | Extend for `?content=pdf` + `x-planevo-pdf-*` headers (parallel to docx) |
| `local-document-state.ts` | Same state machine for local PDF write-back |
| `local-file-mirror.ts` / `local-file-repository.ts` | Local disk write-back for PDF bytes |
| `document-editor-panel.tsx` | Route `format === "pdf"` to `LazyPdfDocumentEditor` when import probe passes |
| `finalize_docx_document.sql` | **Template** for `finalize_pdf_document` CAS RPC if hosted saves need it |

### Invent (PDF-specific)

| Module | Responsibility |
|---|---|
| `lib/files/pdf-import.ts` | PDF bytes → markdown via `pdfjs-dist` text extraction; scanned-PDF detection |
| `lib/files/pdf-export.ts` | Markdown → valid PDF bytes via `pdf-lib` (text-centric layout) |
| `lib/files/pdf-fidelity.ts` | Harness: exported PDF contains edited text; no corrupt xref |
| `pdf-document-open.ts` | Open probe: `{ kind: "editable" \| "preview-only", markdown?, warnings }` |
| `pdf-document-editor.tsx` | Session wiring: autosave, conflict, recovery, serialize hook |
| Migration SQL (founder applies) | Version CAS for PDF raw bytes if not already covered by generic path |

### Do not copy blindly

- DOCX package surgery (`docx-export.ts` ZIP/OOXML) — **does not apply** to PDF.
- `mammoth` — DOCX only; PDF uses `pdfjs-dist`.
- `@eigenpal/*` — DOCX only; not needed for PDF V1.

## PDF round-trip strategy (founder decision — do not re-ask)

**Honest content save, not bit-identical PDF layout.**

PDF→markdown→PDF is inherently lossy. V1 does not pretend otherwise.

### Import probe (PDF → markdown or preview-only)

1. Parse PDF with `pdfjs-dist` (worker in browser; Node build in tests).
2. **Text-extractable:** concatenate text items with paragraph heuristics → markdown-ish source.
   Surface warnings: "Some layout, images, and fonts may not carry over."
3. **Scanned / no extractable text:** `kind: "preview-only"` — keep iframe preview, show calm banner:
   "This PDF has no editable text. Use Save a copy to create a Planevo markdown document."
4. **Encrypted / password-protected:** preview-only + honest error; no silent empty editor.

Store imported markdown in editor state. Cache `importWarnings: string[]` in session.

### Export (markdown → PDF bytes)

1. **V1:** Build a new valid PDF with `pdf-lib` containing the edited markdown as structured text
   (headings, lists, bold/italic where exporter supports them). Accept that original page layout,
   vector graphics, form fields, annotations, and embedded images may not round-trip — **say so in UI**.
2. **Prefer smallest implementation that passes tests:**
   - Clean `pdf-lib` generator for text-centric output (default).
   - Optional: preserve original page count/dimensions as metadata when cheap — not required for V1 pass.
3. **Do not** claim Acrobat fidelity. Do not overlay invisible text on scanned pages and call it "saved."
4. **Serialize contract:** `pdf-document-editor.tsx` exposes `serialize(): Promise<Uint8Array>` to the
   autosave coordinator — same interface as DOCX.

### Fidelity harness bar

`lib/files/pdf-fidelity.ts`:

- **Pass:** exported bytes are a valid PDF; extracted text contains user-edited paragraphs; autosave
  does not corrupt the file; xref/table parse succeeds.
- **Packaging drift** (recompression, producer metadata) is acceptable.
- **Fail:** silent loss of user-edited paragraphs, empty document body, or invalid PDF structure.
- Fixtures in `tmp/pdf-fixtures/` (create minimal text PDFs for tests — not git-tracked QA junk).

### V1 boundary — what stays out

| In scope V1 | Out of scope V1 (honest boundary) |
|---|---|
| Text-extractable PDFs → markdown shell → save same file | Scanned/image PDF inline edit |
| Preview-only fallback with banner for non-text PDFs | Form field fill, digital signatures |
| Save a copy → computer + Planevo Files | Redaction, OCR, page reorder WYSIWYG |
| Recovery / conflict / close-flush | Bit-identical layout round-trip |
| Light + dark theme shell QA | Real-time collaborative PDF annotations |

**"Save a copy as Planevo markdown"** for scanned PDFs is a **nice-to-have** stretch item — only if
it does not block the text-PDF save-back path.

## Task 1 is a gate

Before any browser QA on PDF editing, verify `document-editor-panel.tsx` callback stability
(`onSaveStateChange` / `onFlushReady`) — the DOCX gate applies to any new editor mount. Opening a
text PDF must not throw "Maximum update depth exceeded."

## Work items, model, and exclusive file ownership

Both models implement. Grok 4.5 = pure logic / conversion / coordinator. Composer 2.5 = shell / panel
/ tokens / browser QA. **Critic is always the other model.**

| # | Item | Implementer | Critic | Owns exclusively | After |
|---|------|-------------|--------|------------------|-------|
| 1 | **GATE** — panel callback stability | Composer 2.5 | Grok 4.5 | `document-editor-panel.tsx` (callbacks only) | — |
| 2 | **DEPS** — add pdfjs-dist + pdf-lib | Grok 4.5 | Composer 2.5 | `apps/web/package.json`, lockfile | — |
| 3 | PDF open probe | Grok 4.5 | Composer 2.5 | `pdf-document-open.ts` (+test) | 2 |
| 4 | PDF→MD import | Grok 4.5 | Composer 2.5 | `lib/files/pdf-import.ts` (+test) | 3 |
| 5 | MD→PDF export | Grok 4.5 | Composer 2.5 | `lib/files/pdf-export.ts` (+test), `tmp/pdf-fixtures/` | 4 |
| 6 | Transport validator + API raw bytes | Grok 4.5 | Composer 2.5 | `pdf-document-transport.ts`, `route.ts` PDF branch | 5 |
| 7 | Autosave coordinator wire | Grok 4.5 | Composer 2.5 | `pdf-autosave.ts` or generalized autosave, `pdf-document-editor.tsx` adapters | 5, 6 |
| 8 | **MARKDOWN SHELL** — PDF editor body | Composer 2.5 | Grok 4.5 | `pdf-document-editor.tsx`, `pdf-imported-document-editor.tsx` (or generalized import shell) | 4, 7 |
| 9 | Panel routing — pdf editable vs preview | Composer 2.5 | Grok 4.5 | `document-editor-panel.tsx` PDF branch, `document-descriptor.ts` | 3, 8 |
| 10 | Recovery + conflict + local state | Grok 4.5 | Composer 2.5 | `document-recovery-writer.ts` wire, `local-document-state.ts`, `local-file-repository.ts` | 7 |
| 11 | Save-a-copy both destinations | Composer 2.5 | Grok 4.5 | `pdf-save-copy.ts`, `actions.ts`, panel header menu | 7 |
| 12 | Preview-only fallback polish | Composer 2.5 | Grok 4.5 | `read-only-document-viewer.tsx` (banner for non-text PDFs only) | 9 |
| 13 | Token / glass shell polish | Composer 2.5 | Grok 4.5 | `globals.css` (only if shell gaps found) | 8 |
| 14 | Fidelity harness | Grok 4.5 | Composer 2.5 | `lib/files/pdf-fidelity.ts` (+test) | 5 |
| 15 | Migration SQL draft (founder applies) | Grok 4.5 | Composer 2.5 | `supabase/migrations/*_finalize_pdf_document.sql` | 6 |
| 16 | Browser QA, both themes | Composer 2.5 | Grok 4.5 | none (screenshots to `tmp/pdf-qa/`) | all + migration applied |

**Parallelism:** 2 ∥ 1. 3→4→5→6→7 sequential core. 8 ∥ 12 after 7. 9 after 8. 16 last.

## Automatic FAIL for the harsh critic

Spawn a **fresh critic in the other model** per item. Reject on sight:

- Acrobat-style toolbar, page thumbnail sidebar, or PDF.js default viewer UI as the editing surface.
- Text PDF opens only in iframe with no markdown shell option.
- Scanned PDF opens empty markdown editor with no warning.
- Claim of bit-identical PDF layout round-trip in tests or UI copy.
- A spec or test modified to make something pass. **Weakening `local-document-state.test.mjs` is the
  most likely cheat.**
- Any test skipped, renamed, commented out, or assertions loosened.
- A module left orphaned — imported only by its own test.
- Any `any`, TODO, placeholder, stub, or thrown "not implemented".
- Any raw hex, arbitrary `[13px]` value, or raw Tailwind default where a Planevo token exists.
- `liquid-glass-react` used in Files editor.
- Competitor names in UI (including "Acrobat", "Adobe" in product chrome).
- Success claimed without pasted command output or screenshots (item 16+).
- `pdfjs-dist` worker loaded without explicit CSP/worker path plan for Next.js.

Two consecutive FAILs on one item → hand to the **other** model with the critic's fix list. Then
escalate to founder.

## Verification gates

```bash
cd /Users/jabbo/PLANEVO && npm test
cd /Users/jabbo/PLANEVO/apps/web && npx tsc --noEmit
cd /Users/jabbo/PLANEVO/apps/web && node --experimental-strip-types --test lib/files/pdf-import.test.mjs lib/files/pdf-export.test.mjs
cd /Users/jabbo/PLANEVO/apps/web && node --experimental-strip-types --test features/files-product/local-document-state.test.mjs
```

Reconcile test counts explicitly after adding PDF modules.

Baselines (verify disk — may have moved):

- `npm test` → reconcile total after new PDF tests.
- `tsc` → note pre-existing unrelated errors; no NEW errors in touched files.
- `npm run lint` — only NEW errors in touched files count.

### Browser QA checklist (item 16)

Hosted path needs migration applied if CAS RPC is required (saves 500 until then — expected).

- [ ] Open text `.pdf` → **split markdown shell**, not iframe-only, not Acrobat chrome.
- [ ] Open scanned `.pdf` → iframe preview + honest non-editable banner.
- [ ] Light + dark theme screenshots in `tmp/pdf-qa/`.
- [ ] Edit markdown → autosave → reopen → content persisted in PDF text extraction.
- [ ] Local disk PDF → edit → saves back to same path.
- [ ] Save a copy → both destinations work.
- [ ] Conflict banner + recovery draft on crash simulation.
- [ ] Conversion warning banner when import reports limits.
- [ ] DOCX path still works (regression spot-check).

## The 7 promises — final critic traces each with evidence

a) Upload a text `.pdf`, click it → lands in the **markdown shell editor**, not iframe-only.
b) Typing autosaves back to the **same** `file_sources` row + storage object.
c) A `.pdf` opened from the computer writes back to that same file **on disk**.
d) "Save a copy" offers **both** destinations (computer + new PDF in Planevo Files).
e) Closing the panel mid-edit saves **before** it closes.
f) A tab crash leaves a recovery draft that reopening actually **offers**.
g) A file changed elsewhere produces a real **conflict**, not a clobber.

**Plus PDF-specific:** h) A scanned PDF never opens an empty editor without explanation.

## Founder decisions — do not re-ask

1. **Editing model:** Markdown source + live preview (split default). Not Acrobat WYSIWYG.
2. **Chrome:** Planevo Files markdown shell. Not PDF.js viewer UI, not Adobe chrome.
3. **PDF fidelity bar:** Honest text-centric save into valid `.pdf`; surface conversion limits. Not
   bit-identical layout / font / image parity.
4. **Scanned PDFs:** Preview-only in V1 with honest banner; optional save-copy-as-markdown is stretch.
5. **Libraries:** Add `pdfjs-dist` (extract) + `pdf-lib` (export) — no other PDF UI framework.
6. **Migration:** Founder applies any new SQL by hand (project `aixvpsmpiucticxutngp`). **No agent
   applies it. No `supabase db push`. No Docker.**
7. **Scope:** Both save-back paths — hosted round-trip AND local-disk write-back.
8. **Save a copy:** Both destinations — native picker AND new PDF in Planevo Files.
9. **Agents:** Grok 4.5 + Composer 2.5 only.
10. **Checkout:** `/Users/jabbo/PLANEVO` main checkout, never a worktree.
11. **Liquid glass:** Planevo token glass only; no `liquid-glass-react` in Files.
12. **DOCX regression:** Do not break shipped DOCX markdown shell while adding PDF.

## Open questions (escalate to founder if blocked)

1. **Export strategy fork:** If `pdf-lib` clean generator is too lossy for founder acceptance, is
   (A) "edited text only, new simple layout" acceptable, or (B) block ship until page-preserving
   overlay strategy exists? Default **A** for V1.
2. **Default view for PDF:** Split vs Document — default **Split** unless founder says otherwise.
3. **Editable descriptor:** Should `isEditableDocumentFormat("pdf")` be unconditionally `true`, with
   runtime preview-only fallback — or keep `false` in descriptor and branch only in panel? Prefer
   **runtime probe** so list UI does not promise edit on scanned files.
4. **pdfjs worker path:** Next.js 16 + Turbopack worker URL — verify `new URL(..., import.meta.url)`
   pattern; escalate if CSP blocks.
5. **Migration necessity:** Can PDF raw bytes reuse `finalize_docx_document` with format generalization,
   or does PDF need its own RPC? Inspect `route.ts` + existing RPC before writing SQL.
6. **Paid `pdfAnnotations` capability:** Utility dock already labels "Annotations" for PDF — defer real
   annotation layer to post-V1 or fold into markdown comments?

## Boundaries

**Do:** shell swap for text PDFs, keep DOCX paths green, implement import/export, recovery/conflict,
save-copy, browser QA both themes, fidelity harness, preview-only honest fallback.

**Do not:** mount Acrobat/PDF.js viewer chrome; chase layout-identical round-trip; pretend OCR/scanned
edit works; apply migration; run `supabase db push` or Docker; create a worktree; use
`liquid-glass-react` in Files; hardcode hex; add competitor names in UI; commit without being asked;
delete user's real PDFs during QA.

## Current wiring target (after ship)

```
document-editor-panel.tsx
  └─ format === "pdf"
       ├─ openPdfDocument probe → editable
       │    └─ LazyPdfDocumentEditor
       │         └─ pdf-document-editor.tsx (session: autosave, conflict, recovery)
       │              └─ pdf-imported-document-editor.tsx → TextDocumentEditor split shell
       └─ probe → preview-only
            └─ LazyReadOnlyDocumentViewer (iframe + banner)

read-only-document-viewer.tsx
  └─ pdf iframe — preview-only path only (not primary for text PDFs)

document-descriptor.ts
  └─ pdf format; editable gated by runtime probe, not static list badge
```

## Library note

**No PDF libraries in `apps/web/package.json` today.** Planned V1 adds:

- `pdfjs-dist` — Mozilla text extraction (browser worker + Node test build).
- `pdf-lib` — pure-JS PDF creation/modification for export bytes.

Do not add `react-pdf`, `@react-pdf-viewer/*`, or Adobe SDK. The editing surface is Planevo markdown
shell, not a PDF renderer component tree.
