import { cache } from "react";
import { loadTasksBundle, type TasksData } from "@planevo/core/queries/tasks";
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
      statusOptions: [],
      tasks: [],
    };
  }
  return loadTasksBundle(current.access.client, current.workspace.id);
});
