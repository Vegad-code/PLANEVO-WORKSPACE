"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "@planevo/core/types/database.types";
import type { PropertyType } from "@planevo/core/types/property-types";
import {
  parseRelationTargetIds,
  syncRecordRelations,
} from "@planevo/core/mutations/record-relations";
import { normalizePropertyValue } from "@planevo/core/validation/property-values";
import { requireDataAccess } from "@/lib/data/access";
import type { DataAccess } from "@/lib/data/access";
import { clearRecentItems, deleteError, type DeleteResult } from "@/lib/mutations/delete-entities";

type BulkResult = { ok: true } | { ok: false; error: string };

async function requireOwnedDatabase(databaseId: string): Promise<DataAccess> {
  const access = await requireDataAccess();
  const { data, error } = await access.client
    .from("databases")
    .select("id, workspace_id, workspaces!inner(owner_id)")
    .eq("id", databaseId)
    .eq("workspaces.owner_id", access.ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Database not found.");
  return access;
}

async function verifyRecordsInDatabase(
  access: DataAccess,
  databaseId: string,
  recordIds: string[],
): Promise<boolean> {
  if (recordIds.length === 0) return false;
  const { count, error } = await access.client
    .from("records")
    .select("id", { count: "exact", head: true })
    .eq("database_id", databaseId)
    .in("id", recordIds)
    .is("deleted_at", null);
  if (error) throw error;
  return count === recordIds.length;
}

export async function bulkSetProperty(input: {
  databaseId: string;
  recordIds: string[];
  propertyId: string;
  rawValue: string;
}): Promise<BulkResult> {
  try {
    const access = await requireOwnedDatabase(input.databaseId);
    const uniqueIds = [...new Set(input.recordIds)];
    if (uniqueIds.length === 0) return { ok: false, error: "No records selected." };

    const owned = await verifyRecordsInDatabase(access, input.databaseId, uniqueIds);
    if (!owned) return { ok: false, error: "One or more records were not found." };

    const { data: property, error: propertyError } = await access.client
      .from("database_properties")
      .select("id, type")
      .eq("id", input.propertyId)
      .eq("database_id", input.databaseId)
      .maybeSingle();
    if (propertyError) throw propertyError;
    if (!property) return { ok: false, error: "Property not found." };

    const normalized = normalizePropertyValue(property.type as PropertyType, input.rawValue);
    if (!normalized.ok) return { ok: false, error: normalized.error };

    if (property.type === "relation" || property.type === "person") {
      const targetIds = parseRelationTargetIds(input.rawValue);
      for (const recordId of uniqueIds) {
        await syncRecordRelations(access.client, recordId, input.propertyId, targetIds);
      }
    } else if (normalized.value === null) {
      const { error } = await access.client
        .from("record_values")
        .delete()
        .eq("property_id", input.propertyId)
        .in("record_id", uniqueIds);
      if (error) throw error;
    } else {
      const rows = uniqueIds.map((recordId) => ({
        record_id: recordId,
        property_id: input.propertyId,
        value_json: normalized.value as Json,
      }));
      const { error } = await access.client
        .from("record_values")
        .upsert(rows, { onConflict: "record_id,property_id" });
      if (error) throw error;
    }

    revalidatePath(`/databases/${input.databaseId}`);
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to update records.",
    };
  }
}

