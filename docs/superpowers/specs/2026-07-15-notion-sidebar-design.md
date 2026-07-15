# Notion-Style Sidebar Redesign

**Date:** 2026-07-15  
**Status:** Approved for implementation  
**Scope:** Interaction + layout shell only — Planevo IA preserved

## Goal

Match Notion’s sidebar collapse / hover-lock / resize behavior while keeping Planevo’s
workspace-first information architecture (Home, Tasks, Calendar, Files, Pages tree,
Planevo AI). AFFiNE (`toeverything/AFFiNE`) is a **reference only** for hover-float and
resize timing — not a code port (Vanilla Extract + LiveData/DI are incompatible with
Planevo’s Tailwind + reducer stack).

## Locked decisions

| Topic | Choice |
|---|---|
| Scope | Interaction + layout shell; keep Planevo IA |
| Collapse | Full hide (0px) — replaces the 56px icon rail |
| AFFiNE | Reference only |
| Workspace menu | Notion-style (header, Settings, Invite, Upgrade, list, New, Log out) |
| Primary nav | Hybrid: Home → Search/Inbox icons → Tasks/Calendar/Files |
| Page tree | Collapsible Pinned / Pages / Private (persisted) |
| Width | Draggable 200–400px, persisted |

## State model

```ts
type SidebarPreference = "expanded" | "hidden";
type SidebarView = SidebarPreference | "peek";

type SidebarState = {
  preference: SidebarPreference;
  peeked: boolean;
  width: number; // clamped 200–400, default 210
};
```

Persisted keys:

- `planevo.sidebar.preference` — `expanded` \| `hidden` (legacy `rail` migrates to `hidden`)
- `planevo.sidebar.width` — number string
- `planevo.sidebar.sections` — JSON `{ pinned, pages, private }` collapse flags

## Interaction contract

```
expanded ──⌘\ / << / resize-click──► hidden
hidden   ──⌘\──────────────────────► expanded
hidden   ──left-edge hover (200ms)──► peek
peek     ──mouse leave / Esc────────► hidden
peek     ──lock / pin───────────────► expanded
```

- **Spacer:** `expanded` → persisted width; `hidden` / `peek` → `0` (peek is overlay only)
- **Edge trigger:** ~12px fixed zone at `left: 0` when preference is `hidden`
- **Dismiss delay:** short (~100ms) so the pointer can travel from edge → sidebar
- **Resize:** drag right edge; click without drag collapses (AFFiNE pattern)
- **Reduced motion:** skip width transitions

## Layout (Planevo IA)

1. Workspace switcher + collapse / lock control  
2. Home  
3. Quick actions: Search (live), Inbox (disabled “coming soon”)  
4. Tasks / Calendar / Files  
5. Collapsible: Pinned (scaffold), Pages (tree), Private (scaffold)  
6. Footer: Planevo AI (slate) + plan-meter slot  

Settings moves into the workspace menu (not a sidebar footer row).

## Workspace menu

- Header: avatar, name, `Free plan · N members`
- Upgrade / Invite — present, disabled until product wires them
- Settings — opens existing settings dialog
- Account email from shell (`userEmail`)
- Workspace list + create (existing switch / manage / composer)
- Log out — existing `signOut` action

## Shell data additions

`WorkspaceShellData` gains:

- `userEmail: string | null`
- `memberCount: number` (V1 default `1` for ready workspaces)

## Out of scope

- Literal Notion Meetings / Agents sections  
- AFFiNE Vanilla Extract extraction  
- Real pin / private visibility APIs (UI scaffold only)  
- Functional Inbox / Invite / Upgrade

## Files touched (implementation map)

- `packages/core/src/state/sidebar-state.ts` (+ tests)
- `packages/core/src/state/sidebar-section-state.ts` (+ tests)
- `packages/core/src/queries/workspace-shell.ts` (+ tests)
- `apps/web/features/shell/app-shell.tsx`
- `apps/web/features/shell/sidebar/**`
- `apps/web/features/shell/workspace-switcher.tsx`
- `apps/web/app/design/page.tsx`
- `docs/design-brief.md` (rail superseded)

## Success criteria

- Collapsed sidebar fully disappears; hover left edge peeks; pin locks open  
- `⌘\` toggles expanded ↔ hidden  
- Drag resize persists; canvas does not reflow during peek  
- `/design` shows expanded, hidden (edge), and peek states  
- Core unit tests for preference, width clamp, peek/pin, section collapse pass  
