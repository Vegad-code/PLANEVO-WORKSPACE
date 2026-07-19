import { cache } from "react";
import { loadTasksBundle, type TasksData } from "@planevo/core/queries/tasks";
import { loadDatabaseBundle } from "@planevo/core/queries/records";
import { enrichBundleWithRelationTitles } from "@planevo/core/queries/relation-display";
import type { DatabaseBundle } from "@planevo/core/queries/records";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";

export type { TasksData } from "@planevo/core/queries/tasks";

// Errors intentionally propagate to the route error boundary — a failed load
// must never render as an empty workspace. "unavailable" = unauthenticated only.
/**
 * @deprecated Kernel task-database bundle, kept only for legacy workspace
 * database surfaces. The Tasks product reads `loadProductTasks` /
 * `loadTasksPageData` (apps/web/lib/queries/product-tasks.ts) instead.
 */
export const getTasksData = cache(async (): Promise<TasksData> => {
  const current = await getCurrentWorkspace();
  if (!current) {
    return {
      status: "unavailable",
      workspaceId: null,
      databaseId: null,
      statusPropertyId: null,
      statusOptions: [],
      tasks: [],
    };
  }
  return loadTasksBundle(current.access.client, current.workspace.id);
});

/** @deprecated Kernel task-database bundle for legacy DatabaseFace routes. */
export const getTaskDatabaseBundle = cache(async (): Promise<{
  workspaceId: string;
  bundle: DatabaseBundle | null;
}> => {
  const current = await getCurrentWorkspace();
  if (!current) return { workspaceId: "", bundle: null };

  const tasks = await loadTasksBundle(current.access.client, current.workspace.id);
  if (!tasks.databaseId) {
    return { workspaceId: current.workspace.id, bundle: null };
  }

  const bundle = await loadDatabaseBundle(current.access.client, tasks.databaseId);
  if (!bundle) return { workspaceId: current.workspace.id, bundle: null };

  const enriched = await enrichBundleWithRelationTitles(current.access.client, bundle);
  return { workspaceId: current.workspace.id, bundle: enriched };
});
