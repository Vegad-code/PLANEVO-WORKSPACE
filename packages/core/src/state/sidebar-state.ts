export type SidebarPreference = "expanded" | "hidden";
export type SidebarView = SidebarPreference | "peek";

export const PEEK_DELAY_MS = 200;
export const SIDEBAR_DEFAULT_WIDTH = 210;
export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 400;

export type SidebarState = {
  preference: SidebarPreference;
  peeked: boolean;
  width: number;
};

export type SidebarEvent =
  | { type: "toggle" }
  | { type: "peek" }
  | { type: "dismiss-peek" }
  | { type: "pin" }
  | { type: "set-width"; width: number };

type ShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>;

export function clampSidebarWidth(width: number): number {
  return Math.min(
    SIDEBAR_MAX_WIDTH,
    Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)),
  );
}

export function normalizeSidebarPreference(
  value: string | null,
): SidebarPreference {
  // Migrate the retired "rail" preference to full-hide.
  if (value === "hidden" || value === "rail") return "hidden";
  return "expanded";
}

export function normalizeSidebarWidth(value: string | null): number {
  if (value == null || value === "") return SIDEBAR_DEFAULT_WIDTH;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return SIDEBAR_DEFAULT_WIDTH;
  return clampSidebarWidth(parsed);
}

export function createInitialSidebarState(
  preference: SidebarPreference = "expanded",
  width: number = SIDEBAR_DEFAULT_WIDTH,
): SidebarState {
  return {
    preference,
    peeked: false,
    width: clampSidebarWidth(width),
  };
}

export function reduceSidebarState(
  state: SidebarState,
  event: SidebarEvent,
): SidebarState {
  switch (event.type) {
    case "toggle":
      return {
        ...state,
        preference: state.preference === "expanded" ? "hidden" : "expanded",
        peeked: false,
      };
    case "peek":
      return state.preference === "hidden"
        ? { ...state, peeked: true }
        : state;
    case "dismiss-peek":
      return { ...state, peeked: false };
    case "pin":
      return { ...state, preference: "expanded", peeked: false };
    case "set-width":
      return { ...state, width: clampSidebarWidth(event.width) };
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

export function matchesSidebarShortcut(event: ShortcutEvent): boolean {
  return (
    event.key === "\\" &&
    event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.shiftKey
  );
}

export function getSidebarPresentation(state: SidebarState): {
  view: SidebarView;
  spacer: SidebarPreference;
  width: number;
} {
  return {
    view: state.peeked ? "peek" : state.preference,
    spacer: state.preference,
    width: state.width,
  };
}
