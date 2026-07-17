import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseRelationTargetIds(raw: string): string[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => UUID_PATTERN.test(part));
}

/**
 * Relations live in the join table (F-07), not in record_values JSONB arrays.
 */
export async function syncRecordRelations(
  client: SupabaseClient<Database>,
  sourceRecordId: string,
  propertyId: string,
  targetRecordIds: string[],
): Promise<void> {
  const { error: deleteError } = await client
    .from("relations")
    .delete()
    .eq("source_record_id", sourceRecordId)
    .eq("source_property_id", propertyId);
  if (deleteError) throw deleteError;

  if (targetRecordIds.length === 0) return;

  const { error: insertError } = await client.from("relations").insert(
    targetRecordIds.map((targetRecordId) => ({
      source_record_id: sourceRecordId,
      source_property_id: propertyId,
      target_record_id: targetRecordId,
    })),
  );
  if (insertError) throw insertError;
}
