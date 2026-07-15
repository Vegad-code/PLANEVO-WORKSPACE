import { cache } from "react";
import { loadCalendarMonth, type CalendarData } from "@planevo/core/queries/calendar";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";

export type { CalendarData, CalendarItem } from "@planevo/core/queries/calendar";

// Errors intentionally propagate to the route error boundary — a failed load
// must never render as an empty calendar. "unavailable" = unauthenticated only.
export const getCalendarData = cache(async (month: Date): Promise<CalendarData> => {
  const current = await getCurrentWorkspace();
  if (!current) {
    return { status: "unavailable", workspaceId: null, hasCalendarDatabase: false, items: [] };
  }
  return loadCalendarMonth(current.access.client, current.workspace.id, month);
});
