import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import type {
  CalendarEventRow,
  CalendarRow,
  TaskDueChip,
} from "../types/calendar";
import { listWorkspaceResourceIds } from "./workspace-links.ts";

export type CalendarWeekData = {
  calendars: CalendarRow[];
  events: CalendarEventRow[];
  taskDues: TaskDueChip[];
};

export type LoadCalendarWeekOptions = {
  /** Inclusive week start (Monday 00:00 local). */
  start: Date;
  /** Exclusive week end (next Monday 00:00 local). */
  end: Date;
  /** F-02 "This workspace" filter — only linked events and task dues. */
  workspaceId?: string;
  /** Default `starts-in`. Use `overlaps` for month grid (multi-day bars). */
  eventRange?: "starts-in" | "overlaps";
};

/** All of a user's calendars ordered by position (hidden ones included —
 * the sidebar renders them unchecked; the grid filters by is_visible). */
export async function loadCalendars(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<CalendarRow[]> {
  const { data, error } = await client
    .from("calendars")
    .select("*")
    .eq("user_id", userId)
    .order("position", { ascending: true });
  if (error) throw error;
  // ponytail: DB CHECK constrains color to CALENDAR_COLORS, so narrowing the
  // generated Row is safe (same convention as loadProductTasks).
  return (data ?? []) as unknown as CalendarRow[];
}

/**
 * One week of calendar data: the user's calendars, events starting inside
 * [start, end), and task due dates in range rendered as chips (never
 * duplicated into calendar_events).
 */
export async function loadCalendarWeek(
  client: SupabaseClient<Database>,
  userId: string,
  options: LoadCalendarWeekOptions,
): Promise<CalendarWeekData> {
  const calendars = await loadCalendars(client, userId);

  let allowedEventIds: string[] | null = null;
  let allowedTaskIds: string[] | null = null;
  if (options.workspaceId) {
    allowedEventIds = await listWorkspaceResourceIds(client, {
      workspaceId: options.workspaceId,
      resourceType: "calendar_event",
    });
    allowedTaskIds = await listWorkspaceResourceIds(client, {
      workspaceId: options.workspaceId,
      resourceType: "task",
    });
  }

  const startIso = options.start.toISOString();
  const endIso = options.end.toISOString();
  const eventRange = options.eventRange ?? "starts-in";

  let events: CalendarEventRow[] = [];
  if (allowedEventIds === null || allowedEventIds.length > 0) {
    let eventQuery = client
      .from("calendar_events")
      .select("*")
      .eq("user_id", userId);

    if (eventRange === "overlaps") {
      eventQuery = eventQuery.lt("starts_at", endIso).gt("ends_at", startIso);
    } else {
      eventQuery = eventQuery
        .gte("starts_at", startIso)
        .lt("starts_at", endIso);
    }

    if (allowedEventIds) eventQuery = eventQuery.in("id", allowedEventIds);
    const { data, error } = await eventQuery.order("starts_at", {
      ascending: true,
    });
    if (error) throw error;
    events = (data ?? []) as unknown as CalendarEventRow[];
  }

  let taskDues: TaskDueChip[] = [];
  if (allowedTaskIds === null || allowedTaskIds.length > 0) {
    let taskQuery = client
      .from("tasks")
      .select("id, title, due_at, status")
      .eq("user_id", userId)
      .gte("due_at", startIso)
      .lt("due_at", endIso);
    if (allowedTaskIds) taskQuery = taskQuery.in("id", allowedTaskIds);
    const { data, error } = await taskQuery.order("due_at", {
      ascending: true,
    });
    if (error) throw error;
    taskDues = (data ?? []).map((row) => ({
      taskId: row.id,
      title: row.title,
      dueAt: row.due_at as string,
      status: row.status,
    }));
  }

  return { calendars, events, taskDues };
}
