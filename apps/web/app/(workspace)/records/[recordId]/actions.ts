"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizePropertyValue } from "@planevo/core/validation/property-values";
import {
  parseRelationTargetIds,
  syncRecordRelations,
} from "@planevo/core/mutations/record-relations";
import type { PropertyType } from "@planevo/core/types/property-types";
import { requireDataAccess } from "@/lib/data/access";

const MAX_CONTENT_BYTES = 2 * 1024 * 1024;

async function requireOwnedRecord(recordId: string) {
  const access = await requireDataAccess();
  const { data, error } = await access.client
    .from("records")
    .select("id, database_id, content_json, databases!inner(workspace_id, workspaces!inner(owner_id))")
    .eq("id", recordId)
    .is("deleted_at", null)
    .eq("databases.workspaces.owner_id", access.ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Record not found.");
  return { access, record: data };
}

export async function saveRecordContent(
  recordId: string,
  content: unknown,
): Promise<{ ok: boolean; error?: string }> {
  if (!Array.isArray(content)) {
    return { ok: false, error: "Record content must be a list of blocks." };
  }
  let serialized: string;
  try {
    serialized = JSON.stringify(content);
  } catch {
    return { ok: false, error: "Record content is not serializable." };
  }
  if (serialized.length > MAX_CONTENT_BYTES) {
    return { ok: false, error: "This record is too large to save." };
  }

  try {
    const { access } = await requireOwnedRecord(recordId);
    const { error } = await access.client
      .from("records")
      .update({ content_json: JSON.parse(serialized) })
      .eq("id", recordId);
    if (error) throw error;
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to save the record.",
    };
  }
}

export async function saveRecordProperty(input: {
  recordId: string;
  propertyId: string;
  rawValue: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { access } = await requireOwnedRecord(input.recordId);

    const { data: property, error: propertyError } = await access.client
      .from("database_properties")
      .select("id, type, database_id")
      .eq("id", input.propertyId)
      .maybeSingle();
    if (propertyError) throw propertyError;
    if (!property) return { ok: false, error: "Property not found." };

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
      revalidatePath(`/records/${input.recordId}`);
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

    revalidatePath(`/records/${input.recordId}`);
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? cause.message : "Failed to save property.",
    };
  }
}

export async function softDeleteRecord(recordId: string): Promise<void> {
  const { access } = await requireOwnedRecord(recordId);
  const { error } = await access.client
    .from("records")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", recordId);
  if (error) throw error;
  revalidatePath("/", "layout");
  redirect("/tasks");
}
