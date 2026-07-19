export const CALENDAR_SCOPE_STORAGE_KEY = "planevo:calendar:scope";

export type CalendarScope = "all" | "workspace";

function isCalendarScope(value: string | null): value is CalendarScope {
  return value === "all" || value === "workspace";
}

export function getCalendarScope(): CalendarScope {
  if (typeof window === "undefined") return "all";

  try {
    const storedScope = window.localStorage.getItem(CALENDAR_SCOPE_STORAGE_KEY);
    return isCalendarScope(storedScope) ? storedScope : "all";
  } catch {
    return "all";
  }
}

export function setCalendarScope(scope: CalendarScope): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(CALENDAR_SCOPE_STORAGE_KEY, scope);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
