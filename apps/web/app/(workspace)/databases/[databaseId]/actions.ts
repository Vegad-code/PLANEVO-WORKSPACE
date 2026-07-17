"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { duplicateDatabaseStructure } from "@planevo/api/rpc";
import {
  needsRebalance,
  positionBetween,
  rebalanced,
} from "@planevo/core/ordering/fractional";
import {
  IMPLEMENTED_PROPERTY_TYPES,
  type PropertyType,
} from "@planevo/core/types/property-types";
import type { Json } from "@planevo/core/types/database.types";
import {
  planPropertyConversion,
  type PropertyConversionPlan,
} from "@planevo/core/validation/property-conversion";
import { normalizePropertyValue } from "@planevo/core/validation/property-values";
import {
  parseRelationTargetIds,
  syncRecordRelations,
} from "@planevo/core/mutations/record-relations";
import { requireDataAccess } from "@/lib/data/access";
import type { DataAccess } from "@/lib/data/access";
import {
  clearRecentItems,
  deleteError,
  type DeleteResult,
} from "@/lib/mutations/delete-entities";

// Every action re-verifies ownership through a workspaces!inner join so the
// dev-mode service-role client gets the same authorization RLS provides.
async function requireOwnedDatabase(databaseId: string): Promise<DataAccess> {
  const access = await requireDataAccess();
  const { data, error } = await access.client
    .from("databases")
    .select("id, workspaces!inner(owner_id)")
    .eq("id", databaseId)
    .eq("workspaces.owner_id", access.ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Database not found.");
  return access;
}

export type CellSaveResult = { ok: boolean; error?: string };

export async function upsertRecordValue(input: {
  recordId: string;
  propertyId: string;
  rawValue: string;
}): Promise<CellSaveResult> {
  try {
    const access = await requireDataAccess();

    const { data: property, error: propertyError } = await access.client
      .from("database_properties")
      .select("id, type, database_id, databases!inner(workspace_id, workspaces!inner(owner_id))")
      .eq("id", input.propertyId)
      .eq("databases.workspaces.owner_id", access.ownerId)
      .maybeSingle();
    if (propertyError) throw propertyError;
    if (!property) return { ok: false, error: "Property not found." };

    const { data: record, error: recordError } = await access.client
      .from("records")
      .select("id, database_id")
      .eq("id", input.recordId)
      .eq("database_id", property.database_id)
      .maybeSingle();
    if (recordError) throw recordError;
    if (!record) return { ok: false, error: "Record not found." };

    const normalized = normalizePropertyValue(property.type as PropertyType, input.rawValue);
    if (!normalized.ok) return { ok: false, error: normalized.error };

    if (property.type === "relation" || property.type === "person") {
      const targetIds = parseRelationTargetIds(input.rawValue);
      await syncRecordRelations(
        access.client,
        input.recordId,
        input.propertyId,
        targetIds,
      );
      return { ok: true };
    }

    if (normalized.value === null) {
      const { error } = await access.client
        .from("record_values")
        .delete()
        .eq("record_id", input.recordId)
        .eq("property_id", input.propertyId);
      if (error) throw error;
    } else {
      const { error } = await access.client.from("record_values").upsert(
        {
          record_id: input.recordId,
          property_id: input.propertyId,
          value_json: normalized.value,
        },
        { onConflict: "record_id,property_id" },
      );
      if (error) throw error;
    }
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to save the value.",
    };
  }
}

export async function createRecord(databaseId: string): Promise<void> {
  const access = await requireOwnedDatabase(databaseId);
  // ponytail: max+1 without a lock — a rare concurrent tie is cosmetic here;
  // the task RPC (hot path) takes the advisory lock.
  const { data: last, error: maxError } = await access.client
    .from("records")
    .select("position")
    .eq("database_id", databaseId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxError) throw maxError;

  const { error } = await access.client.from("records").insert({
    database_id: databaseId,
    position: (last?.position ?? -1) + 1,
    created_by: access.ownerId,
  });
  if (error) throw error;
  revalidatePath(`/databases/${databaseId}`);
}

