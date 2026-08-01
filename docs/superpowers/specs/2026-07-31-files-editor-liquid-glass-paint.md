# Files editor liquid-glass scroll paint (rendering bug)

**Date:** 2026-07-31  
**Status:** Fixed — keep this invariant forever  
**Kind:** One of **two** independent root causes for empty Document/Markdown paint. This file owns the **compositor / liquid-glass** half.  
**Canonical CSS:** `apps/web/app/globals.css` (`.files-editor-shell` frost block)  
**Contract test:** `apps/web/lib/files/files-editor-glass-paint.test.mjs`  
**Full dual-cause design:** [`2026-07-31-document-viewport-text-paint-design.md`](./2026-07-31-document-viewport-text-paint-design.md)  
**CM half (measure + value sync):** `apps/web/lib/files/codemirror-viewport-measure.ts` + `codemirror-viewport-measure.test.mjs`

---

## Dual root cause (both canonical)

Empty Document/Markdown text (often while Split looks fine) has **two** real causes. Fixing only glass can leave CM modes sparse; fixing only CM can leave click-to-reveal glass bands.

| # | Cause | Owner artifact |
| --- | --- | --- |
| **1** | Compositor: `backdrop-filter` on scroll-host shell → paint holes until click | This doc + glass CSS/contract |
| **2** | CodeMirror: 0-height flex mount + no remasure / external `value` sync (Split’s ReactMarkdown sibling masked it) | `codemirror-viewport-measure.ts` + text editor wire-up |

Agents must not triage this as “content never loaded” or “BlockNote virtualization.” Check **both** contracts.

---

## Symptom (founder-critical)

Opening a long markdown file in the Files editor:

| View | Broken behavior |
| --- | --- |
| **Document** (prose / “preview”) | Only a few text fragments; large empty glass gaps; click empty space → missing text appears |
| **Markdown** (raw source) | Same click-to-reveal / sparse paint |
| **Split** | Often looked OK (both panes) while Document + Markdown were broken — do **not** verify only Split |

Layout/scrollbar height is correct. The document **loaded**. Paint / CM viewport measure did not.

## Root cause 1 — Compositor / liquid glass

`backdrop-filter` (and similarly `filter`) on **`.files-editor-shell`**, which is the **ancestor of every document scroller**:

- CodeMirror `.cm-scroller`
- ReactMarkdown preview `.overflow-auto` / `.files-doc-page-host`
- BlockNote hosts
- PDF viewers

Chromium / WebKit fail to reliably paint composited overflow descendants under an ancestor with `backdrop-filter`. Classic click-to-repaint failure.

## Fix pattern (keep liquid glass)

Do **not** remove frost. Move it off the scroll host:

| Layer | Role |
| --- | --- |
| `.files-editor-shell` | Layout, border, inset shadow, `isolation: isolate`. **No** `backdrop-filter` / `filter`. |
| `.files-editor-shell::before` | Token glass fill + `backdrop-filter` blur/saturate; `position: absolute; inset: 0; z-index: -1; pointer-events: none`. |
| Scroll children | Paint as normal content above the frost layer inside the isolated stacking context. |

Also required:

- Nested `.files-editor-shell` → layout-only (`::before` suppressed)
- `[data-liquid-glass="off"]` → solid tokens, no frost pseudo
- `@media (prefers-reduced-transparency: reduce)` → solid fallback, no frost pseudo
- Planevo liquid glass = CSS tokens + `backdrop-filter` (calendar / spotlight craft) — **never** `liquid-glass-react`

## Root cause 2 — CodeMirror measure + value sync (why Split worked)

CM6 measures its visible viewport from the host’s client size at construction. In a flex column that size is often **0** on the first effect tick.

| Mode | Why |
| --- | --- |
| Split | ReactMarkdown sibling forced post-mount remasure; preview always used live `value` |
| Document / Markdown | Mounted CM at 0-height; no sibling resize; external loads never synced into CM |

**Fix** (do not regress):

1. Mount with live `value`
2. `scheduleEditorMeasure` (double rAF → `requestMeasure`)
3. `observeEditorHostSize` (`ResizeObserver` → remasure)
4. `syncEditorValue` when external `value` diverges

Details: design doc § Dual root cause #2.

## Hard rules for future agents

1. **Never** put `backdrop-filter` or `filter` on a Files editor scroll-host ancestor (especially `.files-editor-shell`; do not reintroduce blur on `.files-editor-canvas` / scroller parents that wrap overflow content). Frost belongs on a non-scrolling pseudo behind content, with `isolation: isolate` on the shell.
2. **Do not** remove liquid glass or swap to a solid shell as the primary “fix.”
3. **Do not** mount CodeMirror against a 0-height flex host without post-layout remasure (`scheduleEditorMeasure` + `ResizeObserver`).
4. **Always** sync external document `value` into CM when it diverges; mount with live content.
5. If only Split looks correct, verify **both** glass ancestry and CM measure/sync.

## How to verify

1. **Unit contracts (required — both halves):**

```bash
cd apps/web && node --test \
  lib/files/files-editor-glass-paint.test.mjs \
  lib/files/codemirror-viewport-measure.test.mjs
```

2. **Browser (founder-critical modes):** Open a long `.md`. Check **Document** and **Markdown** mid-scroll *before* clicking. Text must fill the viewport; click must not unlock more text. Split is secondary. Glass frost must still be visible (not a solid opaque slab).

3. **Optional Playwright harnesses** (dev server required):  
   - `tmp/editor-viewport-paint-qa.mjs` — Document + Markdown paint / glass  
   - `tmp/view-mode-paint-critic-qa.mjs` — Document / Markdown / Split with `aria-pressed` mode switches  

Reject if: click increases visible text from sparse → filled, **or** liquid glass is gone, **or** Document/Markdown stay empty while Split is fine after a glass-only CSS tweak (CM half still broken).

## Where to look if it comes back

| If you see… | Check first |
| --- | --- |
| Sparse text / click-to-reveal in Document+Markdown+preview, Split OK | Both contracts below — often CM measure/value, not “missing content” |
| Same holes across Document/Markdown/DOCX/PDF/BlockNote | `globals.css` — was `backdrop-filter` put back on `.files-editor-shell`? |
| Glass gone or solid slab | Shell modifiers `--full` / `--side` / `--bottom` on `document-editor-panel.tsx`; `::before` frost still present |
| Only Markdown/Document empty; Split fine | `text-document-editor.tsx` + `codemirror-viewport-measure.ts` (remasure + `syncEditorValue`) |

## Related

- Dual-cause design: `docs/superpowers/specs/2026-07-31-document-viewport-text-paint-design.md`
- Implementation plan: `docs/superpowers/plans/2026-07-31-document-viewport-text-paint.md`
- Markup owner: `apps/web/features/files-product/document-editor-panel.tsx` (shell `--full` / `--side` / `--bottom`)
- CM wire-up: `apps/web/features/files-product/text-document-editor.tsx`
