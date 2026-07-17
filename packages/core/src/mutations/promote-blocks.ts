import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import { findPropertyByRole } from "../types/property-roles";
import type { CapturedRecordDraft } from "../parsing/natural-capture";
import { loadDatabaseBundle } from "../queries/records";

export type PromoteBlockInput = CapturedRecordDraft & {
  blockId: string;
};

export type PromoteBlocksResult = {
  databaseId: string;
  recordIds: string[];
};

async function nextRecordPosition(
  client: SupabaseClient<Database>,
  databaseId: string,
): Promise<number> {
  const { data, error } = await client
    .from("records")
    .select("position")
    .eq("database_id", databaseId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.position ?? -1) + 1;
}

async function writeRoleValue(
  client: SupabaseClient<Database>,
  recordId: string,
  propertyId: string,
  value: string,
): Promise<void> {
  const { error } = await client.from("record_values").upsert(
    {
      record_id: recordId,
      property_id: propertyId,
      value_json: value,
    },
    { onConflict: "record_id,property_id" },
  );
  if (error) throw error;
}

/**
 * Promote captured block drafts into records on an existing database.
 * Each row stores source_block_id for the F-10 reverse path.
 */
export async function promoteBlocksToDatabase(
  client: SupabaseClient<Database>,
  ownerId: string,
  input: {
    databaseId: string;
    blocks: PromoteBlockInput[];
  },
): Promise<PromoteBlocksResult> {
  const bundle = await loadDatabaseBundle(client, input.databaseId);
  if (!bundle) throw new Error("Database not found.");

  const titleProperty = findPropertyByRole(bundle.properties, "title");
  if (!titleProperty) throw new Error("Database is missing a title property.");

  const statusProperty = findPropertyByRole(bundle.properties, "status");
  const priorityProperty = findPropertyByRole(bundle.properties, "priority");
  const dueProperty = findPropertyByRole(bundle.properties, "due_date");

  const recordIds: string[] = [];
  let position = await nextRecordPosition(client, input.databaseId);

  for (const block of input.blocks) {
    const title = block.title.trim();
    if (!title) continue;

    const { data: record, error: recordError } = await client
      .from("records")
      .insert({
        database_id: input.databaseId,
        position,
        created_by: ownerId,
        source_block_id: block.blockId,
      })
      .select("id")
      .single();
    if (recordError) throw recordError;

    position += 1;
    recordIds.push(record.id);

    await writeRoleValue(client, record.id, titleProperty.id, title);

    if (block.status && statusProperty) {
      await writeRoleValue(client, record.id, statusProperty.id, block.status);
    }
    if (block.priority && priorityProperty) {
      await writeRoleValue(client, record.id, priorityProperty.id, block.priority);
    }
    if (block.dueDate && dueProperty) {
      await writeRoleValue(client, record.id, dueProperty.id, block.dueDate);
    }
  }

  return { databaseId: input.databaseId, recordIds };
}