/** F-05 calendar: create a record with a pre-filled date property. */
export async function createRecordOnDate(input: {
  databaseId: string;
  propertyId: string;
  dateIso: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const access = await requireOwnedDatabase(input.databaseId);

    const { data: property, error: propertyError } = await access.client
      .from("database_properties")
      .select("id, type")
      .eq("id", input.propertyId)
      .eq("database_id", input.databaseId)
      .maybeSingle();
    if (propertyError) throw propertyError;
    if (!property) return { ok: false, error: "Date property not found." };

    const normalized = normalizePropertyValue(property.type as PropertyType, input.dateIso);
    if (!normalized.ok) return { ok: false, error: normalized.error };

    const { data: last, error: maxError } = await access.client
      .from("records")
      .select("position")
      .eq("database_id", input.databaseId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxError) throw maxError;

    const { data: record, error: recordError } = await access.client
      .from("records")
      .insert({
        database_id: input.databaseId,
        position: (last?.position ?? -1) + 1,
        created_by: access.ownerId,
      })
      .select("id")
      .single();
    if (recordError) throw recordError;

    if (normalized.value !== null) {
      const { error: valueError } = await access.client.from("record_values").insert({
        record_id: record.id,
        property_id: input.propertyId,
        value_json: normalized.value,
      });
      if (valueError) throw valueError;
    }

    revalidatePath(`/databases/${input.databaseId}`);
    revalidatePath("/tasks");
    revalidatePath("/calendar");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to create the record.",
    };
  }
}

export async function restoreRecord(recordId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const access = await requireDataAccess();
    const { data: record, error } = await access.client
      .from("records")
      .select("id, database_id, databases!inner(workspace_id, workspaces!inner(owner_id))")
      .eq("id", recordId)
      .eq("databases.workspaces.owner_id", access.ownerId)
      .maybeSingle();
    if (error) throw error;
    if (!record) return { ok: false, error: "Record not found." };

    const { error: updateError } = await access.client
      .from("records")
      .update({ deleted_at: null })
      .eq("id", recordId);
    if (updateError) throw updateError;

    revalidatePath(`/databases/${record.database_id}`);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to restore the record.",
    };
  }
}

export async function listTrashedRecords(
  databaseId: string,
): Promise<{ id: string; deletedAt: string }[]> {
  const access = await requireOwnedDatabase(databaseId);
  const { data, error } = await access.client
    .from("records")
    .select("id, deleted_at")
    .eq("database_id", databaseId)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    deletedAt: row.deleted_at!,
  }));
}

export async function createProperty(input: {
  databaseId: string;
  name: string;
  type: string;
}): Promise<{ ok: boolean; error?: string }> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Property name is required." };
  if (!(IMPLEMENTED_PROPERTY_TYPES as readonly string[]).includes(input.type)) {
    return { ok: false, error: "That property type isn't available yet." };
  }

  try {
    const access = await requireOwnedDatabase(input.databaseId);
    const { data: last, error: maxError } = await access.client
      .from("database_properties")
      .select("position")
      .eq("database_id", input.databaseId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (maxError) throw maxError;

    const { error } = await access.client.from("database_properties").insert({
      database_id: input.databaseId,
      name,
      type: input.type,
      position: (last?.position ?? -1) + 1,
    });
    if (error) throw error;
    revalidatePath(`/databases/${input.databaseId}`);
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to add the property.",
    };
  }
}

export async function renameProperty(input: {
  propertyId: string;
  databaseId: string;
  name: string;
}): Promise<void> {
  const name = input.name.trim();
  if (!name) throw new Error("Property name is required.");
  const access = await requireOwnedDatabase(input.databaseId);
  const { error } = await access.client
    .from("database_properties")
    .update({ name })
    .eq("id", input.propertyId)
    .eq("database_id", input.databaseId);
  if (error) throw error;
  revalidatePath(`/databases/${input.databaseId}`);
}

export async function updateDatabaseIcon(input: {
  databaseId: string;
  icon: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const access = await requireOwnedDatabase(input.databaseId);
    const { error } = await access.client
      .from("databases")
      .update({ icon: input.icon })
      .eq("id", input.databaseId);
    if (error) throw error;
    revalidatePath(`/databases/${input.databaseId}`);
    revalidatePath("/workspace");
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Couldn't update the database icon.",
    };
  }
}

export async function renameDatabase(input: {
  databaseId: string;
  name: string;
}): Promise<{ ok: boolean; error?: string }> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Database name is required." };

  try {
    const access = await requireOwnedDatabase(input.databaseId);
    const { data: database, error: databaseError } = await access.client
      .from("databases")
      .select("page_id")
      .eq("id", input.databaseId)
      .maybeSingle();
    if (databaseError) throw databaseError;

    const { error } = await access.client
      .from("databases")
      .update({ name })
      .eq("id", input.databaseId);
    if (error) throw error;

    if (database?.page_id) {
      await access.client.from("pages").update({ title: name }).eq("id", database.page_id);
    }

    revalidatePath(`/databases/${input.databaseId}`);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to rename the database.",
    };
  }
}

