import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import { findPropertyByRole, selectOptions } from "../types/property-roles";
import { loadDatabaseBundle } from "./records";
import { toDisplayRecord, type DisplayRecord } from "./record-display";

export type TasksData = {
  status: "ready" | "empty" | "unavailable";
  workspaceId: string | null;
  databaseId: string | null;
  statusOptions: string[];
  tasks: DisplayRecord[];
};

const EMPTY: Omit<TasksData, "status"> = {
  workspaceId: null,
  databaseId: null,
  statusOptions: [],
  tasks: [],
};

/** The workspace's default task database, projected through property roles. */
export async function loadTasksBundle(
  client: SupabaseClient<Database>,
  workspaceId: string,
): Promise<TasksData> {
  const { data: taskDatabase, error } = await client
    .from("databases")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("template_type", "task")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!taskDatabase) return { ...EMPTY, status: "empty", workspaceId };

  const bundle = await loadDatabaseBundle(client, taskDatabase.id);
  if (!bundle) return { ...EMPTY, status: "empty", workspaceId };

  const statusProperty = findPropertyByRole(bundle.properties, "status");
  return {
    status: "ready",
    workspaceId,
    databaseId: bundle.database.id,
    statusOptions: statusProperty ? selectOptions(statusProperty) : [],
    tasks: bundle.records.map((record) => toDisplayRecord(record, bundle.properties)),
  };
}
