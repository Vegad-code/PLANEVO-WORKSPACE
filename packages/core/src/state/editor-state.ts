/**
 * Save-state machine for the debounced page editor: at most one save in
 * flight; edits during a save queue exactly one follow-up save.
 */
export type EditorSaveState = {
  status: "idle" | "dirty" | "saving";
  queued: boolean;
};

export const INITIAL_SAVE_STATE: EditorSaveState = { status: "idle", queued: false };

export function markDirty(state: EditorSaveState): EditorSaveState {
  if (state.status === "saving") return { status: "saving", queued: true };
  return { status: "dirty", queued: false };
}

/** Returns the saving state, or null when there is nothing to save. */
export function beginSave(state: EditorSaveState): EditorSaveState | null {
  if (state.status !== "dirty") return null;
  return { status: "saving", queued: false };
}

/** After a save resolves: back to idle, or dirty again if edits queued up. */
export function completeSave(state: EditorSaveState): EditorSaveState {
  if (state.queued) return { status: "dirty", queued: false };
  return { status: "idle", queued: false };
}

/** A failed save keeps the content dirty so it retries. */
export function failSave(): EditorSaveState {
  return { status: "dirty", queued: false };
}