export async function duplicateDatabaseAsTemplate(databaseId: string): Promise<void> {
  const access = await requireOwnedDatabase(databaseId);
  const { data: database, error } = await access.client
    .from("databases")
    .select("name")
    .eq("id", databaseId)
    .maybeSingle();
  if (error) throw error;
  if (!database) throw new Error("Database not found.");

  const result = await duplicateDatabaseStructure(access.client, {
    ownerId: access.ownerId,
    databaseId,
    name: `${database.name} template`,
  });
  revalidatePath("/", "layout");
  redirect(`/databases/${result.databaseId}`);
}

export async function reorderProperty(input: {
  databaseId: string;
  propertyId: string;
  beforePropertyId: string | null;
  afterPropertyId: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const access = await requireOwnedDatabase(input.databaseId);
    const { data: siblings, error: siblingsError } = await access.client
      .from("database_properties")
      .select("id, position")
      .eq("database_id", input.databaseId)
      .order("position", { ascending: true });
    if (siblingsError) throw siblingsError;
    if (!siblings?.length) return { ok: false, error: "No properties to reorder." };

    const before = input.beforePropertyId
      ? siblings.find((row) => row.id === input.beforePropertyId)?.position ?? null
      : null;
    const after = input.afterPropertyId
      ? siblings.find((row) => row.id === input.afterPropertyId)?.position ?? null
      : null;

    if (needsRebalance(before, after)) {
      const positions = rebalanced(siblings.length);
      for (let i = 0; i < siblings.length; i += 1) {
        const { error } = await access.client
          .from("database_properties")
          .update({ position: positions[i] })
          .eq("id", siblings[i]!.id);
        if (error) throw error;
      }
    }

    const refreshed = needsRebalance(before, after)
      ? (
          await access.client
            .from("database_properties")
            .select("id, position")
            .eq("database_id", input.databaseId)
            .order("position", { ascending: true })
        ).data ?? []
      : siblings;

    const refreshedBefore = input.beforePropertyId
      ? refreshed.find((row) => row.id === input.beforePropertyId)?.position ?? null
      : null;
    const refreshedAfter = input.afterPropertyId
      ? refreshed.find((row) => row.id === input.afterPropertyId)?.position ?? null
      : null;

    const position = positionBetween(refreshedBefore, refreshedAfter);
    const { error } = await access.client
      .from("database_properties")
      .update({ position })
      .eq("id", input.propertyId)
      .eq("database_id", input.databaseId);
    if (error) throw error;

    revalidatePath(`/databases/${input.databaseId}`);
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to reorder the property.",
    };
  }
}

export async function updatePropertyConfig(input: {
  databaseId: string;
  propertyId: string;
  config: Json;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const access = await requireOwnedDatabase(input.databaseId);
    const { error } = await access.client
      .from("database_properties")
      .update({ config_json: input.config })
      .eq("id", input.propertyId)
      .eq("database_id", input.databaseId);
    if (error) throw error;
    revalidatePath(`/databases/${input.databaseId}`);
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to update the property.",
    };
  }
}

export async function countPropertyValues(input: {
  databaseId: string;
  propertyId: string;
}): Promise<number> {
  const access = await requireOwnedDatabase(input.databaseId);
  const { count, error } = await access.client
    .from("record_values")
    .select("record_id", { count: "exact", head: true })
    .eq("property_id", input.propertyId);
  if (error) throw error;
  return count ?? 0;
}

export async function convertPropertyType(input: {
  databaseId: string;
  propertyId: string;
  newType: string;
  confirm?: boolean;
}): Promise<
  | { ok: true; dryRun: true; plan: PropertyConversionPlan }
  | { ok: true; dryRun: false }
  | { ok: false; error: string }
