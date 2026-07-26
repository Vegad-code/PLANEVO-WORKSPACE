# Calendar Drag-to-Create Live Event Preview

**Date:** 2026-07-25  
**Status:** Approved for implementation  
**Scope:** Week + day time-grid views (react-big-calendar path)

## Summary

When a user drags across time slots to create an event, show a real event card shell on the grid during the drag. After release, keep the card visible and synced with the create popover until Save or Cancel — matching Google Calendar behavior.

## Requirements

1. **Live drag preview** — Draft card appears during `onSelecting`, grows/shrinks with pointer.
2. **Persist on release** — Card remains on grid when create popover opens.
3. **Popover sync** — Title, start/end, and calendar color on the card update live from the popover form.
4. **Cleanup** — Clear draft on Save, Cancel, Escape, or view switch away from day/week.
5. **No double overlay** — Hide native `.rbc-slot-selection` when draft card renders.
6. **Interaction guards** — Draft is not draggable, resizable, or clickable.

## Architecture

- `DraftCreateEvent` state in `CalendarProductView`.
- Phantom RBC event via `toDraftRbcEvent()` with sentinel id `__draft-create__`.
- `onSelecting` → update draft range; `onSelectSlot` → open popover anchored to draft card.
- `onDraftChange` from `EventDetailPanel` → update draft state.

## Out of scope

- Month view drag-to-create
- All-day band draft preview (future)

## Verification

- Drag week/day: colored card tracks pointer; no gray selection box.
- Release: popover opens; card persists and syncs with form edits.
- Save/Cancel/Escape: card removed.
- Existing event drag/resize unaffected.
