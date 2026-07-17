import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../types/database.types";
import type { TaskPriority, TaskRow, TaskStatus } from "../types/tasks";
import { positionBetween } from "../ordering/fractional.ts";

type SubtaskRow = Database["public"]["Tables"]["task_subtasks"]["Row"];

export type CreateTaskInput = {
  title: string;
  status?: TaskStatus;
  priority?: TaskPriority | null;
  due_at?: string | null;
};

export type UpdateTaskInput = {
  title?: string;
  priority?: TaskPriority | null;
  due_at?: string | null;
  description_json?: Record<string, unknown>;
};

function nowIso(): string {
  return new Date().toISOString();
}

/** Insert a task for `userId`. Status defaults to "not_started" (DB CHECK). */
export async function createTask(
  client: SupabaseClient<Database>,
  userId: string,
  input: CreateTaskInput,
): Promise<TaskRow> {
  const { data, error } = await client
    .from("tasks")
    .insert({
      user_id: userId,
      title: input.title,
      status: input.status ?? "not_started",
      priority: input.priority ?? null,
      due_at: input.due_at ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  // ponytail: DB CHECK constraints guarantee status/priority match the enums.
  return data as unknown as TaskRow;
}

/** Patch editable task fields. Scoped by id + user_id for RLS defense in depth. */
export async function updateTask(
  client: SupabaseClient<Database>,
  userId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<void> {
  const { error } = await client
    .from("tasks")
    .update({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.due_at !== undefined ? { due_at: input.due_at } : {}),
      ...(input.description_json !== undefined
        ? { description_json: input.description_json as Json }
        : {}),
      updated_at: nowIso(),
    })
    .eq("id", taskId)
    .eq("user_id", userId);
  if (error) throw error;
}

/** Set status; stamp completed_at on entering "done", clear it on leaving. */
export async function updateTaskStatus(
  client: SupabaseClient<Database>,
  userId: string,
  taskId: string,
  status: TaskStatus,
): Promise<void> {
  const { error } = await client
    .from("tasks")
    .update({
      status,
      completed_at: status === "done" ? nowIso() : null,
      updated_at: nowIso(),
    })
    .eq("id", taskId)
    .eq("user_id", userId);
  if (error) throw error;
}

/**
 * Move a task to the midpoint between its new neighbours. `before`/`after` are
 * the neighbour positions (null = that end of the list is open). Rewrites one
 * row via the shared fractional ordering helper.
 */
export async function reorderTask(
  client: SupabaseClient<Database>,
  userId: string,
  taskId: string,
  before: number | null,
  after: number | null,
): Promise<void> {
  const { error } = await client
    .from("tasks")
    .update({ position: positionBetween(before, after), updated_at: nowIso() })
    .eq("id", taskId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteTask(
  client: SupabaseClient<Database>,
  userId: string,
  taskId: string,
): Promise<void> {
  const { error } = await client
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", userId);
  if (error) throw error;
}

// Subtasks: scoped by the task's RLS policy (no user_id column), so these
// operate on task_subtasks directly. Kept minimal per plan.

export async function createSubtask(
  client: SupabaseClient<Database>,
  taskId: string,
  title: string,
): Promise<SubtaskRow> {
  const { data, error } = await client
    .from("task_subtasks")
    // ponytail: Date.now() appends in order without a max(position)+1 read;
    // two inserts in the same millisecond tie — upgrade to a max read if that
    // ever matters.
    .insert({ task_id: taskId, title, position: Date.now() })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function toggleSubtask(
  client: SupabaseClient<Database>,
  subtaskId: string,
  isDone: boolean,
): Promise<void> {
  const { error } = await client
    .from("task_subtasks")
    .update({ is_done: isDone })
    .eq("id", subtaskId);
  if (error) throw error;
}

export async function deleteSubtask(
  client: SupabaseClient<Database>,
  subtaskId: string,
): Promise<void> {
  const { error } = await client
    .from("task_subtasks")
    .delete()
    .eq("id", subtaskId);
  if (error) throw error;
}
