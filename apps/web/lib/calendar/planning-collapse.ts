export const CALENDAR_PLANNING_SECTIONS_KEY =
  "planevo:calendar:planning-sections";

export const PLANNING_SECTION_IDS = ["date", "tasks", "calendars"] as const;

export type PlanningSectionId = (typeof PLANNING_SECTION_IDS)[number];

function isPlanningSectionId(value: unknown): value is PlanningSectionId {
  return (
    typeof value === "string" &&
    (PLANNING_SECTION_IDS as readonly string[]).includes(value)
  );
}

/** Collapsed section ids. Empty set means every section is open. */
export function getCollapsedPlanningSections(): Set<PlanningSectionId> {
  if (typeof window === "undefined") return new Set();

  try {
    const raw = window.localStorage.getItem(CALENDAR_PLANNING_SECTIONS_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter(isPlanningSectionId));
  } catch {
    return new Set();
  }
}

export function setCollapsedPlanningSections(
  ids: ReadonlySet<PlanningSectionId>,
): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      CALENDAR_PLANNING_SECTIONS_KEY,
      JSON.stringify([...ids]),
    );
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function togglePlanningSection(
  current: ReadonlySet<PlanningSectionId>,
  sectionId: PlanningSectionId,
): Set<PlanningSectionId> {
  const next = new Set(current);
  if (next.has(sectionId)) next.delete(sectionId);
  else next.add(sectionId);
  return next;
}
