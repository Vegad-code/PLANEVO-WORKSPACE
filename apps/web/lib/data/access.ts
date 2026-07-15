import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, isDevDataAccessEnabled } from "@/utils/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import type { Database } from "@/lib/database.types";

export type DataAccessMode = "auth" | "dev";

export type DataAccess = {
  client: SupabaseClient<Database>;
  ownerId: string;
  mode: DataAccessMode;
};

export async function getDataAccess(): Promise<DataAccess | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return { client: supabase, ownerId: user.id, mode: "auth" };
  }

  const preAuthOwnerId = process.env.PLANEVO_DEV_OWNER_ID?.trim();

  if (preAuthOwnerId && isDevDataAccessEnabled()) {
    return {
      client: createAdminClient(),
      ownerId: preAuthOwnerId,
      mode: "dev",
    };
  }

  return null;
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
