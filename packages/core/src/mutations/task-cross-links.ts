import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import { linkResourceToWorkspace } from "./workspace-links.ts";

type CalendarEventRow = Database["public"]["Tables"]["calendar_events"]["Row"];

const UNIQUE_VIOLATION = "23505";

export type ScheduleTaskInput = {
  operationKey: string;
  taskId: string;
  title: string;
  startsAt: string;
  endsAt: string;
};

/**
 * Cross-feature "Schedule": write a calendar_events row on the user's default
 * calendar, linked back to the task via task_id.
 */
export async function scheduleTask(
  client: SupabaseClient<Database>,
  userId: string,
  input: ScheduleTaskInput,
): Promise<CalendarEventRow> {
  const { data, error } = await client.rpc("schedule_task_idempotent", {
    p_owner_id: userId,
    p_task_id: input.taskId,
    p_operation_key: input.operationKey,
    p_title: input.title,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
  });
  if (error) throw new Error(error.message);
  return data;
}

export type AttachFileToTaskInput = {
  taskId: string;
  fileSourceId: string;
};

export type ClaimTaskAttachmentInput = AttachFileToTaskInput & {
  operationKey: string;
};

/**
 * Cross-feature "Attach file": reference an existing file_source from a task.
 * file_links has no user_id column (RLS gates it via file_sources ownership),
 * so this follows the subtask convention and takes no userId. Re-attaching an
 * already-linked file is idempotent (unique constraint), matching
 * linkResourceToWorkspace.
 */
export async function attachFileToTask(
  client: SupabaseClient<Database>,
  input: AttachFileToTaskInput,
): Promise<void> {
  const { error } = await client.from("file_links").insert({
    file_source_id: input.fileSourceId,
    target_type: "task",
    target_id: input.taskId,
  });
  if (error && error.code !== UNIQUE_VIOLATION) throw error;
}

/**
 * Atomically turn an upload reservation into a task attachment. The database
 * function locks and verifies both owned records, inserts file_links, and marks
 * the source claimed in one transaction.
 */
export async function claimTaskAttachment(
  client: SupabaseClient<Database>,
  userId: string,
  input: ClaimTaskAttachmentInput,
): Promise<void> {
  const { error } = await client.rpc("claim_task_attachment", {
    p_owner_id: userId,
    p_file_source_id: input.fileSourceId,
    p_task_id: input.taskId,
    p_operation_key: input.operationKey,
  });
  if (error) throw new Error(error.message);
}

export type LinkTaskToWorkspaceInput = {
  taskId: string;
  workspaceId: string;
};

/**
 * Cross-feature "Add to workspace": delegate to the shared workspace-link
 * helper with resource_type 'task' (idempotent re-link handled there).
 */
export async function linkTaskToWorkspace(
  client: SupabaseClient<Database>,
  userId: string,
  input: LinkTaskToWorkspaceInput,
): Promise<void> {
  await linkResourceToWorkspace(client, userId, {
    workspaceId: input.workspaceId,
    resourceType: "task",
    resourceId: input.taskId,
  });
}
