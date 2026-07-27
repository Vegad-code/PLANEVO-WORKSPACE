export const CALENDAR_PLANNING_WIDTH_KEY = "planevo:calendar:planning-width";
export const CALENDAR_PLANNING_COLLAPSED_KEY =
  "planevo:calendar:planning-collapsed";
export const MIN_PLANNING_WIDTH = 260;
export const MAX_PLANNING_WIDTH = 420;
export const DEFAULT_PLANNING_WIDTH = 320;
/** Open by default when the user has never chosen. */
export const DEFAULT_PLANNING_COLLAPSED = false;

export function clampPlanningWidth(px: number): number {
  return Math.min(MAX_PLANNING_WIDTH, Math.max(MIN_PLANNING_WIDTH, Math.round(px)));
}

export function getPlanningWidth(): number {
  if (typeof window === "undefined") return DEFAULT_PLANNING_WIDTH;

  try {
    const stored = window.localStorage.getItem(CALENDAR_PLANNING_WIDTH_KEY);
    const parsed = stored === null ? NaN : Number.parseInt(stored, 10);
    return Number.isFinite(parsed)
      ? clampPlanningWidth(parsed)
      : DEFAULT_PLANNING_WIDTH;
  } catch {
    return DEFAULT_PLANNING_WIDTH;
  }
}

export function setPlanningWidth(px: number): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      CALENDAR_PLANNING_WIDTH_KEY,
      String(clampPlanningWidth(px)),
    );
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function getPlanningCollapsed(): boolean {
  if (typeof window === "undefined") return DEFAULT_PLANNING_COLLAPSED;

  try {
    const stored = window.localStorage.getItem(CALENDAR_PLANNING_COLLAPSED_KEY);
    if (stored === "true") return true;
    if (stored === "false") return false;
    return DEFAULT_PLANNING_COLLAPSED;
  } catch {
    return DEFAULT_PLANNING_COLLAPSED;
  }
}

export function setPlanningCollapsed(collapsed: boolean): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      CALENDAR_PLANNING_COLLAPSED_KEY,
      collapsed ? "true" : "false",
    );
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

/**
 * Runs before hydration so hard-refresh loading HTML matches stored Agenda
 * open/closed width (avoids DEFAULT-open flash when collapsed).
 */
export const PLANNING_RAIL_BOOT_SCRIPT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(CALENDAR_PLANNING_COLLAPSED_KEY)});var w=localStorage.getItem(${JSON.stringify(CALENDAR_PLANNING_WIDTH_KEY)});var r=document.documentElement;var collapsed=c==="true";r.dataset.planningCollapsed=collapsed?"true":"false";var n=w==null?NaN:parseInt(w,10);if(!Number.isFinite(n))n=${DEFAULT_PLANNING_WIDTH};n=Math.min(${MAX_PLANNING_WIDTH},Math.max(${MIN_PLANNING_WIDTH},Math.round(n)));r.style.setProperty("--planning-rail-width",(collapsed?0:n)+"px");}catch(e){}})();`;
