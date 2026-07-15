import { createHash } from "node:crypto";
import { createAdminClient, isDevDataAccessEnabled } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import type { DataAccess } from "@planevo/core/types/data-access";

export type { DataAccess, DataAccessMode } from "@planevo/core/types/data-access";

const DEV_OWNER_ALIAS_KEY = "planevo_dev_owner_alias";

async function findDevOwnerByAlias(
  client: ReturnType<typeof createAdminClient>,
  alias: string,
) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;

    const user = data.users.find(
      (candidate) => candidate.user_metadata?.[DEV_OWNER_ALIAS_KEY] === alias,
    );
    if (user) return user;
    if (data.users.length < 1000) return null;
  }

  throw new Error("Unable to resolve the local Planevo development identity.");
}

async function resolveDevOwner(createIfMissing: boolean): Promise<DataAccess | null> {
  const alias = process.env.PLANEVO_DEV_OWNER_ID?.trim();
  if (!alias || !isDevDataAccessEnabled()) return null;

  const client = createAdminClient();
  const existing = await findDevOwnerByAlias(client, alias);
  if (existing) return { client, ownerId: existing.id, mode: "dev" };
  if (!createIfMissing) return null;

  const digest = createHash("sha256").update(alias).digest("hex").slice(0, 32);
  const { data, error } = await client.auth.admin.createUser({
    email: `planevo-dev-${digest}@local.invalid`,
    email_confirm: true,
    user_metadata: { [DEV_OWNER_ALIAS_KEY]: alias },
  });
  if (error) {
    // Concurrent first mutations can race on the deterministic email. Resolve the
    // winner by alias before surfacing the provider error.
    const concurrentlyCreated = await findDevOwnerByAlias(client, alias);
    if (concurrentlyCreated) {
      return { client, ownerId: concurrentlyCreated.id, mode: "dev" };
    }
    throw error;
  }

  return { client, ownerId: data.user.id, mode: "dev" };
}

export async function getDataAccess(): Promise<DataAccess | null> {
  if (isDevDataAccessEnabled()) {
    // Reads may resolve an existing explicit dev identity, but never create one.
    try {
      return await resolveDevOwner(false);
    } catch {
      return null;
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return { client: supabase, ownerId: user.id, mode: "auth" };
  }

  return null;
}

/**
 * Access for explicit writes. In local pre-auth development this is the only path
 * allowed to create the auth identity required by workspace foreign keys.
 */
export async function getMutationDataAccess(): Promise<DataAccess | null> {
  if (isDevDataAccessEnabled()) {
    return resolveDevOwner(true);
  }

  return getDataAccess();
}

export async function requireDataAccess(): Promise<DataAccess> {
  const access = await getDataAccess();
  if (!access) {
    throw new Error(
      "No data access: sign in, or set PLANEVO_DEV_OWNER_ID and a server secret key (SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY) for local dev.",
    );
  }
  return access;
}

export async function requireMutationDataAccess(): Promise<DataAccess> {
  const access = await getMutationDataAccess();
  if (!access) {
    throw new Error(
      "No mutation access: sign in, or configure PLANEVO_DEV_OWNER_ID with a server secret key for local development.",
    );
  }
  return access;
}
