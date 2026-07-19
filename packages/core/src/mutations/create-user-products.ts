import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildProductSeedPayload,
  type OrganizingAnswer,
} from "../defaults/product-defaults.ts";
import type { Database, Json } from "../types/database.types";

export type CreateUserProductsResult = {
  calendarId: string;
  taskIds: string[];
  created: boolean;
};

export class CreateUserProductsError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "CreateUserProductsError";
    this.code = code;
  }
}

function requireResultObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CreateUserProductsError(
      "The database returned an invalid user products result.",
    );
  }
  return value as Record<string, unknown>;
}

function requireId(value: unknown, key: string): string {
  if (typeof value !== "string" || !value) {
    throw new CreateUserProductsError(`The database did not return ${key}.`);
  }
  return value;
}

function requireIdArray(value: unknown, key: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new CreateUserProductsError(`The database did not return ${key}.`);
  }
  return value as string[];
}

export async function createUserProducts(
  client: SupabaseClient<Database>,
  input: {
    userId: string;
    organizing: OrganizingAnswer | null;
  },
): Promise<CreateUserProductsResult> {
  const seed = buildProductSeedPayload({ organizing: input.organizing });

  const { data, error } = await client.rpc("create_user_products", {
    p_user_id: input.userId,
    p_seed: seed as unknown as Json,
  });

  if (error) throw new CreateUserProductsError(error.message, error.code);

  const result = requireResultObject(data);
  return {
    calendarId: requireId(result.calendar_id, "calendar_id"),
    taskIds: requireIdArray(result.task_ids, "task_ids"),
    created: result.created === true,
  };
}
