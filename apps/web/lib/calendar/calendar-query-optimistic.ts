import type { CalendarQueryPayload } from "./fetch-calendar-page-data.ts"

/**
 * Pure patchers for the cached calendar payload.
 *
 * Month drag applies these optimistically before the server round-trip. Each
 * returns a new payload and leaves every other record untouched; an unknown id
 * returns the input unchanged, so a write that lands after an invalidation
 * cannot resurrect a stale record.
 */

export type EventTimesPatch = {
  eventId: string
  startsAt: string
  endsAt: string
}

export type TaskDuePatch = {
  taskId: string
  dueAt: string
}

export function patchEventTimes(
  payload: CalendarQueryPayload,
  { eventId, startsAt, endsAt }: EventTimesPatch,
): CalendarQueryPayload {
  const index = payload.events.findIndex((event) => event.id === eventId)
  if (index === -1) return payload

  const events = [...payload.events]
  events[index] = { ...events[index]!, starts_at: startsAt, ends_at: endsAt }
  return { ...payload, events }
}

export function patchTaskDueDate(
  payload: CalendarQueryPayload,
  { taskId, dueAt }: TaskDuePatch,
): CalendarQueryPayload {
  const index = payload.taskDues.findIndex((task) => task.taskId === taskId)
  if (index === -1) return payload

  const taskDues = [...payload.taskDues]
  taskDues[index] = { ...taskDues[index]!, dueAt }
  return { ...payload, taskDues }
}
