import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalendarEventRow } from "../types/calendar";
import type { Database, Json } from "../types/database.types";

/**
 * Restore a soft-deleted event. The database function also restores a linked
 * task's due time under the same lock used by schedule and unschedule.
 */
export async function restoreCalendarEventUndo(
  client: SupabaseClient<Database>,
  userId: string,
  eventId: string,
): Promise<CalendarEventRow> {
  const { data, error } = await client.rpc("restore_calendar_event_undo", {
    p_owner_id: userId,
    p_event_id: eventId,
  });
  if (error) throw error;
  return data as unknown as CalendarEventRow;
}

/** Restore an exact recurring-family snapshot inside the database undo window. */
export async function restoreCalendarSeriesUndo(
  client: SupabaseClient<Database>,
  userId: string,
  input: {
    masterEventId: string;
    guardEventId: string;
    newMasterEventId: string | null;
    eventRows: CalendarEventRow[];
  },
): Promise<void> {
  const { data, error } = await client.rpc("restore_calendar_series_undo", {
    p_owner_id: userId,
    p_master_event_id: input.masterEventId,
    p_guard_event_id: input.guardEventId,
    p_new_master_event_id: input.newMasterEventId,
    p_event_rows: input.eventRows as unknown as Json,
  });
  if (error) throw error;
  if (data !== true) throw new Error("Recurring calendar undo failed.");
}
