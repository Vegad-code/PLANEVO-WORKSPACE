import { cache } from "react";
import { loadDatabaseBundle } from "@planevo/core/queries/records";
import { enrichBundleWithRelationTitles } from "@planevo/core/queries/relation-display";
import type { DatabaseBundle } from "@planevo/core/queries/records";
import type { DatabaseTemplateType } from "@planevo/core/types/property-types";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";

/**
 * @deprecated Kernel face routes (DEP-01) backed by template databases
 * (DEP-02) are being replaced by the ecosystem product tables (Tasks,
 * Calendar, Files modules). See docs/planevo-feature-spec.md PART VIII.
 * Remove after the strangler migration completes.
 */
export type FaceDatabaseBundle = {
  workspaceId: string;
  bundle: DatabaseBundle | null;
};

let warnedFaceDatabasesDeprecated = false;
function warnFaceDatabasesDeprecated() {
  if (process.env.NODE_ENV === "production" || warnedFaceDatabasesDeprecated) return;
  warnedFaceDatabasesDeprecated = true;
  // eslint-disable-next-line no-console
  console.warn(
    "[deprecated] apps/web/lib/queries/face-databases.ts (DEP-01/DEP-02) — " +
      "kernel face routes are being replaced by ecosystem product tables. " +
      "See docs/planevo-feature-spec.md PART VIII.",
  );
}

/** @deprecated See DEP-01/DEP-02 in docs/planevo-feature-spec.md. */
async function loadFaceBundle(
  templateType: DatabaseTemplateType | "calendar",
): Promise<FaceDatabaseBundle> {
  warnFaceDatabasesDeprecated();
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

/** @deprecated Replaced by the Tasks module (F-03). See DEP-01. */
export const getTaskFaceBundle = cache(() => loadFaceBundle("task"));
/** @deprecated Replaced by the Calendar module (F-04). See DEP-01. */
export const getCalendarFaceBundle = cache(() => loadFaceBundle("calendar"));
/** @deprecated Replaced by the Files module (F-05). See DEP-01. */
export const getFilesFaceBundle = cache(() => loadFaceBundle("files"));
