import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../types/database.types";
import type {
  CalendarColor,
  CalendarEventRow,
  CalendarRow,
  CalendarViewConfigOverrides,
  CalendarViewRow,
} from "../types/calendar";
import { scheduleTask } from "./task-cross-links.ts";

const DEFAULT_TASK_BLOCK_DURATION_MINUTES = 60;

function nowIso(): string {
  return new Date().toISOString();
}

export type CreateCalendarEventInput = {
  calendarId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  startsAtLocal?: string | null;
  endsAtLocal?: string | null;
  timezone?: string | null;
  durationMinutes?: number | null;
  rrule?: string | null;
  recurrenceEnd?: string | null;
  allDay?: boolean;
  location?: string | null;
  description?: Record<string, unknown>;
  taskId?: string | null;
};

/** Insert an event on one of the user's calendars (RLS: user_id = auth.uid()). */
export async function createCalendarEvent(
  client: SupabaseClient<Database>,
  userId: string,
  input: CreateCalendarEventInput,
): Promise<CalendarEventRow> {
  const { data, error } = await client
    .from("calendar_events")
    .insert({
      calendar_id: input.calendarId,
      user_id: userId,
      title: input.title,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      starts_at_local: input.startsAtLocal ?? null,
      ends_at_local: input.endsAtLocal ?? null,
      timezone: input.timezone ?? null,
      duration_minutes: input.durationMinutes ?? null,
      rrule: input.rrule ?? null,
      recurrence_end: input.recurrenceEnd ?? null,
      all_day: input.allDay ?? false,
      location: input.location ?? null,
      description_json: (input.description ?? {}) as Json,
      task_id: input.taskId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as CalendarEventRow;
}

export type UpdateCalendarEventInput = {
  title?: string;
  startsAt?: string;
  endsAt?: string;
  startsAtLocal?: string | null;
  endsAtLocal?: string | null;
  timezone?: string | null;
  durationMinutes?: number | null;
  rrule?: string | null;
  recurrenceEnd?: string | null;
  calendarId?: string;
  location?: string | null;
  description?: Record<string, unknown>;
  taskId?: string | null;
  allDay?: boolean;
};

/** Patch editable event fields. Scoped by id + user_id for RLS defense in depth. */
export async function updateCalendarEvent(
  client: SupabaseClient<Database>,
  userId: string,
  eventId: string,
  input: UpdateCalendarEventInput,
): Promise<void> {
  const { data, error } = await client
    .from("calendar_events")
    .update({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.startsAt !== undefined ? { starts_at: input.startsAt } : {}),
      ...(input.endsAt !== undefined ? { ends_at: input.endsAt } : {}),
      ...(input.startsAtLocal !== undefined
        ? { starts_at_local: input.startsAtLocal }
        : {}),
      ...(input.endsAtLocal !== undefined
        ? { ends_at_local: input.endsAtLocal }
        : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.durationMinutes !== undefined
        ? { duration_minutes: input.durationMinutes }
        : {}),
      ...(input.rrule !== undefined ? { rrule: input.rrule } : {}),
      ...(input.recurrenceEnd !== undefined
        ? { recurrence_end: input.recurrenceEnd }
        : {}),
      ...(input.calendarId !== undefined
        ? { calendar_id: input.calendarId }
        : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.description !== undefined
        ? { description_json: input.description as Json }
        : {}),
      ...(input.taskId !== undefined ? { task_id: input.taskId } : {}),
      ...(input.allDay !== undefined ? { all_day: input.allDay } : {}),
      updated_at: nowIso(),
    })
    .eq("id", eventId)
    .eq("user_id", userId)
    .eq("source", "planevo")
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Event not found.");
}

export type RecurrenceOccurrenceWrite = {
  operationKey: string;
  masterEventId: string;
  calendarId: string;
  recurrenceId: string;
  isCancelled: boolean;
  title: string;
  startsAt: string;
  endsAt: string;
  startsAtLocal: string;
  endsAtLocal: string;
  timezone: string;
  durationMinutes: number;
  allDay: boolean;
  location: string | null;
  description: Record<string, unknown>;
  color: string | null;
  conferenceUrl: string | null;
};

export async function upsertCalendarEventException(
  client: SupabaseClient<Database>,
  userId: string,
  input: RecurrenceOccurrenceWrite,
): Promise<CalendarEventRow> {
  const { data, error } = await client.rpc("upsert_calendar_event_exception", {
    p_owner_id: userId,
    p_master_event_id: input.masterEventId,
    p_calendar_id: input.calendarId,
    p_recurrence_id: input.recurrenceId,
    p_operation_key: input.operationKey,
    p_is_cancelled: input.isCancelled,
    p_title: input.title,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_starts_at_local: input.startsAtLocal,
    p_ends_at_local: input.endsAtLocal,
    p_timezone: input.timezone,
    p_duration_minutes: input.durationMinutes,
    p_all_day: input.allDay,
    p_location: input.location,
    p_description_json: input.description as Json,
    p_color: input.color,
    p_conference_url: input.conferenceUrl,
  });
  if (error) throw error;
  return data as unknown as CalendarEventRow;
}

export async function truncateCalendarEventSeries(
  client: SupabaseClient<Database>,
  userId: string,
  input: { masterEventId: string; recurrenceId: string },
): Promise<CalendarEventRow> {
  const { data, error } = await client.rpc("truncate_calendar_event_series", {
    p_owner_id: userId,
    p_master_event_id: input.masterEventId,
    p_recurrence_id: input.recurrenceId,
  });
  if (error) throw error;
  return data as unknown as CalendarEventRow;
}

export type SplitCalendarEventSeriesInput = {
  operationKey: string;
  masterEventId: string;
  splitRecurrenceId: string;
  calendarId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  startsAtLocal: string;
  endsAtLocal: string;
  timezone: string;
  durationMinutes: number;
  rrule: string;
  recurrenceEnd: string | null;
  allDay: boolean;
  location: string | null;
  description: Record<string, unknown>;
  color: string | null;
  conferenceUrl: string | null;
  exceptionRecurrenceIdMap: Array<{
    oldRecurrenceId: string;
    newRecurrenceId: string;
  }>;
};

export async function splitCalendarEventSeries(
  client: SupabaseClient<Database>,
  userId: string,
  input: SplitCalendarEventSeriesInput,
): Promise<Json> {
  const { data, error } = await client.rpc("split_calendar_event_series", {
    p_owner_id: userId,
    p_master_event_id: input.masterEventId,
    p_split_recurrence_id: input.splitRecurrenceId,
    p_operation_key: input.operationKey,
    p_new_calendar_id: input.calendarId,
    p_new_title: input.title,
    p_new_starts_at: input.startsAt,
    p_new_ends_at: input.endsAt,
    p_new_starts_at_local: input.startsAtLocal,
    p_new_ends_at_local: input.endsAtLocal,
    p_new_timezone: input.timezone,
    p_new_duration_minutes: input.durationMinutes,
    p_new_rrule: input.rrule,
    p_new_recurrence_end: input.recurrenceEnd,
    p_new_all_day: input.allDay,
    p_new_location: input.location,
    p_new_description_json: input.description as Json,
    p_new_color: input.color,
    p_new_conference_url: input.conferenceUrl,
    p_exception_recurrence_id_map: input.exceptionRecurrenceIdMap,
  });
  if (error) throw error;
  return data;
}

export async function softDeleteCalendarEvent(
  client: SupabaseClient<Database>,
  userId: string,
  eventId: string,
): Promise<void> {
  const { data, error } = await client
    .from("calendar_events")
    .update({ deleted_at: nowIso(), updated_at: nowIso() })
    .eq("id", eventId)
    .eq("user_id", userId)
    .eq("source", "planevo")
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Event not found.");
}

export async function deleteCalendarEvent(
  client: SupabaseClient<Database>,
  userId: string,
  eventId: string,
): Promise<void> {
  await softDeleteCalendarEvent(client, userId, eventId);
}

export type CreateCalendarInput = {
  name: string;
  color: CalendarColor;
};

export async function createCalendar(
  client: SupabaseClient<Database>,
  userId: string,
  input: CreateCalendarInput,
): Promise<CalendarRow> {
  const { data, error } = await client
    .from("calendars")
    // ponytail: Date.now() appends in order without a max(position)+1 read —
    // same convention as createSubtask.
    .insert({
      user_id: userId,
      name: input.name,
      color: input.color,
      position: Date.now(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as CalendarRow;
}

export type UpdateCalendarDetailsInput = {
  name?: string;
  color?: CalendarColor;
};

/** Rename or recolor an owned calendar without changing visibility/defaults. */
export async function updateCalendarDetails(
  client: SupabaseClient<Database>,
  userId: string,
  calendarId: string,
  input: UpdateCalendarDetailsInput,
): Promise<CalendarRow> {
  const { data, error } = await client
    .from("calendars")
    .update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    })
    .eq("id", calendarId)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Calendar not found.");
  return data as unknown as CalendarRow;
}

export async function updateCalendarVisibility(
  client: SupabaseClient<Database>,
  userId: string,
  calendarId: string,
  isVisible: boolean,
): Promise<void> {
  const { error } = await client
    .from("calendars")
    .update({ is_visible: isVisible })
    .eq("id", calendarId)
    .eq("user_id", userId);
  if (error) throw error;
}

export type CreateCalendarViewInput = {
  name: string;
  preset: string;
  config: CalendarViewConfigOverrides;
  sourceCalendarIds: string[];
  includeTaskDues: boolean;
  position?: number;
};

export type UpdateCalendarViewInput = {
  name?: string;
  preset?: string;
  config?: CalendarViewConfigOverrides;
  sourceCalendarIds?: string[];
  includeTaskDues?: boolean;
  position?: number;
};

/**
 * Persist only the caller's overrides. Preset resolution belongs at the render
 * boundary so preset improvements flow through existing saved views.
 */
export async function createCalendarView(
  client: SupabaseClient<Database>,
  userId: string,
  input: CreateCalendarViewInput,
): Promise<CalendarViewRow> {
  const { data, error } = await client
    .from("calendar_views")
    .insert({
      user_id: userId,
      name: input.name,
      preset: input.preset,
      config: cloneCalendarViewConfig(input.config) as Json,
      source_calendar_ids: [...input.sourceCalendarIds],
      include_task_dues: input.includeTaskDues,
      ...(input.position !== undefined ? { position: input.position } : {}),
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as CalendarViewRow;
}

export async function updateCalendarView(
  client: SupabaseClient<Database>,
  userId: string,
  viewId: string,
  input: UpdateCalendarViewInput,
): Promise<CalendarViewRow> {
  const { data, error } = await client
    .from("calendar_views")
    .update({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.preset !== undefined ? { preset: input.preset } : {}),
      ...(input.config !== undefined
        ? { config: cloneCalendarViewConfig(input.config) as Json }
        : {}),
      ...(input.sourceCalendarIds !== undefined
        ? { source_calendar_ids: [...input.sourceCalendarIds] }
        : {}),
      ...(input.includeTaskDues !== undefined
        ? { include_task_dues: input.includeTaskDues }
        : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
      updated_at: nowIso(),
    })
    .eq("id", viewId)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Calendar view not found.");
  return data as unknown as CalendarViewRow;
}

export async function deleteCalendarView(
  client: SupabaseClient<Database>,
  userId: string,
  viewId: string,
): Promise<void> {
  const { data, error } = await client
    .from("calendar_views")
    .delete()
    .eq("id", viewId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Calendar view not found.");
}

export async function setDefaultCalendarView(
  client: SupabaseClient<Database>,
  userId: string,
  viewId: string,
): Promise<void> {
  const { error } = await client.rpc("set_default_calendar_view", {
    p_owner_id: userId,
    p_view_id: viewId,
  });
  if (error) throw error;
}

export async function setDefaultCalendar(
  client: SupabaseClient<Database>,
  userId: string,
  calendarId: string,
): Promise<void> {
  const { error } = await client.rpc("set_default_calendar", {
    p_owner_id: userId,
    p_calendar_id: calendarId,
  });
  if (error) throw error;
}

function cloneCalendarViewConfig(
  config: CalendarViewConfigOverrides,
): CalendarViewConfigOverrides {
  return structuredClone(config);
}

export type ScheduleTaskFromDragInput = {
  operationKey: string;
  taskId: string;
  title: string;
  /** Drop-slot start time; the event gets a default 1h duration. */
  startsAt: string;
  /** Task estimate when present; otherwise the default one-hour block. */
  durationMinutes?: number;
};

/**
 * Drag a task from the Today column onto the week grid: creates a
 * calendar_events row linked via task_id on the user's default calendar.
 * Delegates to the Phase 2 schedule_task_idempotent RPC so drag and the
 * Tasks-side Schedule button share one write path.
 */
export async function scheduleTaskFromDrag(
  client: SupabaseClient<Database>,
  userId: string,
  input: ScheduleTaskFromDragInput,
): Promise<CalendarEventRow> {
  const startsAtMs = new Date(input.startsAt).getTime();
  if (Number.isNaN(startsAtMs)) {
    throw new Error(`Invalid drop time: ${input.startsAt}`);
  }
  const durationMinutes =
    input.durationMinutes === undefined
      ? DEFAULT_TASK_BLOCK_DURATION_MINUTES
      : input.durationMinutes;
  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new Error(`Invalid task duration: ${durationMinutes}`);
  }
  const endsAt = new Date(startsAtMs + durationMinutes * 60_000).toISOString();
  const event = await scheduleTask(client, userId, {
    operationKey: input.operationKey,
    taskId: input.taskId,
    title: input.title,
    startsAt: new Date(startsAtMs).toISOString(),
    endsAt,
  });
  return event as unknown as CalendarEventRow;
}
