# Spotlight Pill Morph — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. One fresh implementer per task; Opus reviewer after each.

**Goal:** Replace square Spotlight panel with macOS-style pill + scope icons + morphing glass shell.

**Architecture:** Evolve `CommandBar` stack; client-side scope filter before `buildCommandResults`; CSS token glass + Motion `layout`.

**Spec:** `docs/superpowers/specs/2026-07-23-spotlight-pill-morph-design.md`

## Global Constraints

- Tokens only in `globals.css` — no hardcoded hex in components
- No `liquid-glass-react`
- One marigold per view — scope active uses ink/paper
- Reuse `planevo-icon` names from sidebar
- `backdrop-filter` only on fixed overlay elements
- Honor `prefers-reduced-motion` and `prefers-reduced-transparency`
- Tests: `node --test` for scope module; `tsc --noEmit` in apps/web

---

### Task 1: Tokens + CSS

**Files:** Modify `apps/web/app/globals.css`

- [ ] Add `.spotlight-glass-shell`, `.spotlight-glass-icon` with inset highlight
- [ ] Add `prefers-reduced-transparency` solid fallback
- [ ] Keep legacy `.spotlight-glass-panel` for design preview migration

---

### Task 2: SpotlightChrome

**Files:** Create `apps/web/features/command-bar/spotlight-chrome.tsx`; modify `spotlight-overlay.tsx`

- [ ] Overlay portal drops inner glass panel wrapper
- [ ] Chrome: flex row (pill shell + scope icons slot)
- [ ] Motion `layout` on shell; `rounded-full` ↔ `rounded-2xl` when expanded
- [ ] AnimatePresence for results block

---

### Task 3: Scope icons

**Files:** Create `spotlight-scope-icons.tsx`

- [ ] Four circular glass buttons with `aria-pressed`
- [ ] Arrow key roving within icon group
- [ ] Mobile scroll-snap row

---

### Task 4: Scope filter

**Files:** Create `spotlight-scope.ts`, `spotlight-scope.test.mjs`; modify `command-bar.tsx`

- [ ] `filterEntriesByScope`, sessionStorage persistence
- [ ] Wire scoped entries/recents into `buildCommandResults`

---

### Task 5: Search field + a11y

**Files:** Modify `spotlight-search-field.tsx`, `spotlight-results.tsx`

- [ ] Combobox roles, `aria-controls`, list id
- [ ] Pill styling (no square panel border-b on collapsed)

---

### Task 6: Design preview

**Files:** Modify `apps/web/app/design/command-bar-preview.tsx`

- [ ] Collapsed pill + icons state
- [ ] Expanded + scoped states

---

### Task 7: Verification

- [ ] Run `spotlight-scope.test.mjs`
- [ ] Run `apps/web` typecheck
- [ ] Manual: Cmd+K, scope toggle, morph, Escape
