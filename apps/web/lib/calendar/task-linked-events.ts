import type {
  CalendarDisplayEvent,
  CalendarEventRow,
  CalendarLinkedTask,
} from "@planevo/core/types/calendar"
import type { TaskStatus } from "@planevo/core/types/tasks"

export type TaskLinkSource = {
  id: string
  title: string
  status: TaskStatus
  description_json: Record<string, unknown>
}

export function taskEstimateMinutes(
  description: Record<string, unknown>,
): number | null {
  const estimate = description.estimateMinutes
  return typeof estimate === "number" &&
    Number.isInteger(estimate) &&
    estimate > 0 &&
    estimate <= 10_080
    ? estimate
    : null
}

export function toCalendarLinkedTask(task: TaskLinkSource): CalendarLinkedTask {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    estimateMinutes: taskEstimateMinutes(task.description_json),
  }
}

export function decorateTaskLinkedEvents(input: {
  events: CalendarEventRow[]
  tasks: CalendarLinkedTask[]
}): CalendarDisplayEvent[] {
  const tasksById = new Map(input.tasks.map((task) => [task.id, task]))
  return input.events.map((event) => ({
    ...event,
    linked_task: event.task_id
      ? tasksById.get(event.task_id) ?? null
      : null,
  }))
}

export function isLinkedTaskComplete(
  task: CalendarLinkedTask | null,
): boolean {
  return task?.status === "done" || task?.status === "cancelled"
}
