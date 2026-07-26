import type { CalendarDisplayEvent } from "@planevo/core/types/calendar"
import type { TaskStatus } from "@planevo/core/types/tasks"
import type { TodayColumnTask } from "@/features/calendar-product/today-task-row"
import type { EventPanelSavePayload } from "@/features/calendar-product/event-detail-panel"
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
  moveLinkedBlock?: boolean
}

export const OPTIMISTIC_EVENT_ID_PREFIX = "optimistic-event-"
export const OPTIMISTIC_TASK_ID_PREFIX = "optimistic-task-"

export function isOptimisticId(id: string): boolean {
  return (
    id.startsWith(OPTIMISTIC_EVENT_ID_PREFIX) ||
    id.startsWith(OPTIMISTIC_TASK_ID_PREFIX)
  )
}

export function createOptimisticEventId(): string {
  return `${OPTIMISTIC_EVENT_ID_PREFIX}${crypto.randomUUID()}`
}

export function createOptimisticTaskId(): string {
  return `${OPTIMISTIC_TASK_ID_PREFIX}${crypto.randomUUID()}`
}

export function patchEventTimes(
  payload: CalendarQueryPayload,
  { eventId, startsAt, endsAt }: EventTimesPatch,
): CalendarQueryPayload {
  const index = payload.events.findIndex((event) => event.id === eventId)
  if (index === -1) return payload

  const events = [...payload.events]
  const current = events[index]!
  const taskId = current.task_id
  events[index] = {
    ...current,
    starts_at: startsAt,
    ends_at: endsAt,
  }

  let taskDues = payload.taskDues
  if (taskId) {
    taskDues = payload.taskDues.map((task) =>
      task.taskId === taskId ? { ...task, dueAt: startsAt } : task,
    )
  }

  const taskDuesChanged = taskDues.some(
    (task, taskIndex) => task !== payload.taskDues[taskIndex],
  )

  return taskDuesChanged
    ? { ...payload, events, taskDues }
    : { ...payload, events }
}

export function patchTaskDueDate(
  payload: CalendarQueryPayload,
  { taskId, dueAt, moveLinkedBlock = true }: TaskDuePatch,
): CalendarQueryPayload {
  const index = payload.taskDues.findIndex((task) => task.taskId === taskId)
  if (index === -1) return payload

  const taskDues = [...payload.taskDues]
  taskDues[index] = { ...taskDues[index]!, dueAt }

  if (!moveLinkedBlock) {
    return { ...payload, taskDues }
  }

  const linkedEventIndex = payload.events.findIndex(
    (event) => event.task_id === taskId,
  )
  if (linkedEventIndex === -1) {
    return { ...payload, taskDues }
  }

  const events = [...payload.events]
  const linkedEvent = events[linkedEventIndex]!
  const durationMs = Math.max(
    60_000,
    new Date(linkedEvent.ends_at).getTime() -
      new Date(linkedEvent.starts_at).getTime(),
  )
  const endsAt = new Date(new Date(dueAt).getTime() + durationMs).toISOString()
  events[linkedEventIndex] = {
    ...linkedEvent,
    starts_at: dueAt,
    ends_at: endsAt,
  }

  return { ...payload, events, taskDues }
}

export function removeEvent(
  payload: CalendarQueryPayload,
  eventId: string,
): CalendarQueryPayload {
  const events = payload.events.filter((event) => event.id !== eventId)
  if (events.length === payload.events.length) return payload
  return { ...payload, events }
}

export function appendEvent(
  payload: CalendarQueryPayload,
  event: CalendarDisplayEvent,
): CalendarQueryPayload {
  return { ...payload, events: [...payload.events, event] }
}

export function replaceEventId(
  payload: CalendarQueryPayload,
  { tempId, serverId }: { tempId: string; serverId: string },
): CalendarQueryPayload {
  const index = payload.events.findIndex((event) => event.id === tempId)
  if (index === -1) return payload

  const events = [...payload.events]
  events[index] = { ...events[index]!, id: serverId }
  return { ...payload, events }
}

export function patchEventFields(
  payload: CalendarQueryPayload,
  {
    eventId,
    fields,
  }: {
    eventId: string
    fields: EventPanelSavePayload
  },
): CalendarQueryPayload {
  const index = payload.events.findIndex((event) => event.id === eventId)
  if (index === -1) return payload

  const events = [...payload.events]
  const current = events[index]!
  const taskId = current.task_id
  events[index] = {
    ...current,
    calendar_id: fields.calendarId,
    title: fields.title,
    starts_at: fields.startsAt,
    ends_at: fields.endsAt,
    starts_at_local: fields.startsAtLocal,
    ends_at_local: fields.endsAtLocal,
    timezone: fields.timezone,
    duration_minutes: fields.durationMinutes,
    all_day: fields.allDay,
    rrule: fields.rrule,
    location: fields.location,
    description_json: { text: fields.description },
    ...(taskId && current.linked_task
      ? {
          linked_task: {
            ...current.linked_task,
            title: current.linked_task.title,
          },
        }
      : {}),
  }

  let taskDues = payload.taskDues
  if (taskId) {
    taskDues = payload.taskDues.map((task) =>
      task.taskId === taskId ? { ...task, dueAt: fields.startsAt } : task,
    )
  }

  const taskDuesChanged = taskDues.some(
    (task, taskIndex) => task !== payload.taskDues[taskIndex],
  )

  return taskDuesChanged
    ? { ...payload, events, taskDues }
    : { ...payload, events }
}

