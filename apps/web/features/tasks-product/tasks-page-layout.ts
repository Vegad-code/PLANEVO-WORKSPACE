import type { TasksView } from "./tasks-toolbar";

const FULL_BLEED_VIEWS = new Set<TasksView>(["board", "list", "table"]);

export function getTasksPageLayoutClass(
  view: TasksView,
  hasContent: boolean,
): string {
  if (hasContent && FULL_BLEED_VIEWS.has(view)) {
    return "flex min-h-full w-full flex-col px-5 pt-6 pb-6 sm:px-6 lg:px-8";
  }
  return "mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8";
}

export function isTasksFullBleedView(view: TasksView, hasContent: boolean): boolean {
  return hasContent && FULL_BLEED_VIEWS.has(view);
}
