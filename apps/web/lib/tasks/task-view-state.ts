import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskPriority,
  type TaskStatus,
} from "@planevo/core/types/tasks";

type ViewTask = { id: string; status: string; priority: string | null; position: number };
export type TaskListGrouping = "status" | "priority";
export type TaskListGroupKey = TaskStatus | TaskPriority | "none";

function ordered<T extends ViewTask>(tasks: readonly T[]): T[] {
  return [...tasks].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

export function activeTasks<T extends ViewTask>(tasks: readonly T[]): T[] {
  return tasks.filter((task) => task.status !== "cancelled");
}

export function groupTasksForList<T extends ViewTask>(
  tasks: readonly T[],
  grouping: TaskListGrouping,
): Array<{ key: TaskListGroupKey; tasks: T[] }> {
  const keys: readonly TaskListGroupKey[] = grouping === "status"
    ? TASK_STATUSES
    : [...TASK_PRIORITIES].reverse().map((priority) => priority as TaskListGroupKey).concat(["none"]);
  return keys.map((key) => ({
    key,
    tasks: ordered(tasks.filter((task) =>
      grouping === "status" ? task.status === key : (task.priority ?? "none") === key,
    )),
  }));
}