export function buildOptimisticEvent({
  tempId,
  payload,
  userId,
  taskId = null,
  linkedTask = null,
}: {
  tempId: string
  payload: EventPanelSavePayload
  userId: string
  taskId?: string | null
  linkedTask?: CalendarDisplayEvent["linked_task"]
}): CalendarDisplayEvent {
  const now = new Date().toISOString()
  return {
    id: tempId,
    calendar_id: payload.calendarId,
    user_id: userId,
    title: payload.title,
    starts_at: payload.startsAt,
    ends_at: payload.endsAt,
    starts_at_local: payload.startsAtLocal,
    ends_at_local: payload.endsAtLocal,
    timezone: payload.timezone,
    duration_minutes: payload.durationMinutes,
    rrule: payload.rrule,
    recurrence_end: null,
    parent_event_id: null,
    recurrence_id: null,
    is_exception: false,
    is_cancelled: false,
    deleted_at: null,
    color: null,
    conference_url: null,
    all_day: payload.allDay,
    location: payload.location,
    description_json: { text: payload.description },
    task_id: taskId,
    google_event_id: null,
    external_connection_id: null,
    external_event_id: null,
    external_etag: null,
    external_updated_at: null,
    source: "planevo",
    created_at: now,
    updated_at: now,
    linked_task: linkedTask,
  }
}

export function buildOptimisticScheduledEvent({
  tempId,
  taskId,
  title,
  startsAt,
  endsAt,
  userId,
  calendarId,
}: {
  tempId: string
  taskId: string
  title: string
  startsAt: string
  endsAt: string
  userId: string
  calendarId: string
}): CalendarDisplayEvent {
  const startsAtLocal = startsAt.slice(0, 19)
  const endsAtLocal = endsAt.slice(0, 19)
  const durationMinutes = Math.max(
    1,
    Math.round(
      (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000,
    ),
  )

  return buildOptimisticEvent({
    tempId,
    userId,
    taskId,
    linkedTask: {
      id: taskId,
      title,
      status: "not_started",
      estimateMinutes: null,
    },
    payload: {
      calendarId,
      title,
      startsAt,
      endsAt,
      startsAtLocal,
      endsAtLocal,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
      durationMinutes,
      rrule: null,
      location: null,
      description: "",
      reminderOffsetMinutes: null,
      allDay: false,
    },
  })
}

export function patchTaskStatus(
  payload: CalendarQueryPayload,
  { taskId, status }: { taskId: string; status: TaskStatus },
): CalendarQueryPayload {
  const taskDues = payload.taskDues.map((task) =>
    task.taskId === taskId ? { ...task, status } : task,
  )
  const todayTasks = payload.todayTasks.map((task) =>
    task.id === taskId ? { ...task, status } : task,
  )
  const events = payload.events.map((event) =>
    event.task_id === taskId && event.linked_task
      ? {
          ...event,
          linked_task: { ...event.linked_task, status },
        }
      : event,
  )

  const taskDuesChanged = taskDues.some(
    (task, index) => task !== payload.taskDues[index],
  )
  const todayChanged = todayTasks.some(
    (task, index) => task !== payload.todayTasks[index],
  )
  const eventsChanged = events.some(
    (event, index) => event !== payload.events[index],
  )

  if (!taskDuesChanged && !todayChanged && !eventsChanged) return payload

  return { ...payload, taskDues, todayTasks, events }
}

export function appendTodayTask(
  payload: CalendarQueryPayload,
  task: TodayColumnTask,
): CalendarQueryPayload {
  if (payload.todayTasks.some((entry) => entry.id === task.id)) return payload
  return { ...payload, todayTasks: [...payload.todayTasks, task] }
}

export function removeTodayTask(
  payload: CalendarQueryPayload,
  taskId: string,
): CalendarQueryPayload {
  const todayTasks = payload.todayTasks.filter((task) => task.id !== taskId)
  if (todayTasks.length === payload.todayTasks.length) return payload
  return { ...payload, todayTasks }
}

export function resolveUserIdFromPayload(
  payload: CalendarQueryPayload | undefined,
): string {
  return payload?.events[0]?.user_id ?? "optimistic-user"
}
