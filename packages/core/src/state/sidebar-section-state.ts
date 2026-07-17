/** Legacy multi-section collapse (Pinned / Pages / Private). */
export type SidebarSectionId = "pinned" | "pages" | "private";

/** `true` means the section body is collapsed (hidden). */
export type SidebarSectionState = Record<SidebarSectionId, boolean>;

export type WorkspaceTreePreference = "expanded" | "collapsed";

export const WORKSPACE_TREE_STORAGE_KEY = "planevo.sidebar.workspaceTree";
export const LEGACY_SECTIONS_STORAGE_KEY = "planevo.sidebar.sections";

export const SIDEBAR_SECTION_IDS = [
  "pinned",
  "pages",
  "private",
] as const satisfies readonly SidebarSectionId[];

export const DEFAULT_SIDEBAR_SECTION_STATE: SidebarSectionState = {
  pinned: false,
  pages: false,
  private: false,
};

export const DEFAULT_WORKSPACE_TREE_PREFERENCE: WorkspaceTreePreference =
  "expanded";

export function isSidebarSectionId(value: string): value is SidebarSectionId {
  return (SIDEBAR_SECTION_IDS as readonly string[]).includes(value);
}

export function reduceSectionCollapse(
  state: SidebarSectionState,
  sectionId: SidebarSectionId,
): SidebarSectionState {
  return {
    ...state,
    [sectionId]: !state[sectionId],
  };
}

export function normalizeSectionState(
  value: string | null,
): SidebarSectionState {
  if (!value) return { ...DEFAULT_SIDEBAR_SECTION_STATE };

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_SIDEBAR_SECTION_STATE };
    }

    const record = parsed as Record<string, unknown>;
    const next = { ...DEFAULT_SIDEBAR_SECTION_STATE };

    for (const id of SIDEBAR_SECTION_IDS) {
      if (typeof record[id] === "boolean") {
        next[id] = record[id];
      }
    }

    return next;
  } catch {
    return { ...DEFAULT_SIDEBAR_SECTION_STATE };
  }
}

export function serializeSectionState(state: SidebarSectionState): string {
  return JSON.stringify(state);
}

export function isWorkspaceTreePreference(
  value: string,
): value is WorkspaceTreePreference {
  return value === "expanded" || value === "collapsed";
}

/** Toggle expanded ↔ collapsed. */
export function reduceWorkspaceTreeCollapse(
  preference: WorkspaceTreePreference,
): WorkspaceTreePreference {
  return preference === "expanded" ? "collapsed" : "expanded";
}

/**
 * Read workspace tree preference.
 * Accepts the new string value, or migrates from legacy sections JSON
 * (`pages: true` → collapsed).
 */
export function normalizeWorkspaceTreePreference(
  value: string | null,
  legacySectionsValue: string | null = null,
): WorkspaceTreePreference {
  if (value && isWorkspaceTreePreference(value)) {
    return value;
  }

  if (legacySectionsValue) {
    const legacy = normalizeSectionState(legacySectionsValue);
    return legacy.pages ? "collapsed" : "expanded";
  }

  return DEFAULT_WORKSPACE_TREE_PREFERENCE;
}

export function serializeWorkspaceTreePreference(
  preference: WorkspaceTreePreference,
): string {
  return preference;
}
