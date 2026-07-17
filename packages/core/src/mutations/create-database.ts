import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getDatabaseTemplate,
  serializeTemplateForRpc,
} from "../defaults/database-templates";
import type { Database, Json } from "../types/database.types";
import type { DatabaseTemplateType } from "../types/property-types";

export type CreateDatabaseInput = {
  workspaceId: string;
  templateType: DatabaseTemplateType;
  name?: string;
  icon?: string;
  parentPageId?: string | null;
  pagePosition?: number;
  createPage?: boolean;
  pageId?: string | null;
};

export type CreateDatabaseResult = {
  workspaceId: string;
  pageId: string | null;
  databaseId: string;
  titlePropertyId: string | null;
};

export class CreateDatabaseError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "CreateDatabaseError";
    this.code = code;
  }
}

function requireResultObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CreateDatabaseError("The database returned an invalid mutation result.");
  }
  return value as Record<string, unknown>;
}

function requireId(value: unknown, key: string): string {
  if (typeof value !== "string" || !value) {
    throw new CreateDatabaseError(`The database did not return ${key}.`);
  }
  return value;
}

function optionalId(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

export async function createDatabase(
  client: SupabaseClient<Database>,
  ownerId: string,
  input: CreateDatabaseInput,
): Promise<CreateDatabaseResult> {
  const template = getDatabaseTemplate(input.templateType);
  const payload = serializeTemplateForRpc(template, {
    name: input.name,
    icon: input.icon,
    parentPageId: input.parentPageId,
    pagePosition: input.pagePosition,
    createPage: input.createPage,
    pageId: input.pageId,
  });

  const { data, error } = await client.rpc("create_database_from_template", {
    p_owner_id: ownerId,
    p_workspace_id: input.workspaceId,
    p_template: payload as Json,
  });

  if (error) throw new CreateDatabaseError(error.message, error.code);

  const result = requireResultObject(data);
  return {
    workspaceId: requireId(result.workspace_id, "workspace_id"),
    pageId: optionalId(result.page_id),
    databaseId: requireId(result.database_id, "database_id"),
    titlePropertyId: optionalId(result.title_property_id),
  };
}
