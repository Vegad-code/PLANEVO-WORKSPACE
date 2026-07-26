import "server-only";

import {
  createFoundationMutations,
  type FoundationRpcClient,
} from "@planevo/core/mutations/create-foundations";
import type { WorkspaceRow } from "@planevo/core/types/database.types";
import { isDevDataAccessEnabled } from "@/utils/supabase/admin";
import type { DataAccess } from "@/lib/data/access";

/**
 * Local pre-auth dev has no sign-up/bootstrap flow. When the dev owner exists
 * but has no workspace yet, create one so product uploads and mutations work.
 */
export async function ensureDevWorkspace(
  access: DataAccess,
): Promise<WorkspaceRow | null> {
  if (!isDevDataAccessEnabled()) return null;

  const { data: existing, error: lookupError } = await access.client
    .from("workspaces")
    .select("*")
    .eq("owner_id", access.ownerId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing;

  const mutations = createFoundationMutations(
    access.client as unknown as FoundationRpcClient,
    access.ownerId,
  );
  const { workspaceId } = await mutations.createWorkspace({
    name: "My workspace",
  });

  const { data, error } = await access.client
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single();
  if (error) throw error;
  return data;
}
