export type MobileNavigationState = { open: boolean };

export type MobileNavigationEvent =
  | { type: "open" }
  | { type: "close" | "escape" | "overlay" | "navigate" };

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function reduceMobileNavigation(
  state: MobileNavigationState,
  event: MobileNavigationEvent,
): MobileNavigationState {
  if (event.type === "open") return { open: true };
  return state.open ? { open: false } : state;
}

