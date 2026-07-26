import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import type {
  CalendarEventRow,
  CalendarRow,
  CalendarViewRow,
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
  /**
   * When false, skip calendars+connections — range fetches that already load
   * meta separately should pass false to avoid duplicate RTTs.
   */
  includeCalendars?: boolean;
};

/** All of a user's calendars ordered by position (hidden ones included —
 * the sidebar renders them unchecked; the grid filters by is_visible). */
export async function loadCalendars(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<CalendarRow[]> {
  const [calendarsResult, connectionsResult] = await Promise.all([
    client
      .from("calendars")
      .select("*")
      .eq("user_id", userId)
      .order("position", { ascending: true }),
    client
      .from("calendar_connections")
      .select(
        "id, calendar_id, provider, last_synced_at, last_sync_error, is_enabled",
      )
      .eq("user_id", userId),
  ]);
  if (calendarsResult.error) throw calendarsResult.error;
  if (connectionsResult.error) throw connectionsResult.error;

  const connectionsByCalendarId = new Map(
    (connectionsResult.data ?? []).map((connection) => [
      connection.calendar_id,
      connection,
    ]),
  );

  return (calendarsResult.data ?? []).map((calendar) => {
    const connection = connectionsByCalendarId.get(calendar.id);
    return {
      ...calendar,
      // Both tables enforce one connection per calendar. Only safe operational
      // metadata crosses this boundary; feed URLs/tokens never do.
      connection: connection
        ? {
            ...connection,
            provider: connection.provider as "ics" | "google",
          }
        : null,
      // DB CHECK constrains this text column to CALENDAR_COLORS.
      color: calendar.color as CalendarRow["color"],
    };
  });
}

/**
 * Saved lenses ordered for the switcher. Calendar ids are intentionally not
 * foreign keys, so stale ids are discarded at the read boundary after a source
 * calendar is deleted.
 */
export async function listCalendarViews(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<CalendarViewRow[]> {
  const [viewsResult, calendarsResult] = await Promise.all([
    client
      .from("calendar_views")
      .select("*")
      .eq("user_id", userId)
      .order("position", { ascending: true }),
    client.from("calendars").select("id").eq("user_id", userId),
  ]);
  if (viewsResult.error) throw viewsResult.error;
  if (calendarsResult.error) throw calendarsResult.error;

  const ownedCalendarIds = new Set(
    (calendarsResult.data ?? []).map(({ id }) => id),
  );
  return (viewsResult.data ?? []).map((row) =>
    calendarViewWithOwnedSources(row as unknown as CalendarViewRow, ownedCalendarIds),
  );
}

function calendarViewWithOwnedSources(
  view: CalendarViewRow,
  ownedCalendarIds: ReadonlySet<string>,
): CalendarViewRow {
  return {
    ...view,
    source_calendar_ids: view.source_calendar_ids.filter((calendarId) =>
      ownedCalendarIds.has(calendarId),
    ),
  };
}

/**
 * Loads one saved lens for an embedded calendar. The explicit owner predicate
 * is required even when the auth client already applies RLS because local
 * development can use an administrative client.
 */
export async function loadCalendarView(
  client: SupabaseClient<Database>,
  userId: string,
  viewId: string,
): Promise<CalendarViewRow | null> {
  const [viewResult, calendarsResult] = await Promise.all([
    client
      .from("calendar_views")
      .select("*")
      .eq("id", viewId)
      .eq("user_id", userId)
      .maybeSingle(),
    client.from("calendars").select("id").eq("user_id", userId),
  ]);
  if (viewResult.error) throw viewResult.error;
  if (calendarsResult.error) throw calendarsResult.error;
  if (!viewResult.data) return null;

  const ownedCalendarIds = new Set(
    (calendarsResult.data ?? []).map(({ id }) => id),
  );
  return calendarViewWithOwnedSources(
    viewResult.data as unknown as CalendarViewRow,
    ownedCalendarIds,
  );
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
  const includeCalendars = options.includeCalendars !== false;
  const startIso = options.start.toISOString();
  const endIso = options.end.toISOString();
  const eventRange = options.eventRange ?? "starts-in";

  const [calendars, workspaceIds] = await Promise.all([
    includeCalendars
      ? loadCalendars(client, userId)
      : Promise.resolve([] as CalendarRow[]),
    options.workspaceId
      ? Promise.all([
          listWorkspaceResourceIds(client, {
            workspaceId: options.workspaceId,
            resourceType: "calendar_event",
          }),
          listWorkspaceResourceIds(client, {
            workspaceId: options.workspaceId,
            resourceType: "task",
          }),
        ]).then(([allowedEventIds, allowedTaskIds]) => ({
          allowedEventIds,
          allowedTaskIds,
        }))
      : Promise.resolve({
          allowedEventIds: null as string[] | null,
          allowedTaskIds: null as string[] | null,
        }),
  ]);
  const { allowedEventIds, allowedTaskIds } = workspaceIds;

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
    const [eventsResult, mastersResult] = await Promise.all([
      eventQuery.order("starts_at", { ascending: true }),
      client.rpc("list_calendar_recurrence_masters", {
        p_owner_id: userId,
        p_window_start: startIso,
        p_window_end: endIso,
        p_overlaps: eventRange === "overlaps",
        p_workspace_event_ids: allowedEventIds,
      }),
    ]);
    if (eventsResult.error) throw eventsResult.error;
    if (mastersResult.error) throw mastersResult.error;
    events = (eventsResult.data ?? []) as unknown as CalendarEventRow[];
    recurringMasters = (mastersResult.data ??
      []) as unknown as CalendarEventRow[];

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
      recurrenceExceptions = exceptionResults.flat().sort((left, right) => {
        const timeDifference =
          new Date(left.starts_at).getTime() -
          new Date(right.starts_at).getTime();
        return timeDifference || left.id.localeCompare(right.id);
      });
    }
  }

  const taskIds = [
    ...new Set(
      [...events, ...recurringMasters, ...recurrenceExceptions]
        .map(({ task_id }) => task_id)
        .filter((taskId): taskId is string => taskId !== null),
    ),
  ];
  const [linkedTasks, taskDues] = await Promise.all([
    taskIds.length > 0
      ? client
          .from("tasks")
          .select("id,title,status,description_json")
          .eq("user_id", userId)
          .in("id", taskIds)
          .then(({ data, error }) => {
            if (error) throw error;
            return (data ??
              []) as unknown as CalendarWeekData["linkedTasks"];
          })
      : Promise.resolve([] as CalendarWeekData["linkedTasks"]),
    allowedTaskIds === null || allowedTaskIds.length > 0
      ? (() => {
          let taskQuery = client
            .from("tasks")
            .select("id, title, due_at, status")
            .eq("user_id", userId)
            .gte("due_at", startIso)
            .lt("due_at", endIso);
          if (allowedTaskIds) taskQuery = taskQuery.in("id", allowedTaskIds);
          return taskQuery.order("due_at", { ascending: true }).then(
            ({ data, error }) => {
              if (error) throw error;
              return (data ?? []).map((row) => ({
                taskId: row.id,
                title: row.title,
                dueAt: row.due_at as string,
                status: row.status as TaskStatus,
              }));
            },
          );
        })()
      : Promise.resolve([] as TaskDueChip[]),
  ]);

  const scheduledTaskIds = new Set(
    [...events, ...recurringMasters, ...recurrenceExceptions]
      .map((event) => event.task_id)
      .filter((taskId): taskId is string => taskId !== null),
  );
  const visibleTaskDues =
    scheduledTaskIds.size === 0
      ? taskDues
      : taskDues.filter((task) => !scheduledTaskIds.has(task.taskId));

  return {
    calendars,
    events,
    recurringMasters,
    recurrenceExceptions,
    linkedTasks,
    taskDues: visibleTaskDues,
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
  return new Date(windowStart.getTime() - longestDurationMinutes * 60_000);
}

function chunkIds(ids: string[], chunkSize: number): string[][] {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += chunkSize) {
    chunks.push(ids.slice(index, index + chunkSize));
  }
  return chunks;
}
