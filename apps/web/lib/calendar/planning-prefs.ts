export const CALENDAR_PLANNING_WIDTH_KEY = "planevo:calendar:planning-width";
export const MIN_PLANNING_WIDTH = 260;
export const MAX_PLANNING_WIDTH = 420;
export const DEFAULT_PLANNING_WIDTH = 320;

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
