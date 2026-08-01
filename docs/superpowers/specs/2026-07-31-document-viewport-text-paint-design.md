# Document viewport text paint (Files editor)

**Date:** 2026-07-31  
**Status:** Fixed (CSS + CodeMirror measure/sync + contract tests)  
**Canonical path:** `docs/superpowers/specs/2026-07-31-document-viewport-text-paint-design.md`

| Artifact | Path |
| --- | --- |
| Glass CSS | `apps/web/app/globals.css` (frosted `.files-editor-shell`) |
| Glass contract | `apps/web/lib/files/files-editor-glass-paint.test.mjs` |
| Glass invariant (short) | `docs/superpowers/specs/2026-07-31-files-editor-liquid-glass-paint.md` |
| CM measure/sync | `apps/web/lib/files/codemirror-viewport-measure.ts` |
| CM contract | `apps/web/lib/files/codemirror-viewport-measure.test.mjs` |
| Plan | `docs/superpowers/plans/2026-07-31-document-viewport-text-paint.md` |

## Classification

This is a **rendering bug** with **two independent root causes**. Neither is a document-load, fetch, BlockNote virtualization, or missing live-preview decoration bug.

Agents must treat empty Document/Markdown gaps (especially when Split looks fine) as this dual class until both contracts pass — not as “content never arrived.”

## Symptom

| Mode | Typical look |
| --- | --- |
| Document / Markdown | Sparse text or huge empty frosted gaps; click / focus often unlocks paint |
| Split | Often looked fine — sibling ReactMarkdown pane forced remasure + always read live `value` |

Affects markdown/text under `.files-editor-shell`. Glass cause also hits any scroller under that shell (DOCX / PDF / BlockNote). CM cause is CodeMirror-host specific.

## Dual root cause (both real)

### 1. Compositor / liquid glass

`backdrop-filter` on `.files-editor-shell` (ancestor of every document scroller) → Chromium/WebKit paint holes until click/repaint.

| | |
| --- | --- |
| **Last good** | Solid shell — no shell `backdrop-filter` |
| **Regression** | Frost applied on the shell element itself |
| **Fix** | Frost on `::before` + `isolation: isolate` on the shell; **keep liquid glass** |

| Layer | Responsibility |
| --- | --- |
| `.files-editor-shell` | Layout, radius, border, inset shadow, `isolation: isolate`. **No** `backdrop-filter` / `-webkit-backdrop-filter`. |
| `.files-editor-shell::before` | Glass fill + blur/saturate; `position: absolute; inset: 0; z-index: -1; pointer-events: none`. |
| Scroll children | Paint as siblings of the blur layer inside the isolated stacking context. |

Nested shells / `data-liquid-glass="off"` / `prefers-reduced-transparency` suppress the pseudo. `--bleed` stays layout-only.

### 2. CodeMirror measure + value sync (why Split worked)

CM6 measures its visible viewport from the host’s client size at construction. In a flex column that size is often **0** on the first effect tick.

| Mode | Why |
| --- | --- |
| Split | ReactMarkdown sibling drove post-mount remasure; preview always used live `value` |
| Document / Markdown | Mounted CM too early (0-height flex); no later sibling resize; external content never synced into CM |

**Fix** (`codemirror-viewport-measure.ts` + editor wire-up):

1. Mount with the **live** `value` (not a stale empty seed).
2. `scheduleEditorMeasure` — double `requestAnimationFrame` → `requestMeasure` after layout settles.
3. `observeEditorHostSize` — `ResizeObserver` → remasure when the flex box gains height.
4. `syncEditorValue` — when external `value` diverges from `view.state.doc`, replace the whole doc (skip when equal so typing is not clobbered).

## Hard rules (future agents)

1. **Never** put `backdrop-filter` / `-webkit-backdrop-filter` on `.files-editor-shell` or any other ancestor of the document scroller. Frost only on `::before` (with shell `isolation: isolate`).
2. **Do not** remove liquid glass or swap to a solid shell as the primary “fix.” Preserve Planevo liquid glass (token + backdrop-filter — never `liquid-glass-react`).
3. **Do not** mount CodeMirror against a 0-height flex host without a post-layout remasure path (`scheduleEditorMeasure` + `ResizeObserver`).
4. **Always** sync external document `value` into CM when it diverges; mount with live content.
5. If only Split looks correct, check **both** glass ancestry and CM measure/sync — fixing one alone can leave the other mode broken.

## How to verify

### Unit contracts (required)

```bash
cd apps/web && node --test \
  lib/files/files-editor-glass-paint.test.mjs \
  lib/files/codemirror-viewport-measure.test.mjs
```

**Glass:** shell has no blur + has `isolation`; `::before` keeps liquid glass; nested / off suppress.

**CM:** double-rAF schedule cancels cleanly; ResizeObserver remasures; `syncEditorValue` no-ops when equal and replaces on diverge (including empty → loaded).

### View-mode QA

1. Open a long markdown file in **Document** and **Markdown** (not only Split).
2. Full text painted on first open — no empty glass bands, no click-to-reveal.
3. Scroll mid-document; glyphs stay painted.
4. Frost still visible (not a flat solid card).
5. Switch modes; external content stays in sync with the editor.
6. Spot-check DOCX / PDF / BlockNote under the same shell (glass path).
7. Headed Chrome/Safari preferred — headless may not reproduce ancestor-blur paint holes.

## Out of scope

- Replacing Planevo tokens or removing glass
- Rewriting CodeMirror / BlockNote wholesale
- Adopting `liquid-glass-react`
