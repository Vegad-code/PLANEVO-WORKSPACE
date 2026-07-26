import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import type {
  CalendarEventRow,
  CalendarRow,
  TaskDueChip,
} from "../types/calendar";
import type { TaskStatus } from "../types/tasks";
import { listWorkspaceResourceIds } from "./workspace-links.ts";

const EXCEPTION_PARENT_CHUNK_SIZE = 100;

export type CalendarWeekData = {
  calendars: CalendarRow[];
  /** Persisted, non-recurring rows. Expanded instances are materialized in web. */
  events: CalendarEventRow[];
  /** Live series masters whose occurrences may intersect this window. */
  recurringMasters: CalendarEventRow[];
  /** Overrides and cancellations for `recurringMasters`. */
  recurrenceExceptions: CalendarEventRow[];
  /** Current task state for task-backed event rows in this event window. */
  linkedTasks: Array<{
    id: string;
    title: string;
    status: TaskStatus;
    description_json: Record<string, unknown>;
  }>;
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
  let recurringMasters: CalendarEventRow[] = [];
  let recurrenceExceptions: CalendarEventRow[] = [];
  if (allowedEventIds === null || allowedEventIds.length > 0) {
    let eventQuery = client
      .from("calendar_events")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .is("parent_event_id", null)
      .is("rrule", null)
      .eq("is_cancelled", false);

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

    const { data: masterData, error: masterError } = await client.rpc(
      "list_calendar_recurrence_masters",
      {
        p_owner_id: userId,
        p_window_start: startIso,
        p_window_end: endIso,
        p_overlaps: eventRange === "overlaps",
        p_workspace_event_ids: allowedEventIds,
      },
    );
    if (masterError) throw masterError;
    recurringMasters = (masterData ?? []) as unknown as CalendarEventRow[];

    if (recurringMasters.length > 0) {
      const masterIds = recurringMasters.map(({ id }) => id);
      const exceptionStartIso = recurrenceExceptionStart(
        recurringMasters,
        options.start,
        eventRange,
      ).toISOString();
      const exceptionWindowFilter = [
        `and(recurrence_id.gte.${exceptionStartIso},recurrence_id.lt.${endIso})`,
        [
          "and(is_cancelled.eq.false",
          `starts_at.lt.${endIso}`,
          `ends_at.gt.${startIso})`,
        ].join(","),
      ].join(",");
      const chunks = chunkIds(masterIds, EXCEPTION_PARENT_CHUNK_SIZE);
      const exceptionResults = await Promise.all(
        chunks.map(async (parentIds) => {
          const { data, error } = await client
            .from("calendar_events")
            .select("*")
            .eq("user_id", userId)
            .is("deleted_at", null)
            .in("parent_event_id", parentIds)
            .or(exceptionWindowFilter)
            .order("starts_at", { ascending: true });
          if (error) throw error;
          return (data ?? []) as unknown as CalendarEventRow[];
        }),
      );
      recurrenceExceptions = exceptionResults
        .flat()
        .sort((left, right) => {
          const timeDifference =
            new Date(left.starts_at).getTime() -
            new Date(right.starts_at).getTime();
          return timeDifference || left.id.localeCompare(right.id);
        });
    }
  }

  let taskDues: TaskDueChip[] = [];
  const taskIds = [
    ...new Set(
      [...events, ...recurringMasters, ...recurrenceExceptions]
        .map(({ task_id }) => task_id)
        .filter((taskId): taskId is string => taskId !== null),
    ),
  ];
  let linkedTasks: CalendarWeekData["linkedTasks"] = [];
  if (taskIds.length > 0) {
    const { data, error } = await client
      .from("tasks")
      .select("id,title,status,description_json")
      .eq("user_id", userId)
      .in("id", taskIds);
    if (error) throw error;
    linkedTasks = (data ?? []) as unknown as CalendarWeekData["linkedTasks"];
  }

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
      // DB CHECK constrains this text column to TASK_STATUSES.
      status: row.status as TaskStatus,
    }));
  }

  return {
    calendars,
    events,
    recurringMasters,
    recurrenceExceptions,
    linkedTasks,
    taskDues,
  };
}

function recurrenceExceptionStart(
  masters: CalendarEventRow[],
  windowStart: Date,
  eventRange: "starts-in" | "overlaps",
): Date {
  if (eventRange === "starts-in") return windowStart;

  const longestDurationMinutes = masters.reduce((longest, master) => {
    const duration = master.duration_minutes;
    return typeof duration === "number" &&
      Number.isFinite(duration) &&
      duration > longest
      ? duration
      : longest;
  }, 0);
  return new Date(
    windowStart.getTime() - longestDurationMinutes * 60_000,
  );
}

function chunkIds(ids: string[], chunkSize: number): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += chunkSize) {
    chunks.push(ids.slice(index, index + chunkSize));
  }
  return chunks;
}
