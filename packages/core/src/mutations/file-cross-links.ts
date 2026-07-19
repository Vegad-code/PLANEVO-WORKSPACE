import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import { attachFileToTask } from "./task-cross-links.ts";

const UNIQUE_VIOLATION = "23505";

export type AttachFileToEventInput = {
  eventId: string;
  fileSourceId: string;
};

/**
 * Cross-feature "Attach file" from an event peek: reference an existing
 * file_source from a calendar_event. Same idempotent convention as
 * attachFileToTask — file_links RLS gates via file_sources ownership.
 */
export async function attachFileToEvent(
  client: SupabaseClient<Database>,
  input: AttachFileToEventInput,
): Promise<void> {
  const { error } = await client.from("file_links").insert({
    file_source_id: input.fileSourceId,
    target_type: "calendar_event",
    target_id: input.eventId,
  });
  if (error && error.code !== UNIQUE_VIOLATION) throw error;
}

/** Files-side alias of the Phase 2 task attachment link. */
export { attachFileToTask as linkFileToTask };
