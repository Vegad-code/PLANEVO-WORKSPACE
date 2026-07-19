import "server-only";

import {
  loadProductTasks,
  type TaskWithMeta,
} from "@planevo/core/queries/product-tasks";
import { getDataAccess } from "@/lib/data/access";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import type { TasksScope } from "@/lib/tasks/scope-prefs";

export type TasksPageData =
  | {
      status: "unauthenticated";
      tasks: [];
      workspaceId: null;
      workspaceName: null;
      scope: TasksScope;
    }
  | {
      status: "ready";
      tasks: TaskWithMeta[];
      workspaceId: string | null;
      workspaceName: string | null;
      scope: TasksScope;
    };

/**
 * Server loader for the Tasks product. The RSC path defaults to all tasks
 * because the persisted scope preference is browser-local. Callers may pass an
 * explicit workspace scope once that preference has hydrated on the client.
 */
export async function loadTasksPageData(
  scope: TasksScope = "all",
): Promise<TasksPageData> {
  const currentWorkspace = await getCurrentWorkspace();
  const access = currentWorkspace?.access ?? (await getDataAccess());

  if (!access) {
    return {
      status: "unauthenticated",
      tasks: [],
      workspaceId: null,
      workspaceName: null,
      scope,
    };
  }

  const workspaceId = currentWorkspace?.workspace.id ?? null;
  const tasks = await loadProductTasks(
    access.client,
    access.ownerId,
    scope === "workspace" && workspaceId ? { workspaceId } : {},
  );

  return {
    status: "ready",
    tasks,
    workspaceId,
    workspaceName: currentWorkspace?.workspace.name ?? null,
    scope,
  };
}
