import "server-only";

import {
  loadCalendarWeek,
  type CalendarWeekData,
} from "@planevo/core/queries/product-calendar";
import { loadProductTasks } from "@planevo/core/queries/product-tasks";
import {
  parseWeekParam,
  weekRange,
} from "@planevo/core/state/calendar-state";
import { getDataAccess } from "@/lib/data/access";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import type { CalendarScope } from "@/lib/calendar/scope-prefs";
import type { TodayColumnTask } from "@/features/calendar-product/today-task-row";

export type CalendarPageData =
  | {
      status: "unauthenticated";
      scope: CalendarScope;
    }
  | ({
      status: "ready";
      scope: CalendarScope;
      weekStart: Date;
      todayTasks: TodayColumnTask[];
      workspaceId: string | null;
    } & CalendarWeekData);

/**
 * Server loader for the Calendar product: one week of calendars/events/task
 * dues plus the Today-column task list. Defaults to the current week when the
 * `week` search param is absent or malformed.
 */
export async function loadCalendarPageData(
  scope: CalendarScope = "all",
  weekValue?: string,
): Promise<CalendarPageData> {
  const currentWorkspace = await getCurrentWorkspace();
  const access = currentWorkspace?.access ?? (await getDataAccess());

  if (!access) {
    return { status: "unauthenticated", scope };
  }

  const anchor = parseWeekParam(weekValue) ?? new Date();
  const { start, end } = weekRange(anchor);
  const workspaceId = currentWorkspace?.workspace.id ?? null;
  const workspaceFilter =
    scope === "workspace" && workspaceId ? { workspaceId } : {};

  const [week, tasks] = await Promise.all([
    loadCalendarWeek(access.client, access.ownerId, {
      start,
      end,
      ...workspaceFilter,
    }),
    loadProductTasks(access.client, access.ownerId, workspaceFilter),
  ]);

  const todayTasks: TodayColumnTask[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    due_at: task.due_at,
  }));

  return {
    status: "ready",
    scope,
    weekStart: start,
    todayTasks,
    workspaceId,
    ...week,
  };
}
