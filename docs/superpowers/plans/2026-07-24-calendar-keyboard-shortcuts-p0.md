# Calendar Keyboard Shortcuts — P0 (Phase A)

**Date:** 2026-07-24  
**Spec:** `docs/superpowers/specs/2026-07-24-calendar-shortcuts-features-research-design.md` § Part 6 Phase A, Appendix A  
**Prompt:** `docs/superpowers/prompts/calendar-keyzboard-shortcuts-p0-orchestrator.md`

## Goal

Calendar feels keyboard-native for daily navigation without the mouse for view switch / today / create / help.

## In scope (P0 only)


| Key             | Action                                                         |
| --------------- | -------------------------------------------------------------- |
| `?`             | Open shortcut cheat sheet modal                                |
| `c`             | Create event (open existing create flow)                       |
| `t`             | Navigate to today                                              |
| `d` / `w` / `m` | Day / week / month view                                        |
| `Esc`           | Close peek / popover / cheat sheet (context)                   |
| `/`             | Focus calendar search **or** open spotlight scoped to Calendar |


Also:

- Add `react-hotkeys-hook` + scopes on `/calendar`
- Disable global letter shortcuts when focus is in inputs/textareas (except intentional capture later)
- Do not break month grid arrows / PageUp/Down / Enter (existing `month-grid.tsx`)
- Cheat sheet: token-themed, Mac + Win columns, no raw hex / arbitrary px
- Pure helper tests for key → action routing
- `/design` calendar preview: document shortcut help state if cheap



## Out of scope (later phases)

- `j`/`k`, `g`, `⌘N`, event selection `e`/Delete, nudge, duplicate, `S` schedule task, NLP/`q`, voice  
- **Join meeting / join-next-meeting** — not a V1 feature (do not implement)



## Acceptance

- User can switch day/week/month and jump today without the view menu  
- `?` opens a readable cheat sheet  
- Typing in a title field does not fire `c`/`t`/`d`  
- Month keyboard nav still works  
- Focused tests pass; `tsc` clean for touched packages



## Suggested tasks

1. Add dependency + `HotkeysProvider` under calendar product
2. Pure `calendar-shortcut-map` (or similar) + unit tests
3. Wire handlers in `calendar-product-view.tsx` to existing navigate / switchView / create
4. Cheat sheet dialog component
5. `/` → search or spotlight
6. Verify scopes vs month grid; manual smoke on `/calendar`

