import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type DataAccessMode = "auth" | "dev";

export type DataAccess = {
  client: SupabaseClient<Database>;
  ownerId: string;
  mode: DataAccessMode;
};
