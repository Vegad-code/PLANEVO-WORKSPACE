import { createHash } from "node:crypto";
import { createAdminClient, isDevDataAccessEnabled } from "@/utils/supabase/admin";
import { getSupabaseAuthAdminKey, getSupabaseUrl } from "@/utils/supabase/keys";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@planevo/core/types/database.types";
import type { DataAccess } from "@planevo/core/types/data-access";

export type { DataAccess, DataAccessMode } from "@planevo/core/types/data-access";

const DEV_OWNER_ALIAS_KEY = "planevo_dev_owner_alias";

type DevAccessCache = {
  alias: string;
  access: DataAccess;
};

let devAccessCache: DevAccessCache | null = null;
let devAccessInflight: Promise<DataAccess | null> | null = null;

function devOwnerEmail(alias: string): string {
  const digest = createHash("sha256").update(alias).digest("hex").slice(0, 32);
  return `planevo-dev-${digest}@local.invalid`;
}

/** Auth Admin lookups only — uses the service_role JWT when available. */
function createAuthAdminClient() {
  return createSupabaseClient<Database>(getSupabaseUrl(), getSupabaseAuthAdminKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function findDevOwnerByAlias(alias: string) {
  const authClient = createAuthAdminClient();
  const expectedEmail = devOwnerEmail(alias);

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await authClient.auth.admin.listUsers({
      page,
      perPage: 1000,
    });
    if (error) throw error;

    const user =
      data.users.find(
        (candidate) =>
          candidate.user_metadata?.[DEV_OWNER_ALIAS_KEY] === alias ||
          candidate.email === expectedEmail,
      ) ?? null;
    if (user) return user;
    if (data.users.length < 1000) return null;
  }

  throw new Error("Unable to resolve the local Planevo development identity.");
}

async function resolveDevOwnerUncached(
  alias: string,
  createIfMissing: boolean,
): Promise<DataAccess | null> {
  const explicitOwnerId = process.env.PLANEVO_DEV_OWNER_UUID?.trim();
  if (explicitOwnerId) {
    return { client: createAdminClient(), ownerId: explicitOwnerId, mode: "dev" };
  }

  const client = createAdminClient();
  const existing = await findDevOwnerByAlias(alias);
  if (existing) return { client, ownerId: existing.id, mode: "dev" };
  if (!createIfMissing) return null;

  const { data, error } = await createAuthAdminClient().auth.admin.createUser({
    email: devOwnerEmail(alias),
    email_confirm: true,
    user_metadata: { [DEV_OWNER_ALIAS_KEY]: alias },
  });
  if (error) {
    const concurrentlyCreated = await findDevOwnerByAlias(alias);
    if (concurrentlyCreated) {
      return { client, ownerId: concurrentlyCreated.id, mode: "dev" };
    }
    throw error;
  }

  return { client, ownerId: data.user.id, mode: "dev" };
}

async function resolveDevOwner(createIfMissing: boolean): Promise<DataAccess | null> {
  const alias = process.env.PLANEVO_DEV_OWNER_ID?.trim();
  if (!alias || !isDevDataAccessEnabled()) return null;

  if (devAccessCache?.alias === alias) {
    return devAccessCache.access;
  }

  if (!devAccessInflight) {
    devAccessInflight = resolveDevOwnerUncached(alias, createIfMissing).finally(() => {
      devAccessInflight = null;
    });
  }

  const access = await devAccessInflight;
  if (access) {
    devAccessCache = { alias, access };
  }
  return access;
}

export async function getDataAccess(): Promise<DataAccess | null> {
  if (isDevDataAccessEnabled()) {
    try {
      return await resolveDevOwner(true);
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
    try {
      return await resolveDevOwner(true);
    } catch {
      return null;
    }
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
