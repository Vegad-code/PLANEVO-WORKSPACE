export const TASKS_SCOPE_STORAGE_KEY = "planevo:tasks:scope";

export type TasksScope = "all" | "workspace";

function isTasksScope(value: string | null): value is TasksScope {
  return value === "all" || value === "workspace";
}

export function getTasksScope(): TasksScope {
  if (typeof window === "undefined") return "all";

  try {
    const storedScope = window.localStorage.getItem(TASKS_SCOPE_STORAGE_KEY);
    return isTasksScope(storedScope) ? storedScope : "all";
  } catch {
    return "all";
  }
}

export function setTasksScope(scope: TasksScope): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(TASKS_SCOPE_STORAGE_KEY, scope);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
