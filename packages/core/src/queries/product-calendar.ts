import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import type {
  CalendarContext,
  CalendarEventRow,
  CalendarRow,
  TaskDueChip,
} from "../types/calendar";
import type { TaskStatus } from "../types/tasks";
import { listWorkspaceResourceIds } from "./workspace-links.ts";

const EXCEPTION_PARENT_CHUNK_SIZE = 100;

export type CalendarWeekData = {
  calendars: CalendarRow[];
  /** Calendar identities allowed by the requested Main or isolated context. */
  calendarIds: string[];
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
  /** Main unified view or one strictly isolated calendar route/embed. */
  context?: CalendarContext;
  /** Already ownership-filtered IDs shared by a page-level parallel loader. */
  contextCalendarIds?: string[];
};

/** All live calendars ordered for selectors and context-aware range loading. */
export async function loadCalendars(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<CalendarRow[]> {
  const [calendarsResult, connectionsResult] = await Promise.all([
    client
      .from("calendars")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
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
      // DB CHECK constrains this text column to the calendar palette or #RRGGBB.
      color: calendar.color as CalendarRow["color"],
      color_mode: calendar.color_mode as CalendarRow["color_mode"],
    };
  });
}

export async function loadCalendarIdsForContext(
  client: SupabaseClient<Database>,
  userId: string,
  context: CalendarContext,
): Promise<string[]> {
  let query = client
    .from("calendars")
    .select("id,is_main,is_included_in_main")
    .eq("user_id", userId)
    .is("deleted_at", null);

  if (context.kind === "calendar") {
    query = query.eq("id", context.calendarId);
  } else {
    query = query.or("is_main.eq.true,is_included_in_main.eq.true");
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(({ id }) => id);
}

export async function loadTaskIdsForCalendarContext(
  client: SupabaseClient<Database>,
  userId: string,
  context: CalendarContext,
): Promise<string[]> {
  const calendarIds = await loadCalendarIdsForContext(
    client,
    userId,
    context,
  );
  return loadTaskIdsForCalendarIds(client, userId, calendarIds);
}

export async function loadTaskIdsForCalendarIds(
  client: SupabaseClient<Database>,
  userId: string,
  calendarIds: string[],
): Promise<string[]> {
  if (calendarIds.length === 0) return [];

  const { data, error } = await client
    .from("task_calendar_assignments")
    .select("task_id")
    .eq("user_id", userId)
    .in("calendar_id", calendarIds);
  if (error) throw error;
  return (data ?? []).map(({ task_id }) => task_id);
}

/**
 * Range-scoped calendar data. Unscheduled tasks are intentionally absent:
 * Agenda owns them until scheduling creates the canonical linked event.
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
  const context = options.context ?? { kind: "main" };

  const [calendars, contextCalendarIds, workspaceIds] = await Promise.all([
    includeCalendars
      ? loadCalendars(client, userId)
      : Promise.resolve([] as CalendarRow[]),
    options.contextCalendarIds !== undefined
      ? Promise.resolve(options.contextCalendarIds)
      : loadCalendarIdsForContext(client, userId, context),
    options.workspaceId
      ? Promise.all([
          listWorkspaceResourceIds(client, {
            workspaceId: options.workspaceId,
            resourceType: "calendar_event",
          }),
          listWorkspaceResourceIds(client, {
            workspaceId: options.workspaceId,
            resourceType: "calendar",
          }),
        ]).then(([allowedEventIds, allowedCalendarIds]) => ({
          allowedEventIds,
          allowedCalendarIds,
        }))
      : Promise.resolve({
          allowedEventIds: null as string[] | null,
          allowedCalendarIds: null as string[] | null,
        }),
  ]);
  const { allowedEventIds, allowedCalendarIds } = workspaceIds;
  const workspaceHasContent =
    allowedEventIds === null ||
    allowedCalendarIds === null ||
    allowedEventIds.length > 0 ||
    allowedCalendarIds.length > 0;

  let events: CalendarEventRow[] = [];
  let recurringMasters: CalendarEventRow[] = [];
  let recurrenceExceptions: CalendarEventRow[] = [];
  if (
    contextCalendarIds.length > 0
    && workspaceHasContent
  ) {
    let eventQuery = client
      .from("calendar_events")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .is("parent_event_id", null)
      .is("rrule", null)
      .eq("is_cancelled", false)
      .in("calendar_id", contextCalendarIds);

    if (eventRange === "overlaps") {
      eventQuery = eventQuery.lt("starts_at", endIso).gt("ends_at", startIso);
    } else {
      eventQuery = eventQuery
        .gte("starts_at", startIso)
        .lt("starts_at", endIso);
    }

    if (allowedEventIds && allowedCalendarIds) {
      if (allowedEventIds.length > 0 && allowedCalendarIds.length > 0) {
        eventQuery = eventQuery.or(
          `id.in.(${allowedEventIds.join(",")}),calendar_id.in.(${allowedCalendarIds.join(",")})`,
        );
      } else if (allowedEventIds.length > 0) {
        eventQuery = eventQuery.in("id", allowedEventIds);
      } else {
        eventQuery = eventQuery.in("calendar_id", allowedCalendarIds);
      }
    }
    const [eventsResult, mastersResult] = await Promise.all([
      eventQuery.order("starts_at", { ascending: true }),
      client.rpc("list_calendar_recurrence_masters_for_context", {
        p_owner_id: userId,
        p_window_start: startIso,
        p_window_end: endIso,
        p_overlaps: eventRange === "overlaps",
        p_workspace_event_ids: allowedEventIds,
        p_calendar_ids: contextCalendarIds,
        p_workspace_calendar_ids: allowedCalendarIds,
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
  const linkedTasks =
    taskIds.length > 0
      ? await client
          .from("tasks")
          .select("id,title,status,description_json")
          .eq("user_id", userId)
          .in("id", taskIds)
          .then(({ data, error }) => {
            if (error) throw error;
            return (data ??
              []) as unknown as CalendarWeekData["linkedTasks"];
          })
      : ([] as CalendarWeekData["linkedTasks"]);

  return {
    calendars,
    calendarIds: contextCalendarIds,
    events,
    recurringMasters,
    recurrenceExceptions,
    linkedTasks,
    // Unscheduled tasks belong in Agenda only. A due_at value never creates a
    // second visual event in the grid.
    taskDues: [],
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
