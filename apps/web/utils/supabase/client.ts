import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@planevo/core/types/database.types";
import { getSupabasePublicConfig } from "@/utils/supabase/keys";

export function createClient() {
  const { url, key } = getSupabasePublicConfig();
  return createBrowserClient<Database>(url, key);
}
