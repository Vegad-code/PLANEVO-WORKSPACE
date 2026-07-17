import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import type { DatabaseBundle } from "../queries/records";
import { propertyValueToString } from "../validation/property-values";

/**
 * Merges relation target titles into record.values for relation/person properties.
 */
export async function enrichBundleWithRelationTitles(
  client: SupabaseClient<Database>,
  bundle: DatabaseBundle,
): Promise<DatabaseBundle> {
  const relationProperties = bundle.properties.filter(
    (property) => property.type === "relation" || property.type === "person",
  );
  if (relationProperties.length === 0 || bundle.records.length === 0) {
    return bundle;
  }

  const recordIds = bundle.records.map((record) => record.id);
  const propertyIds = relationProperties.map((property) => property.id);

  const { data: relationRows, error } = await client
    .from("relations")
    .select("source_record_id, source_property_id, target_record_id")
    .in("source_record_id", recordIds)
    .in("source_property_id", propertyIds);
  if (error) throw error;
  if (!relationRows?.length) return bundle;

  const targetIds = [...new Set(relationRows.map((row) => row.target_record_id))];
  const { data: targetValues, error: valueError } = await client
    .from("record_values")
    .select("record_id, value_json, database_properties!inner(is_primary)")
    .in("record_id", targetIds)
    .eq("database_properties.is_primary", true);
  if (valueError) throw valueError;

  const targetTitles = new Map<string, string>();
  for (const row of targetValues ?? []) {
    targetTitles.set(row.record_id, propertyValueToString(row.value_json) || "Untitled");
  }

  const records = bundle.records.map((record) => {
    const values = { ...record.values };
    for (const property of relationProperties) {
      const links = relationRows.filter(
        (row) =>
          row.source_record_id === record.id && row.source_property_id === property.id,
      );
      if (links.length === 0) continue;
      values[property.id] = links
        .map((link) => targetTitles.get(link.target_record_id) ?? link.target_record_id)
        .join(", ");
    }
    return { ...record, values };
  });

  return { ...bundle, records };
}
