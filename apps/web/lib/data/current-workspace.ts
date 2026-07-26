import { cache } from "react";
import { cookies } from "next/headers";
import { getDataAccess, type DataAccess } from "@/lib/data/access";
import { ensureDevWorkspace } from "@/lib/data/ensure-dev-workspace";
import type { WorkspaceRow } from "@planevo/core/types/database.types";

export const WORKSPACE_COOKIE = "planevo_workspace";

export type CurrentWorkspace = {
  access: DataAccess;
  workspace: WorkspaceRow;
};

export async function getPreferredWorkspaceId(): Promise<string | null> {
  const store = await cookies();
  return store.get(WORKSPACE_COOKIE)?.value ?? null;
}

/**
 * The single workspace-resolution path for every feature: the cookie-selected
 * workspace when it exists and is owned by the current user, otherwise the
 * first-created workspace. Request-cached, so features can call it freely.
 */
export const getCurrentWorkspace = cache(
  async (): Promise<CurrentWorkspace | null> => {
    const access = await getDataAccess();
    if (!access) return null;

    const preferredId = await getPreferredWorkspaceId();
    if (preferredId) {
      const { data, error } = await access.client
        .from("workspaces")
        .select("*")
        .eq("id", preferredId)
        .eq("owner_id", access.ownerId)
        .maybeSingle();
      if (error) throw error;
      if (data) return { access, workspace: data };
    }

    const { data, error } = await access.client
      .from("workspaces")
      .select("*")
      .eq("owner_id", access.ownerId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (data) return { access, workspace: data };

    const bootstrapped = await ensureDevWorkspace(access);
    return bootstrapped ? { access, workspace: bootstrapped } : null;
  },
);
