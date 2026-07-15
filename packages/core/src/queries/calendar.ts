import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import { calendarRange } from "../state/calendar-state";

export type CalendarItem = {
  id: string;
  title: string;
  date: string;
  databaseName: string;
};

export type CalendarData = {
  status: "ready" | "empty" | "unavailable";
  workspaceId: string | null;
  hasCalendarDatabase: boolean;
  items: CalendarItem[];
};

/**
 * Every date-carrying record in the workspace for one month grid — the range
 * filter runs in SQL (get_workspace_calendar_records), so the load is constant
 * in workspace size.
 */
export async function loadCalendarMonth(
  client: SupabaseClient<Database>,
  workspaceId: string,
  month: Date,
): Promise<CalendarData> {
  const { start, end } = calendarRange(month);
  const [rangeResult, calendarDatabaseResult] = await Promise.all([
    client.rpc("get_workspace_calendar_records", {
      p_workspace_id: workspaceId,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
    }),
    client
      .from("databases")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("template_type", "calendar")
      .limit(1)
      .maybeSingle(),
  ]);
  if (rangeResult.error) throw rangeResult.error;
  if (calendarDatabaseResult.error) throw calendarDatabaseResult.error;

  return {
    status: "ready",
    workspaceId,
    hasCalendarDatabase: Boolean(calendarDatabaseResult.data),
    items: (rangeResult.data ?? []).map((row) => ({
      id: `${row.record_id}:${row.property_id}`,
      title: row.title,
      date: row.occurs_at,
      databaseName: row.database_name,
    })),
  };
}
