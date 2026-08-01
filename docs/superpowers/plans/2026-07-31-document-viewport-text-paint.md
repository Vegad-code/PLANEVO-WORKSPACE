# Document viewport text paint — implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Document + Markdown paint full visible text on open (match Split), without click-to-reveal; keep liquid glass.

**Architecture:** Dual root cause — (1) compositor: frost on `.files-editor-shell::before`, never on the scroll-host shell; (2) CodeMirror: post-layout remasure + external `value` sync.

**Specs:**
- Dual-cause design: `docs/superpowers/specs/2026-07-31-document-viewport-text-paint-design.md`
- Glass invariant (short): `docs/superpowers/specs/2026-07-31-files-editor-liquid-glass-paint.md`

**Status:** Implemented 2026-07-31.

---

### Task 1: Compare Split vs Document vs Markdown — DONE

| Mode | CM variant | Extra | Why it looked OK/broken |
| --- | --- | --- | --- |
| Document | `document` + live preview | none | 0-height flex mount; no sibling remasure |
| Markdown | `source` | none | Same |
| Split | `source` | ReactMarkdown pane | Sibling layout remasures CM; preview always uses live `value` |

Plus glass: shell `backdrop-filter` paint holes (all modes under frosted shell).

### Task 2: Glass frost on `::before` — DONE

`apps/web/app/globals.css` + `files-editor-glass-paint.test.mjs`.

### Task 3: CM measure + value sync — DONE

`apps/web/lib/files/codemirror-viewport-measure.ts` + `.test.mjs`; wired into CodeMirror text editor (live mount value, `scheduleEditorMeasure`, `ResizeObserver`, `syncEditorValue`).

### Task 4: Verify — DONE

```bash
cd apps/web && node --test \
  lib/files/files-editor-glass-paint.test.mjs \
  lib/files/codemirror-viewport-measure.test.mjs
```

Browser: Document / Markdown / Split; full doc painted; frost preserved.

### Residual

Headed Chrome/Safari founder confirm — headless does not always reproduce compositor holes.
