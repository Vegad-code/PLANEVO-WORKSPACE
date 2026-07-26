import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../types/database.types";
import type { CalendarColor, CalendarEventRow, CalendarRow } from "../types/calendar";
import { scheduleTask } from "./task-cross-links.ts";

const DRAG_SCHEDULE_DURATION_MS = 60 * 60 * 1000;

function nowIso(): string {
  return new Date().toISOString();
}

export type CreateCalendarEventInput = {
  calendarId: string;
  title: string;
  startsAt: string;
  endsAt: string;
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
  calendarId?: string;
  location?: string | null;
  description?: Record<string, unknown>;
  taskId?: string | null;
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
      ...(input.calendarId !== undefined ? { calendar_id: input.calendarId } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
      ...(input.description !== undefined
        ? { description_json: input.description as Json }
        : {}),
      ...(input.taskId !== undefined ? { task_id: input.taskId } : {}),
      updated_at: nowIso(),
    })
    .eq("id", eventId)
    .eq("user_id", userId)
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
  const { error } = await client
    .from("calendar_events")
    .delete()
    .eq("id", eventId)
    .eq("user_id", userId);
  if (error) throw error;
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

export type ScheduleTaskFromDragInput = {
  operationKey: string;
  taskId: string;
  title: string;
  /** Drop-slot start time; the event gets a default 1h duration. */
  startsAt: string;
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
  const endsAt = new Date(startsAtMs + DRAG_SCHEDULE_DURATION_MS).toISOString();
  const event = await scheduleTask(client, userId, {
    operationKey: input.operationKey,
    taskId: input.taskId,
    title: input.title,
    startsAt: new Date(startsAtMs).toISOString(),
    endsAt,
  });
  return event as unknown as CalendarEventRow;
}
