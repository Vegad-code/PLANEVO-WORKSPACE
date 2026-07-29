import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";

export type WorkspaceResourceType =
  | "task"
  | "calendar"
  | "calendar_event"
  | "file";

export type WorkspaceLinkInput = {
  workspaceId: string;
  resourceType: WorkspaceResourceType;
  resourceId: string;
};

const UNIQUE_VIOLATION = "23505";

export class WorkspaceLinkError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "WorkspaceLinkError";
    this.code = code;
  }
}

/**
 * F-02: link an existing product resource into a
 * workspace. `workspace_links` has a unique(workspace_id, resource_type,
 * resource_id) constraint, so re-linking an already-linked resource is
 * treated as idempotent success rather than an error.
 */
export async function linkResourceToWorkspace(
  client: SupabaseClient<Database>,
  ownerId: string,
  input: WorkspaceLinkInput,
): Promise<void> {
  const { error } = await client.from("workspace_links").insert({
    workspace_id: input.workspaceId,
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    created_by: ownerId,
  });
  if (error && error.code !== UNIQUE_VIOLATION) {
    throw new WorkspaceLinkError(error.message, error.code);
  }
}

export async function unlinkResourceFromWorkspace(
  client: SupabaseClient<Database>,
  input: WorkspaceLinkInput,
): Promise<void> {
  const { error } = await client
    .from("workspace_links")
    .delete()
    .eq("workspace_id", input.workspaceId)
    .eq("resource_type", input.resourceType)
    .eq("resource_id", input.resourceId);
  if (error) throw new WorkspaceLinkError(error.message, error.code);
}
