import type { CalendarEventRow, TaskDueChip } from "@planevo/core/types/calendar"

/**
 * Tasks with a live scheduled block in the visible event set should not also
 * render as due chips — the block is the canonical scheduled surface.
 */
export function scheduledTaskIdsFromEvents(
  events: readonly Pick<CalendarEventRow, "task_id">[],
): Set<string> {
  const ids = new Set<string>()
  for (const event of events) {
    if (event.task_id) ids.add(event.task_id)
  }
  return ids
}

export function filterTaskDuesWithoutScheduledBlocks(
  taskDues: readonly TaskDueChip[],
  events: readonly Pick<CalendarEventRow, "task_id">[],
): TaskDueChip[] {
  const scheduled = scheduledTaskIdsFromEvents(events)
  if (scheduled.size === 0) return [...taskDues]
  return taskDues.filter((task) => !scheduled.has(task.taskId))
}
