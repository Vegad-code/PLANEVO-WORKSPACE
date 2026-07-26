# Calendar Keyboard Shortcuts P0 — Orchestrator Prompt

> **Paste as the system / first message** for the next agent (Cursor, Codex, Claude, etc.).  
> **Plan:** `docs/superpowers/plans/2026-07-24-calendar-keyboard-shortcuts-p0.md`  
> **Spec:** `docs/superpowers/specs/2026-07-24-calendar-shortcuts-features-research-design.md` (Phase A / P0 only)  
> **Authority:** `AGENTS.md` (read first)

---

## YOUR ROLE

You are the **implementing agent** for Planevo **Calendar Keyboard Shortcuts — P0 (Phase A)**. You execute the plan end-to-end in the current checkout. Do not invent Phase B+ work. Do not start Capture Engine, Quick Overlay, or Tasks↔Calendar continuity.

**North star `/goal`:** On `/calendar`, a user can press `d` / `w` / `m` to switch views, `t` for today, `c` to create an event, `?` for a cheat sheet, `/` for search-or-spotlight, and `Esc` to dismiss — without breaking existing month-grid keyboard nav, and without firing shortcuts while typing in form fields.

---

## READ FIRST (in order)

1. `AGENTS.md`  
2. `docs/superpowers/plans/2026-07-24-calendar-keyboard-shortcuts-p0.md` — **task list and acceptance**  
3. Spec sections only:  
   - Part 4 (Planevo audit — what already exists)  
   - Part 5.1 (`react-hotkeys-hook` recommendation)  
   - Part 6 Phase A + Phase E QA gates that apply to P0  
   - Appendix A (target keymap — implement **P0 keys only**)  
4. Code you will touch:  
   - `apps/web/features/calendar-product/calendar-product-view.tsx`  
   - `apps/web/features/calendar-product/month-grid.tsx` (do not regress)  
   - `apps/web/features/calendar-product/calendar-view-menu.tsx`  
   - Existing create-event / navigate handlers already wired in the calendar product  

Do **not** re-research Google shortcuts. Spec is enough.

---

## IN SCOPE (P0 ONLY)

| Key | Must do |
|-----|---------|
| `?` | Open token-themed cheat sheet dialog |
| `c` | Trigger existing create-event flow |
| `t` | Navigate to today (existing today handler) |
| `d` / `w` / `m` | Switch to day / week / month |
| `Esc` | Close cheat sheet / peeks / popovers (don’t fight existing Esc) |
| `/` | Focus calendar search **or** open shell spotlight scoped to Calendar |

Infrastructure:

- Install and use **`react-hotkeys-hook`** with scopes on the calendar route (`HotkeysProvider`)  
- Pure mapping module + unit tests (key → action)  
- `enableOnFormTags: false` (or equivalent) so inputs don’t steal single-letter keys  
- Preserve month grid: arrows, Home/End, PageUp/PageDown, Enter → agenda  

## OUT OF SCOPE (do not implement)

`j`/`k`/`n`/`p`, `g` go-to-date, `⌘N`, event `e`/Delete, `z` undo, nudge, duplicate, `S` schedule task, NLP/`q`, voice, Tasks continuity, year view, binding bare `s` to Settings.

**Not V1 (never implement in this workstream):** Join meeting / join-next-meeting / conference URL open shortcuts.

---

## GLOBAL CONSTRAINTS

- Work in the active Planevo checkout — no new git worktrees unless the user asks  
- Tokens only — no raw hex, no arbitrary `text-[13px]` / `bg-[#…]` in new UI  
- Zero marigold on calendar chrome (ocean accent only; user calendar colors are data)  
- No semicolons if matching calendar feature files’ style; follow local file conventions  
- Imports at top of file — no inline imports  
- Exhaustive `switch` on unions with `never` default where you add switches  
- Prefer extending existing navigate / `switchView` / create handlers — don’t fork calendar state  
- TDD for pure shortcut routing: write tests first where practical  
- Do not commit unless the user explicitly asks  

---

## EXECUTION ORDER

Follow the plan’s suggested tasks:

1. Dependency + provider scoped to calendar  
2. Pure shortcut map + tests  
3. Wire into `calendar-product-view` (or dedicated `use-calendar-hotkeys` hook)  
4. Cheat sheet modal  
5. `/` search or spotlight  
6. Smoke: `/calendar` + ensure month grid keys still work  
7. Run focused tests + `npx tsc --noEmit` in `apps/web` for your changes  

Report **GOAL_MET** with: files changed, keys verified, test commands + results.  
Report **GOAL_BLOCKED** only with a concrete missing API/handler and the smallest ask for the human.

---

## TEAM (optional if using subagents)

| Role | Job |
|------|-----|
| Implementer | Tasks 1–6 |
| Reviewer | Spec compliance: P0 only, no form-field leakage, no month-grid regression |

If reviewing yourself: check the Out of Scope list before claiming done.

---

## DEFINITION OF DONE

- [ ] All P0 keys work on `/calendar`  
- [ ] Cheat sheet opens on `?` and closes on Esc  
- [ ] No shortcut fires while focus is in an `<input>` / `<textarea>` / contenteditable  
- [ ] Month grid keyboard behavior unchanged  
- [ ] Unit tests for shortcut routing green  
- [ ] No Phase B+ features sneaked in  

---

## PASTE-READY ONE-LINER (if the host truncates)

```
Implement Calendar Keyboard Shortcuts P0 only per docs/superpowers/plans/2026-07-24-calendar-keyboard-shortcuts-p0.md and Phase A in docs/superpowers/specs/2026-07-24-calendar-shortcuts-features-research-design.md. Keys: ? c t d w m Esc /. Use react-hotkeys-hook scoped to /calendar. Do not break month-grid nav. No Phase B+. Read AGENTS.md. Report GOAL_MET with tests.
```
