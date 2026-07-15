import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  getSupabaseServerSecretKey,
  getSupabaseUrl,
  hasSupabaseServerSecretKey,
} from "@/utils/supabase/keys";

/**
 * Server-only admin client. Bypasses RLS — never import from Client Components.
 * Uses SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY (legacy).
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("createAdminClient() must only run on the server.");
  }

  return createClient<Database>(getSupabaseUrl(), getSupabaseServerSecretKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function isDevDataAccessEnabled(): boolean {
  return Boolean(process.env.PLANEVO_DEV_OWNER_ID && hasSupabaseServerSecretKey());
}
