import { cache } from "react";
import { loadDatabaseBundle } from "@planevo/core/queries/records";
import { enrichBundleWithRelationTitles } from "@planevo/core/queries/relation-display";
import type { DatabaseBundle } from "@planevo/core/queries/records";
import type { DatabaseTemplateType } from "@planevo/core/types/property-types";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";

export type FaceDatabaseBundle = {
  workspaceId: string;
  bundle: DatabaseBundle | null;
};

async function loadFaceBundle(
  templateType: DatabaseTemplateType | "calendar",
): Promise<FaceDatabaseBundle> {
  const current = await getCurrentWorkspace();
  if (!current) return { workspaceId: "", bundle: null };

  const { data: database, error } = await current.access.client
    .from("databases")
    .select("id")
    .eq("workspace_id", current.workspace.id)
    .eq("template_type", templateType)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!database) return { workspaceId: current.workspace.id, bundle: null };

  const bundle = await loadDatabaseBundle(current.access.client, database.id);
  if (!bundle) return { workspaceId: current.workspace.id, bundle: null };

  const enriched = await enrichBundleWithRelationTitles(current.access.client, bundle);
  return { workspaceId: current.workspace.id, bundle: enriched };
}

export const getTaskFaceBundle = cache(() => loadFaceBundle("task"));
export const getCalendarFaceBundle = cache(() => loadFaceBundle("calendar"));
export const getFilesFaceBundle = cache(() => loadFaceBundle("files"));
