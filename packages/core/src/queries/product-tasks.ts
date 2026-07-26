import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";
import type { TaskRow } from "../types/tasks";
import { listWorkspaceResourceIds } from "./workspace-links.ts";

export type SubtaskRow = Database["public"]["Tables"]["task_subtasks"]["Row"];

export type TaskWithMeta = TaskRow & {
  subtaskTotal: number;
  subtaskDone: number;
  fileCount: number;
  linkedEventCount: number;
  subtasks: SubtaskRow[];
};

export type LoadProductTasksOptions = {
  /** F-02 "This workspace" filter — only tasks linked into this workspace. */
  workspaceId?: string;
};

/**
 * Load a user's tasks (ordered by `position`) with subtask progress and
 * attached-file and live scheduled-block counts. Related rows are batch-loaded
 * with `.in(...)` rather than per-task, so query count stays constant as the
 * task list grows.
 */
export async function loadProductTasks(
  client: SupabaseClient<Database>,
  userId: string,
  options: LoadProductTasksOptions = {},
): Promise<TaskWithMeta[]> {
  let allowedIds: string[] | null = null;
  if (options.workspaceId) {
    allowedIds = await listWorkspaceResourceIds(client, {
      workspaceId: options.workspaceId,
      resourceType: "task",
    });
    if (allowedIds.length === 0) return [];
  }

  let query = client.from("tasks").select("*").eq("user_id", userId);
  if (allowedIds) query = query.in("id", allowedIds);
  const { data: taskData, error: taskError } = await query.order("position", {
    ascending: true,
  });
  if (taskError) throw taskError;
  // ponytail: DB CHECK constraints guarantee status/priority match the TaskRow
  // enums, so narrowing the generated Row here is safe.
  const tasks = (taskData ?? []) as unknown as TaskRow[];
  if (tasks.length === 0) return [];

  const taskIds = tasks.map((task) => task.id);

  const { data: subtaskData, error: subtaskError } = await client
    .from("task_subtasks")
    .select("*")
    .in("task_id", taskIds);
  if (subtaskError) throw subtaskError;

  const { data: fileData, error: fileError } = await client
    .from("file_links")
    .select("target_id")
    .eq("target_type", "task")
    .in("target_id", taskIds);
  if (fileError) throw fileError;

  const { data: linkedEventData, error: linkedEventError } = await client
    .from("calendar_events")
    .select("task_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("task_id", taskIds);
  if (linkedEventError) throw linkedEventError;

  const subtasksByTask = new Map<string, SubtaskRow[]>();
  for (const subtask of subtaskData ?? []) {
    const list = subtasksByTask.get(subtask.task_id) ?? [];
    list.push(subtask);
    subtasksByTask.set(subtask.task_id, list);
  }

  const fileCountByTask = new Map<string, number>();
  for (const link of fileData ?? []) {
    fileCountByTask.set(
      link.target_id,
      (fileCountByTask.get(link.target_id) ?? 0) + 1,
    );
  }

  const linkedEventCountByTask = new Map<string, number>();
  for (const event of linkedEventData ?? []) {
    if (!event.task_id) continue;
    linkedEventCountByTask.set(
      event.task_id,
      (linkedEventCountByTask.get(event.task_id) ?? 0) + 1,
    );
  }

  return tasks.map((task) => {
    const subtasks = (subtasksByTask.get(task.id) ?? []).sort(
      (left, right) => left.position - right.position,
    );
    return {
      ...task,
      subtasks,
      subtaskTotal: subtasks.length,
      subtaskDone: subtasks.filter((subtask) => subtask.is_done).length,
      fileCount: fileCountByTask.get(task.id) ?? 0,
      linkedEventCount: linkedEventCountByTask.get(task.id) ?? 0,
    };
  });
}
