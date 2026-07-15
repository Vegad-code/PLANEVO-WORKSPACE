import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "@planevo/core/types/database.types";
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

/**
 * Dev-mode data access impersonates a fixed owner through the service-role
 * client, bypassing RLS. It must never activate in production: it requires an
 * explicit PLANEVO_DEV_MODE=1 opt-in AND a non-production build.
 */
export function isDevDataAccessEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.PLANEVO_DEV_MODE === "1" &&
    Boolean(process.env.PLANEVO_DEV_OWNER_ID && hasSupabaseServerSecretKey())
  );
}
