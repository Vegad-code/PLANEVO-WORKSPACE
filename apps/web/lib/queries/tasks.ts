import { cache } from "react";
import { loadTasksBundle, type TasksData } from "@planevo/core/queries/tasks";
import { loadDatabaseBundle } from "@planevo/core/queries/records";
import { enrichBundleWithRelationTitles } from "@planevo/core/queries/relation-display";
import type { DatabaseBundle } from "@planevo/core/queries/records";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";

export type { TasksData } from "@planevo/core/queries/tasks";

// Errors intentionally propagate to the route error boundary — a failed load
// must never render as an empty workspace. "unavailable" = unauthenticated only.
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

/** Full task database bundle for the F-08 Tasks face. */
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
