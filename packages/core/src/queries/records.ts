import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  DatabasePropertyRow,
  DatabaseRow,
  Json,
  ViewRow,
} from "../types/database.types";

export type RecordItem = {
  id: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  /** value_json keyed by property id — pivoted server-side in one RPC. */
  values: Record<string, Json>;
};

export type DatabaseBundle = {
  database: DatabaseRow;
  properties: DatabasePropertyRow[];
  views: ViewRow[];
  records: RecordItem[];
};

export const DEFAULT_RECORD_PAGE_SIZE = 200;

export async function loadDatabaseBundle(
  client: SupabaseClient<Database>,
  databaseId: string,
  { limit = DEFAULT_RECORD_PAGE_SIZE, offset = 0 } = {},
): Promise<DatabaseBundle | null> {
  const [databaseResult, propertiesResult, viewsResult, recordsResult] =
    await Promise.all([
      client.from("databases").select("*").eq("id", databaseId).maybeSingle(),
      client
        .from("database_properties")
        .select("*")
        .eq("database_id", databaseId)
        .order("position", { ascending: true }),
      client
        .from("views")
        .select("*")
        .eq("database_id", databaseId)
        .order("position", { ascending: true }),
      client.rpc("get_database_records", {
        p_database_id: databaseId,
        p_limit: limit,
        p_offset: offset,
      }),
    ]);

  if (databaseResult.error) throw databaseResult.error;
  if (!databaseResult.data) return null;
  if (propertiesResult.error) throw propertiesResult.error;
  if (viewsResult.error) throw viewsResult.error;
  if (recordsResult.error) throw recordsResult.error;

  return {
    database: databaseResult.data,
    properties: propertiesResult.data ?? [],
    views: viewsResult.data ?? [],
    records: (recordsResult.data ?? []).map((row) => ({
      id: row.record_id,
      position: row.record_position,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      values:
        row.values_json && typeof row.values_json === "object" && !Array.isArray(row.values_json)
          ? (row.values_json as Record<string, Json>)
          : {},
    })),
  };
}
