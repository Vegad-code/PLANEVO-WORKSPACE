import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import { positionBetween } from "../ordering/fractional.ts";

/** Append a folder at the end of its sibling group; returns the new id. */
export async function createFolder(
  client: SupabaseClient<Database>,
  ownerId: string,
  input: { name: string; parentId?: string | null },
): Promise<{ id: string }> {
  const parentId = input.parentId ?? null;

  // Highest position among siblings sharing this parent (null-safe for roots).
  let siblingQuery = client
    .from("file_folders")
    .select("position")
    .eq("user_id", ownerId);
  siblingQuery =
    parentId === null
      ? siblingQuery.is("parent_id", null)
      : siblingQuery.eq("parent_id", parentId);
  const { data: siblings, error: siblingsError } = await siblingQuery
    .order("position", { ascending: false })
    .limit(1);
  if (siblingsError) throw siblingsError;

  const maxPosition = siblings && siblings.length > 0 ? siblings[0]!.position : null;
  const position = positionBetween(maxPosition, null);

  const { data, error } = await client
    .from("file_folders")
    .insert({ user_id: ownerId, name: input.name, parent_id: parentId, position })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

export async function renameFolder(
  client: SupabaseClient<Database>,
  ownerId: string,
  folderId: string,
  name: string,
): Promise<void> {
  const { error } = await client
    .from("file_folders")
    .update({ name })
    .eq("id", folderId)
    .eq("user_id", ownerId);
  if (error) throw error;
}

/** Delete one row; the DB cascades child folders and nulls file_sources.folder_id. */
export async function deleteFolder(
  client: SupabaseClient<Database>,
  ownerId: string,
  folderId: string,
): Promise<void> {
  const { error } = await client
    .from("file_folders")
    .delete()
    .eq("id", folderId)
    .eq("user_id", ownerId);
  if (error) throw error;
}

/** Persist a reparent + reorder. Caller computes position via the fractional helpers. */
export async function moveFolder(
  client: SupabaseClient<Database>,
  ownerId: string,
  input: { folderId: string; parentId: string | null; position: number },
): Promise<void> {
  const { error } = await client
    .from("file_folders")
    .update({ parent_id: input.parentId, position: input.position })
    .eq("id", input.folderId)
    .eq("user_id", ownerId);
  if (error) throw error;
}

/** Move many files into a folder (or null to unfile) in one statement. */
export async function setFileFolder(
  client: SupabaseClient<Database>,
  ownerId: string,
  fileIds: string[],
  folderId: string | null,
): Promise<void> {
  if (fileIds.length === 0) return;
  const { error } = await client
    .from("file_sources")
    .update({ folder_id: folderId })
    .in("id", fileIds)
    .eq("user_id", ownerId);
  if (error) throw error;
}
