"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { duplicateDatabaseStructure } from "@planevo/api/rpc";
import {
  IMPLEMENTED_PROPERTY_TYPES,
  type PropertyType,
} from "@planevo/core/types/property-types";
import { normalizePropertyValue } from "@planevo/core/validation/property-values";
import { requireDataAccess } from "@/lib/data/access";
import type { DataAccess } from "@/lib/data/access";

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

export async function duplicateDatabase(databaseId: string): Promise<void> {
  const access = await requireOwnedDatabase(databaseId);
  const result = await duplicateDatabaseStructure(access.client, {
    ownerId: access.ownerId,
    databaseId,
  });
  revalidatePath("/", "layout");
  redirect(`/databases/${result.databaseId}`);
}