export async function bulkDeleteRecords(input: {
  databaseId: string;
  recordIds: string[];
}): Promise<DeleteResult> {
  try {
    const access = await requireOwnedDatabase(input.databaseId);
    const uniqueIds = [...new Set(input.recordIds)];
    if (uniqueIds.length === 0) return { ok: false, error: "No records selected." };

    const owned = await verifyRecordsInDatabase(access, input.databaseId, uniqueIds);
    if (!owned) return { ok: false, error: "One or more records were not found." };

    const { data: database, error: databaseError } = await access.client
      .from("databases")
      .select("workspace_id")
      .eq("id", input.databaseId)
      .maybeSingle();
    if (databaseError) throw databaseError;
    if (!database) return { ok: false, error: "Database not found." };

    for (const recordId of uniqueIds) {
      await clearRecentItems(access, {
        workspaceId: database.workspace_id,
        targetType: "record",
        targetId: recordId,
      });
    }

    const deletedAt = new Date().toISOString();
    const { error } = await access.client
      .from("records")
      .update({ deleted_at: deletedAt })
      .in("id", uniqueIds);
    if (error) throw error;

    revalidatePath(`/databases/${input.databaseId}`);
    revalidatePath("/tasks");
    revalidatePath("/calendar");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (cause) {
    return deleteError(cause, "Failed to delete records.");
  }
}

export async function bulkDuplicateRecords(input: {
  databaseId: string;
  recordIds: string[];
}): Promise<BulkResult & { newIds?: string[] }> {
  try {
    const access = await requireOwnedDatabase(input.databaseId);
    const uniqueIds = [...new Set(input.recordIds)];
    if (uniqueIds.length === 0) return { ok: false, error: "No records selected." };

    const owned = await verifyRecordsInDatabase(access, input.databaseId, uniqueIds);
    if (!owned) return { ok: false, error: "One or more records were not found." };

    const { data, error } = await access.client.rpc("duplicate_records", {
      p_owner_id: access.ownerId,
      p_record_ids: uniqueIds,
    });
    if (error) throw error;

    revalidatePath(`/databases/${input.databaseId}`);
    return { ok: true, newIds: data ?? [] };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to duplicate records.",
    };
  }
}

function buildPropertyMap(
  sourceProperties: { id: string; name: string; type: string }[],
  targetProperties: { id: string; name: string; type: string }[],
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const source of sourceProperties) {
    const match = targetProperties.find(
      (target) =>
        target.name.toLowerCase() === source.name.toLowerCase() &&
        target.type === source.type,
    );
    if (match) map[source.id] = match.id;
  }
  return map;
}

export async function bulkMoveRecords(input: {
  sourceDatabaseId: string;
  targetDatabaseId: string;
  recordIds: string[];
}): Promise<BulkResult> {
  try {
    if (input.sourceDatabaseId === input.targetDatabaseId) {
      return { ok: false, error: "Choose a different database." };
    }

    const access = await requireOwnedDatabase(input.sourceDatabaseId);
    const uniqueIds = [...new Set(input.recordIds)];
    if (uniqueIds.length === 0) return { ok: false, error: "No records selected." };

    const owned = await verifyRecordsInDatabase(access, input.sourceDatabaseId, uniqueIds);
    if (!owned) return { ok: false, error: "One or more records were not found." };

    const { data: targetDatabase, error: targetError } = await access.client
      .from("databases")
      .select("id, workspaces!inner(owner_id)")
      .eq("id", input.targetDatabaseId)
      .eq("workspaces.owner_id", access.ownerId)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!targetDatabase) return { ok: false, error: "Target database not found." };

    const [sourcePropsResult, targetPropsResult] = await Promise.all([
      access.client
        .from("database_properties")
        .select("id, name, type")
        .eq("database_id", input.sourceDatabaseId),
      access.client
        .from("database_properties")
        .select("id, name, type")
        .eq("database_id", input.targetDatabaseId),
    ]);
    if (sourcePropsResult.error) throw sourcePropsResult.error;
    if (targetPropsResult.error) throw targetPropsResult.error;

    const propertyMap = buildPropertyMap(
      sourcePropsResult.data ?? [],
      targetPropsResult.data ?? [],
    );

    const { data: movedCount, error } = await access.client.rpc("move_records_to_database", {
      p_owner_id: access.ownerId,
      p_record_ids: uniqueIds,
      p_target_database_id: input.targetDatabaseId,
      p_property_map: propertyMap,
    });
    if (error) throw error;
    if (!movedCount) {
      return { ok: false, error: "No records were moved." };
    }

    revalidatePath(`/databases/${input.sourceDatabaseId}`);
    revalidatePath(`/databases/${input.targetDatabaseId}`);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to move records.",
    };
  }
}

export async function listWorkspaceDatabases(
  excludeDatabaseId?: string,
): Promise<{ id: string; name: string }[]> {
  const access = await requireDataAccess();
  const { data: workspace, error: workspaceError } = await access.client
    .from("workspaces")
    .select("id")
    .eq("owner_id", access.ownerId)
    .maybeSingle();
  if (workspaceError) throw workspaceError;
  if (!workspace) return [];

  const { data, error } = await access.client
    .from("databases")
    .select("id, name")
    .eq("workspace_id", workspace.id)
    .order("name", { ascending: true });
  if (error) throw error;

  return (data ?? [])
    .filter((row) => row.id !== excludeDatabaseId)
    .map((row) => ({ id: row.id, name: row.name }));
}