> {
  if (!(IMPLEMENTED_PROPERTY_TYPES as readonly string[]).includes(input.newType)) {
    return { ok: false, error: "That property type isn't available yet." };
  }

  try {
    const access = await requireOwnedDatabase(input.databaseId);
    const { data: property, error: propertyError } = await access.client
      .from("database_properties")
      .select("id, type, config_json, is_primary")
      .eq("id", input.propertyId)
      .eq("database_id", input.databaseId)
      .maybeSingle();
    if (propertyError) throw propertyError;
    if (!property) return { ok: false, error: "Property not found." };
    if (property.is_primary) {
      return { ok: false, error: "The primary title property can't change type." };
    }

    const { data: valueRows, error: valuesError } = await access.client
      .from("record_values")
      .select("record_id, value_json")
      .eq("property_id", input.propertyId);
    if (valuesError) throw valuesError;

    const plan = planPropertyConversion(
      property.type as PropertyType,
      input.newType as PropertyType,
      property.config_json,
      (valueRows ?? []).map((row) => ({
        recordId: row.record_id,
        value: row.value_json,
      })),
    );

    if (!input.confirm) {
      return { ok: true, dryRun: true, plan };
    }

    const { error: rpcError } = await access.client.rpc("apply_property_conversion", {
      p_owner_id: access.ownerId,
      p_property_id: input.propertyId,
      p_new_type: input.newType,
      p_new_config: plan.newConfig,
      p_value_updates: plan.updates,
      p_clear_record_ids: plan.clearRecordIds,
    });
    if (rpcError) throw rpcError;

    revalidatePath(`/databases/${input.databaseId}`);
    return { ok: true, dryRun: false };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to convert the property.",
    };
  }
}

export async function duplicateDatabase(databaseId: string): Promise<void> {
  const access = await requireOwnedDatabase(databaseId);
  const result = await duplicateDatabaseStructure(access.client, {
    ownerId: access.ownerId,
    databaseId,
  });
  revalidatePath("/", "layout");
  redirect(`/databases/${result.databaseId}`);
}

export async function deleteRecord(input: {
  databaseId: string;
  recordId: string;
}): Promise<DeleteResult> {
  try {
    const access = await requireOwnedDatabase(input.databaseId);
    const { data: record, error: recordError } = await access.client
      .from("records")
      .select("id")
      .eq("id", input.recordId)
      .eq("database_id", input.databaseId)
      .maybeSingle();
    if (recordError) throw recordError;
    if (!record) return { ok: false, error: "Record not found." };

    const { data: database, error: databaseError } = await access.client
      .from("databases")
      .select("workspace_id")
      .eq("id", input.databaseId)
      .maybeSingle();
    if (databaseError) throw databaseError;
    if (!database) return { ok: false, error: "Database not found." };

    await clearRecentItems(access, {
      workspaceId: database.workspace_id,
      targetType: "record",
      targetId: input.recordId,
    });

    const { error } = await access.client
      .from("records")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", input.recordId);
    if (error) throw error;

    revalidatePath(`/databases/${input.databaseId}`);
    revalidatePath("/tasks");
    revalidatePath("/calendar");
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (cause) {
    return deleteError(cause, "Failed to delete the record.");
  }
}

export async function deleteProperty(input: {
  databaseId: string;
  propertyId: string;
}): Promise<DeleteResult> {
  try {
    const access = await requireOwnedDatabase(input.databaseId);
    const { data: property, error: propertyError } = await access.client
      .from("database_properties")
      .select("id, is_primary")
      .eq("id", input.propertyId)
      .eq("database_id", input.databaseId)
      .maybeSingle();
    if (propertyError) throw propertyError;
    if (!property) return { ok: false, error: "Property not found." };
    if (property.is_primary) {
      return { ok: false, error: "The primary title property can't be deleted." };
    }

    const { error } = await access.client
      .from("database_properties")
      .delete()
      .eq("id", input.propertyId)
      .eq("database_id", input.databaseId);
    if (error) throw error;

    revalidatePath(`/databases/${input.databaseId}`);
    return { ok: true };
  } catch (cause) {
    return deleteError(cause, "Failed to delete the property.");
  }
}

export async function deleteDatabase(databaseId: string): Promise<DeleteResult> {
  try {
    const access = await requireOwnedDatabase(databaseId);
    const { data: database, error: databaseError } = await access.client
      .from("databases")
      .select("id, workspace_id, name, template_type")
      .eq("id", databaseId)
      .maybeSingle();
    if (databaseError) throw databaseError;
    if (!database) return { ok: false, error: "Database not found." };

    await clearRecentItems(access, {
      workspaceId: database.workspace_id,
      targetType: "database",
      targetId: databaseId,
    });

    const { error } = await access.client.from("databases").delete().eq("id", databaseId);
    if (error) throw error;

    revalidatePath("/tasks");
    revalidatePath("/calendar");
    revalidatePath("/files");
    revalidatePath("/", "layout");
  } catch (cause) {
    return deleteError(cause, "Failed to delete the database.");
  }

  redirect("/");
}
