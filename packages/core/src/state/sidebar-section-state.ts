export type SidebarSectionId = "pinned" | "pages" | "private";

/** `true` means the section body is collapsed (hidden). */
export type SidebarSectionState = Record<SidebarSectionId, boolean>;

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
