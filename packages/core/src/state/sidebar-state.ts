export type SidebarPreference = "expanded" | "rail";
export type SidebarView = SidebarPreference | "peek";

export const PEEK_DELAY_MS = 200;

export type SidebarState = {
  preference: SidebarPreference;
  peeked: boolean;
};

export type SidebarEvent =
  | { type: "toggle" }
  | { type: "peek" }
  | { type: "dismiss-peek" }
  | { type: "pin" };

type ShortcutEvent = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>;

export function normalizeSidebarPreference(
  value: string | null,
): SidebarPreference {
  return value === "rail" ? "rail" : "expanded";
}

export function reduceSidebarState(
  state: SidebarState,
  event: SidebarEvent,
): SidebarState {
  switch (event.type) {
    case "toggle":
      return {
        preference: state.preference === "expanded" ? "rail" : "expanded",
        peeked: false,
      };
    case "peek":
      return state.preference === "rail" ? { ...state, peeked: true } : state;
    case "dismiss-peek":
      return { ...state, peeked: false };
    case "pin":
      return { preference: "expanded", peeked: false };
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
} {
  return {
    view: state.peeked ? "peek" : state.preference,
    spacer: state.preference,
  };
}
