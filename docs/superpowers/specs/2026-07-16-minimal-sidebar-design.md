# Minimal Sidebar Redesign

**Date:** 2026-07-16  
**Status:** Approved for implementation  
**Scope:** Sidebar information architecture + icon library migration. Collapse / peek / resize behavior from the 2026-07-15 Notion sidebar spec is unchanged.

## Goal

Make the sidebar minimal and calm: five destinations, a Workspace page tree with connector lines (Acme craft reference), New page + user footer. Remove Search, Planevo AI, Integrations, Settings, Pinned, and Private from the sidebar chrome.

## Locked decisions

| Topic | Choice |
|---|---|
| Primary nav | Home · Tasks · Calendar · Files |
| Workspace | Single Workspace row → `/workspace` + collapsible page tree (current workspace pages only) |
| Tree craft | Acme-style connector lines (`border-border`), not a layout clone of Acme’s full IA |
| New page | Keep split New page button |
| Search | Remove sidebar Search row; keep top-bar search pill + ⌘K |
| AI / Integrations / Settings | Removed from primary nav; Settings stays in workspace menu + top-bar avatar |
| Pinned / Private | Removed |
| Icons | `@heroicons/react` 24/outline via `PlanevoIcon` (replace `iconoir-react`) |
| Collapse / peek / resize | Unchanged from 2026-07-15 Notion sidebar spec |

## Target structure

1. Workspace switcher + collapse / pin  
2. New page (split button)  
3. Home · Tasks · Calendar · Files  
4. Workspace row + collapsible page tree  
5. User footer (opens settings)

## Visual rules

- Active item: `bg-surface-raised` pill; marigold pip only on the one active primary item.
- Nav gap: `gap-1` for breathability.
- Divider: `border-t border-border` between primary nav and Workspace tree.
- Tree lines: left gutter vertical spine + short horizontal branch per nested page; token `border-border` only.
- Workspace tree default: expanded; persist `"expanded" | "collapsed"` in `localStorage` key `planevo.sidebar.workspaceTree`.
- Empty tree copy: “Your pages will appear here.”
- No gradients, glow, or heavy shadows. Tokens only.

## State migration

Legacy key `planevo.sidebar.sections` JSON `{ pinned, pages, private }` → new key `planevo.sidebar.workspaceTree` (`"expanded" | "collapsed"`).

On read: if legacy key exists, map `pages === true` → `"collapsed"`, else `"expanded"`; ignore pinned/private.

## Icon mapping (sidebar-facing)

| Semantic name | Heroicon |
|---|---|
| `workspace` (Home) | `HomeIcon` |
| `tasks` | `ClipboardDocumentListIcon` |
| `calendar` | `CalendarIcon` |
| `files` | `FolderIcon` |
| `canvas` (Workspace) | `Squares2X2Icon` |
| `page` | `DocumentIcon` |

All other existing `IconName` values remap to outline Heroicons; one family only after migration.

## Out of scope

- Changing collapse / peek / resize interaction  
- Building AI or Integrations into new chrome  
- Multi-workspace tree (all workspaces as nodes)  
- Lucide adoption  
