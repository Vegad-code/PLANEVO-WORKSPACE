/**
 * Checkbox multi-select for the Files list.
 *
 * Selection is driven by per-row checkboxes and a header select-all control.
 * Opening a file is a separate gesture (row click / Enter).
 */

export type FileListSelectionState = {
  /** Ordered selection for stable bulk actions; membership is what matters. */
  selectedIds: string[];
};

export type FileListSelectionIntent =
  | { type: "toggle"; id: string }
  | { type: "clear" }
  | { type: "set"; ids: readonly string[] };

/** Header checkbox visual/ARIA state for the visible rows. */
export type FileListSelectAllState = "none" | "some" | "all";

export function emptyFileListSelection(): FileListSelectionState {
  return { selectedIds: [] };
}

export function isFileListSelected(
  state: FileListSelectionState,
  id: string,
): boolean {
  return state.selectedIds.includes(id);
}

export function fileListSelectionCount(state: FileListSelectionState): number {
  return state.selectedIds.length;
}

function uniquePreserveOrder(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  return next;
}

/**
 * How many of `visibleIds` are currently selected.
 * Used for the header checkbox: unchecked / indeterminate / checked.
 */
export function fileListSelectAllState(input: {
  selectedIds: readonly string[];
  visibleIds: readonly string[];
}): FileListSelectAllState {
  if (input.visibleIds.length === 0) return "none";
  const selected = new Set(input.selectedIds);
  let count = 0;
  for (const id of input.visibleIds) {
    if (selected.has(id)) count += 1;
  }
  if (count === 0) return "none";
  if (count === input.visibleIds.length) return "all";
  return "some";
}

/**
 * Header checkbox click: when every visible row is selected, clear;
 * otherwise select all visible rows.
 */
export function fileListSelectAllIntent(input: {
  selectedIds: readonly string[];
  visibleIds: readonly string[];
}): FileListSelectionIntent {
  const state = fileListSelectAllState(input);
  if (state === "all") return { type: "clear" };
  return { type: "set", ids: input.visibleIds };
}

export function reduceFileListSelection(
  state: FileListSelectionState,
  intent: FileListSelectionIntent,
): FileListSelectionState {
  switch (intent.type) {
    case "clear":
      return emptyFileListSelection();
    case "toggle": {
      const isSelected = state.selectedIds.includes(intent.id);
      if (isSelected) {
        return {
          selectedIds: state.selectedIds.filter((id) => id !== intent.id),
        };
      }
      return {
        selectedIds: [...state.selectedIds, intent.id],
      };
    }
    case "set":
      return { selectedIds: uniquePreserveOrder(intent.ids) };
    default: {
      const _exhaustive: never = intent;
      return _exhaustive;
    }
  }
}
