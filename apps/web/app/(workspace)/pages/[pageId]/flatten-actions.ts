"use server";

import { requireDataAccess } from "@/lib/data/access";
import { loadDatabaseBundle } from "@planevo/core/queries/records";
import { findPropertyByRole } from "@planevo/core/types/property-roles";
import { propertyValueToString } from "@planevo/core/validation/property-values";

/** F-10 reverse path: flatten linked record titles back into bullet lines. */
export async function flattenRecordsToLines(input: {
  databaseId: string;
  recordIds: string[];
}): Promise<{ ok: boolean; lines?: string[]; error?: string }> {
  const ids = input.recordIds.filter(Boolean).slice(0, 50);
  if (ids.length === 0) return { ok: false, error: "No records to flatten." };

  try {
    const access = await requireDataAccess();
    const { data: database, error: databaseError } = await access.client
      .from("databases")
      .select("id, workspaces!inner(owner_id)")
      .eq("id", input.databaseId)
      .eq("workspaces.owner_id", access.ownerId)
      .maybeSingle();
    if (databaseError) throw databaseError;
    if (!database) return { ok: false, error: "Database not found." };

    const bundle = await loadDatabaseBundle(access.client, input.databaseId);
    if (!bundle) return { ok: false, error: "Database not found." };

    const titleProperty = findPropertyByRole(bundle.properties, "title");
    if (!titleProperty) return { ok: false, error: "Database is missing a title property." };

    const idSet = new Set(ids);
    const lines = bundle.records
      .filter((record) => idSet.has(record.id))
      .map((record) => propertyValueToString(record.values[titleProperty.id]))
      .filter((line) => line.trim().length > 0);

    return { ok: true, lines };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to flatten records.",
    };
  }
}
