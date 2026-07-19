import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../types/database.types";
import type { PromoteBlockInput, PromoteBlocksResult } from "./promote-blocks";

export class PromoteBlocksAtomicError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "PromoteBlocksAtomicError";
    this.code = code;
  }
}

export type PromoteBlocksAtomicResult = PromoteBlocksResult & {
  contentJson: unknown;
};

/**
 * Atomic F-10: insert records and patch page content_json in one RPC.
 * When nextContent is omitted, the database rebuilds content by replacing
 * source block ids with a database_view block.
 */
export async function promoteBlocksToRecordsAtomic(
  client: SupabaseClient<Database>,
  ownerId: string,
  input: {
    pageId: string;
    databaseId: string;
    blocks: PromoteBlockInput[];
    nextContent?: unknown;
  },
): Promise<PromoteBlocksAtomicResult> {
  const blocksPayload = input.blocks.map((block) => ({
    blockId: block.blockId,
    title: block.title,
    status: block.status,
    priority: block.priority,
    dueDate: block.dueDate,
  }));

  const { data, error } = await client.rpc("promote_blocks_to_records", {
    p_owner_id: ownerId,
    p_page_id: input.pageId,
    p_database_id: input.databaseId,
    p_blocks: blocksPayload as unknown as Json,
    p_next_content: (input.nextContent ?? null) as Json,
  });

  if (error) throw new PromoteBlocksAtomicError(error.message, error.code);

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new PromoteBlocksAtomicError("Invalid promote result.");
  }

  const result = data as Record<string, unknown>;
  const databaseId =
    typeof result.database_id === "string" ? result.database_id : null;
  const rawIds = result.record_ids;
  const recordIds = Array.isArray(rawIds)
    ? rawIds.filter((id): id is string => typeof id === "string")
    : [];

  if (!databaseId) {
    throw new PromoteBlocksAtomicError("Promote result missing database_id.");
  }

  return {
    databaseId,
    recordIds,
    contentJson: result.content_json ?? null,
  };
}
