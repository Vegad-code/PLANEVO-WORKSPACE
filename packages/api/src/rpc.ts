import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@planevo/core/types/database.types";

export type RecentTargetType = "page" | "database" | "record" | "file" | "conversation";

/**
 * Records that the user opened something. Upserts on the unique
 * (user_id, workspace_id, target_type, target_id) key; failures are swallowed —
 * recents tracking must never break a page load.
 */
export async function recordRecentItem(
  client: SupabaseClient<Database>,
  input: {
    userId: string;
    workspaceId: string;
    targetType: RecentTargetType;
    targetId: string;
  },
): Promise<void> {
  await client.from("recent_items").upsert(
    {
      user_id: input.userId,
      workspace_id: input.workspaceId,
      target_type: input.targetType,
      target_id: input.targetId,
      last_opened_at: new Date().toISOString(),
    },
    { onConflict: "user_id,workspace_id,target_type,target_id" },
  );
}

export type DuplicateDatabaseResult = {
  workspaceId: string;
  pageId: string;
  databaseId: string;
};

export async function duplicateDatabaseStructure(
  client: SupabaseClient<Database>,
  input: { ownerId: string; databaseId: string; name?: string | null },
): Promise<DuplicateDatabaseResult> {
  const { data, error } = await client.rpc("duplicate_database_structure", {
    p_owner_id: input.ownerId,
    p_database_id: input.databaseId,
    p_name: input.name ?? null,
  });
  if (error) throw new Error(error.message);
  const result = data as Record<string, unknown> | null;
  if (
    !result ||
    typeof result.workspace_id !== "string" ||
    typeof result.page_id !== "string" ||
    typeof result.database_id !== "string"
  ) {
    throw new Error("The database returned an invalid duplication result.");
  }
  return {
    workspaceId: result.workspace_id,
    pageId: result.page_id,
    databaseId: result.database_id,
  };
}

/** F-12 full duplicate — structure plus all non-deleted records. */
export async function duplicateDatabaseWithRecords(
  client: SupabaseClient<Database>,
  input: { ownerId: string; databaseId: string; name?: string | null },
): Promise<DuplicateDatabaseResult> {
  const { data, error } = await client.rpc("duplicate_database_with_records", {
    p_owner_id: input.ownerId,
    p_database_id: input.databaseId,
    p_name: input.name ?? null,
  });
  if (error) throw new Error(error.message);
  const result = data as Record<string, unknown> | null;
  if (
    !result ||
    typeof result.workspace_id !== "string" ||
    typeof result.page_id !== "string" ||
    typeof result.database_id !== "string"
  ) {
    throw new Error("The database returned an invalid duplication result.");
  }
  return {
    workspaceId: result.workspace_id,
    pageId: result.page_id,
    databaseId: result.database_id,
  };
}
