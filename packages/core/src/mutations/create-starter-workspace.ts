import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildStarterSeedPayload,
  type OrganizingAnswer,
} from "../defaults/starter-workspaces.ts";
import type { Database, Json } from "../types/database.types";

export type CreateStarterWorkspaceResult = {
  workspaceId: string;
  gettingStartedPageId: string;
  notesPageId: string;
};

export class CreateStarterWorkspaceError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "CreateStarterWorkspaceError";
    this.code = code;
  }
}

function requireResultObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CreateStarterWorkspaceError(
      "The database returned an invalid starter workspace result.",
    );
  }
  return value as Record<string, unknown>;
}

function requireId(value: unknown, key: string): string {
  if (typeof value !== "string" || !value) {
    throw new CreateStarterWorkspaceError(`The database did not return ${key}.`);
  }
  return value;
}

export async function createStarterWorkspace(
  client: SupabaseClient<Database>,
  ownerId: string,
  input: {
    organizing: OrganizingAnswer;
    displayName?: string | null;
    /** When set, seed into this empty workspace instead of creating a new one. */
    workspaceId?: string | null;
  },
): Promise<CreateStarterWorkspaceResult> {
  const seed = buildStarterSeedPayload(input.organizing, input.displayName);

  const { data, error } = await client.rpc("create_starter_workspace_v2", {
    p_owner_id: ownerId,
    p_seed: seed as unknown as Json,
    p_workspace_id: input.workspaceId ?? null,
  });

  if (error) throw new CreateStarterWorkspaceError(error.message, error.code);

  const result = requireResultObject(data);
  return {
    workspaceId: requireId(result.workspace_id, "workspace_id"),
    gettingStartedPageId: requireId(
      result.getting_started_page_id,
      "getting_started_page_id",
    ),
    notesPageId: requireId(result.notes_page_id, "notes_page_id"),
  };
}
