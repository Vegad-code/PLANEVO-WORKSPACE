import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarEventRow } from "../types/calendar";
import type { Database, Json } from "../types/database.types";
import { TASK_STATUSES, type TaskRow, type TaskStatus } from "../types/tasks.ts";

export type LinkedCalendarEventState = {
  eventId: string;
  calendarId: string;
  startsAt: string;
  endsAt: string;
  deletedAt: string | null;
};

export type TaskCalendarState = {
  task: TaskRow;
  linkedEvents: LinkedCalendarEventState[];
};

function asTaskCalendarState(data: Json): TaskCalendarState {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid task/calendar mutation response.");
  }
  const task = data.task;
  const linkedEvents = data.linkedEvents;
  if (
    !task ||
    typeof task !== "object" ||
    Array.isArray(task) ||
    typeof task.id !== "string" ||
    typeof task.status !== "string" ||
    !TASK_STATUSES.includes(task.status as TaskStatus) ||
    !Array.isArray(linkedEvents)
  ) {
    throw new Error("Invalid task/calendar mutation response.");
  }

  const parsedEvents = linkedEvents.map((event) => {
    if (
      !event ||
      typeof event !== "object" ||
      Array.isArray(event) ||
      typeof event.eventId !== "string" ||
      typeof event.calendarId !== "string" ||
      typeof event.startsAt !== "string" ||
      typeof event.endsAt !== "string" ||
      (event.deletedAt !== null && typeof event.deletedAt !== "string")
    ) {
      throw new Error("Invalid task/calendar mutation response.");
    }
    return event as LinkedCalendarEventState;
  });

  return {
    task: task as unknown as TaskRow,
    linkedEvents: parsedEvents,
  };
}

/** Move or resize a one-off task block and update its task due time atomically. */
export async function moveTaskLinkedEvent(
  client: SupabaseClient<Database>,
  userId: string,
  input: { eventId: string; startsAt: string; endsAt: string },
): Promise<CalendarEventRow> {
  const { data, error } = await client.rpc("move_task_linked_event", {
    p_owner_id: userId,
    p_event_id: input.eventId,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
  });
  if (error) throw error;
  return data as unknown as CalendarEventRow;
}

/** Complete the task represented by a task-linked calendar block. */
export async function completeTaskLinkedEvent(
  client: SupabaseClient<Database>,
  userId: string,
  eventId: string,
): Promise<TaskCalendarState> {
  const { data, error } = await client.rpc("complete_task_linked_event", {
    p_owner_id: userId,
    p_event_id: eventId,
  });
  if (error) throw error;
  return asTaskCalendarState(data);
}

/**
 * Set task completion/status and return its live linked blocks. Event state is
 * intentionally derived from task status rather than duplicated onto events.
 */
export async function setTaskStatusWithLinkedEvents(
  client: SupabaseClient<Database>,
  userId: string,
  input: { taskId: string; status: TaskStatus },
): Promise<TaskCalendarState> {
  const { data, error } = await client.rpc(
    "set_task_status_with_linked_events",
    {
      p_owner_id: userId,
      p_task_id: input.taskId,
      p_status: input.status,
    },
  );
  if (error) throw error;
  return asTaskCalendarState(data);
}

/** Soft-delete a task block and clear its task due time without deleting the task. */
export async function unscheduleTaskLinkedEvent(
  client: SupabaseClient<Database>,
  userId: string,
  eventId: string,
): Promise<CalendarEventRow> {
  const { data, error } = await client.rpc("unschedule_task_linked_event", {
    p_owner_id: userId,
    p_event_id: eventId,
  });
  if (error) throw error;
  return data as unknown as CalendarEventRow;
}

/** Link a one-off owned event to an unscheduled task and sync the task due time. */
export async function linkTaskToEvent(
  client: SupabaseClient<Database>,
  userId: string,
  input: { eventId: string; taskId: string },
): Promise<CalendarEventRow> {
  const { data, error } = await client.rpc("link_task_to_event", {
    p_owner_id: userId,
    p_event_id: input.eventId,
    p_task_id: input.taskId,
  });
  if (error) throw error;
  return data as unknown as CalendarEventRow;
}
