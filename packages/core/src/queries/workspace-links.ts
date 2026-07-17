import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import type { WorkspaceResourceType } from "../mutations/workspace-links";

export type WorkspaceResourceScope = {
  workspaceId: string;
  resourceType: WorkspaceResourceType;
};

/** F-02 "This workspace" filter: resource ids linked to a workspace. */
export async function listWorkspaceResourceIds(
  client: SupabaseClient<Database>,
  input: WorkspaceResourceScope,
): Promise<string[]> {
  const { data, error } = await client
    .from("workspace_links")
    .select("resource_id")
    .eq("workspace_id", input.workspaceId)
    .eq("resource_type", input.resourceType);
  if (error) throw error;
  return (data ?? []).map((row) => row.resource_id);
}
