"use client"

import { useCallback, useMemo, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type {
  CalendarDisplayEvent,
  CalendarEventRow,
  CalendarContext,
} from "@planevo/core/types/calendar"
import type { TaskStatus } from "@planevo/core/types/tasks"
import {
  completeTaskLinkedEventAction,
  createCalendarEventAction,
  deleteCalendarEventAction,
  quickAddTaskAction,
  restoreCalendarEventTimesAction,
  scheduleTaskFromDragAction,
  setTaskStatusAction,
  unscheduleTaskLinkedEventAction,
  updateCalendarEventAction,
  updateEventTimesAction,
  updateTaskDueDateAction,
  type CalendarActionResult,
} from "@/app/(workspace)/calendar/actions"
import {
  appendEvent,
  appendTodayTask,
  buildOptimisticEvent,
  buildOptimisticScheduledEvent,
  createOptimisticEventId,
  createOptimisticTaskId,
  patchEventFields,
  patchEventTimes,
  patchTaskDueDate,
  patchTaskStatus,
  removeEvent,
  removeTodayTask,
  replaceEventId,
  resolveUserIdFromPayload,
  type EventTimesPatch,
  type TaskDuePatch,
} from "@/lib/calendar/calendar-query-optimistic"
import {
  calendarCacheKeys,
  cancelCalendarQueries,
  invalidateIntersectingRanges,
  patchAllIntersectingCalendarCaches,
  readMergedCalendarCache,
  restoreCalendarCacheSnapshot,
  writeMergedCalendarCache,
  type EventTimeWindow,
} from "@/lib/calendar/calendar-query-cache"
import { defaultCalendarId } from "@/lib/calendar/default-calendar"
import type { CalendarQueryPayload } from "@/lib/calendar/fetch-calendar-page-data"
import { quickAddTaskDueAt } from "@/lib/calendar/quick-add-task-due"
import type { MonthMoveResult } from "@/lib/calendar/month-drag"
import type { CalendarScope } from "@/lib/calendar/scope-prefs"
import { toast } from "@/components/ui/toast"
import { resolveEventMutationTarget } from "@/lib/calendar/event-mutation-target"
import type { CalendarView } from "./calendar-toolbar"
import type { EventPanelSavePayload } from "./event-detail-panel"

type MutationContext = {
  scope: CalendarScope
  context: CalendarContext
  view: CalendarView
  anchor: Date
}

/** Full prior state of a moved/resized event, as captured before the change. */
type RestoreEventTimesInput = {
  eventId: string
  startsAt: string
  endsAt: string
  startsAtLocal: string | null
  endsAtLocal: string | null
  durationMinutes: number | null
}

type OptimisticMutationInput<T> = {
  patch: (payload: CalendarQueryPayload) => CalendarQueryPayload
  action: () => Promise<CalendarActionResult<T>>
  eventWindow?: EventTimeWindow | null
  touchToday?: boolean
  entityKey?: string
  onSuccess?: (data: T) => void
  onError?: () => void
  errorMessage?: string
}

/**
 * Central optimistic mutation hook for the calendar product.
 *
 * cancelQueries → snapshot all intersecting caches → patch → fire action →
 * reconcile on success / restore snapshots on failure. Same-entity mutations
 * serialize through a per-id queue so rapid re-drags cannot race.
 */
export function useCalendarMutations({
  scope,
  context,
  view,
  anchor,
}: MutationContext) {
  const queryClient = useQueryClient()
  const keys = useMemo(
    () => calendarCacheKeys({ scope, context, view, anchor }),
    [anchor, context, scope, view],
  )
  const queuesRef = useRef(new Map<string, Promise<void>>())

  const enqueue = useCallback((entityKey: string | undefined, work: () => Promise<void>) => {
    if (!entityKey) {
      void work()
      return
    }
    const previous = queuesRef.current.get(entityKey) ?? Promise.resolve()
    const next = previous
      .catch(() => undefined)
      .then(work)
      .finally(() => {
        if (queuesRef.current.get(entityKey) === next) {
          queuesRef.current.delete(entityKey)
        }
      })
    queuesRef.current.set(entityKey, next)
  }, [])

  const runOptimistic = useCallback(
    <T,>({
      patch,
      action,
      eventWindow = null,
      touchToday = true,
      entityKey,
      onSuccess,
      onError,
      errorMessage,
    }: OptimisticMutationInput<T>) => {
      enqueue(entityKey, async () => {
        await cancelCalendarQueries(queryClient, scope)
        const snapshot = patchAllIntersectingCalendarCaches({
          queryClient,
          scope,
          activeKeys: keys,
          eventWindow,
          patch,
          touchToday,
        })

        const result = await action()
        if (!result.ok) {
          restoreCalendarCacheSnapshot(queryClient, snapshot)
          toast(errorMessage ?? result.error, { tone: "error" })
          if (result.code === "CALENDAR_CONFLICT" && eventWindow) {
            invalidateIntersectingRanges({
              queryClient,
              scope,
              start: eventWindow.startsAt,
              end: eventWindow.endsAt,
            })
          }
          onError?.()
          return
        }
        onSuccess?.(result.data as T)
      })
    },
    [enqueue, keys, queryClient, scope],
  )

  const patchCache = useCallback(
    (
      patch: (payload: CalendarQueryPayload) => CalendarQueryPayload,
      eventWindow?: EventTimeWindow | null,
    ) => {
      void cancelCalendarQueries(queryClient, scope).then(() => {
        patchAllIntersectingCalendarCaches({
          queryClient,
          scope,
          activeKeys: keys,
          eventWindow,
          patch,
          touchToday: true,
        })
      })
    },
    [keys, queryClient, scope],
  )

  const moveEventTimes = useCallback(
    (input: EventTimesPatch) => {
      runOptimistic({
        patch: (payload) => patchEventTimes(payload, input),
        action: () => updateEventTimesAction(input),
        eventWindow: {
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        },
        entityKey: `event:${input.eventId}`,
        touchToday: false,
      })
    },
    [runOptimistic],
  )

  /**
   * Undo for a move/resize. Unlike `moveEventTimes`, this restores the authored
   * wall clock and duration too — `starts_at`/`ends_at` are a derived cache of
   * `starts_at_local` + `timezone`, so putting back only the UTC pair leaves the
   * row internally inconsistent. The action also re-syncs a linked task's due
   * date, which the forward move path changed on the way in.
   */
  const restoreEventTimes = useCallback(
    (input: RestoreEventTimesInput) => {
      runOptimistic({
        patch: (payload) =>
          patchEventTimes(payload, {
            eventId: input.eventId,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
          }),
        action: () => restoreCalendarEventTimesAction(input),
        eventWindow: {
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        },
        entityKey: `event:${input.eventId}`,
        touchToday: false,
      })
    },
    [runOptimistic],
  )

  const moveTaskDueDate = useCallback(
    (input: TaskDuePatch) => {
      runOptimistic({
        patch: (payload) => patchTaskDueDate(payload, input),
        action: () => updateTaskDueDateAction(input),
        eventWindow: { startsAt: input.dueAt, endsAt: input.dueAt },
        entityKey: `task:${input.taskId}`,
      })
    },
    [runOptimistic],
  )

  const applyMonthMove = useCallback(
    (
      move: MonthMoveResult,
      options?: {
        onRecurringEventMove?: (
          move: Extract<MonthMoveResult, { kind: "event" }>,
        ) => void
        onEventMoveCommitted?: (
          move: Extract<MonthMoveResult, { kind: "event" }>,
        ) => void
      },
    ) => {
      if (
        move.kind === "event" &&
        resolveEventMutationTarget(move.event)?.kind !== "standalone"
      ) {
        options?.onRecurringEventMove?.(move)
        return
      }

      if (move.kind === "event") {
        runOptimistic({
          patch: (payload) => patchEventTimes(payload, move),
          action: () => updateEventTimesAction(move),
          eventWindow: {
            startsAt: move.startsAt,
            endsAt: move.endsAt,
          },
          entityKey: `event:${move.eventId}`,
          touchToday: false,
          onSuccess: () => options?.onEventMoveCommitted?.(move),
        })
        return
      }

      runOptimistic({
        patch: (payload) => patchTaskDueDate(payload, move),
        action: () => updateTaskDueDateAction(move),
        eventWindow: { startsAt: move.dueAt, endsAt: move.dueAt },
        entityKey: `task:${move.taskId}`,
      })
    },
    [runOptimistic],
  )

  const createEvent = useCallback(
    (
      payload: EventPanelSavePayload,
      options?: {
        onCommitted?: (eventId: string) => void
        onError?: () => void
      },
    ) => {
      const tempId = createOptimisticEventId()
      runOptimistic({
        patch: (current) => {
          const userId = resolveUserIdFromPayload(current)
          return appendEvent(
            current,
            buildOptimisticEvent({ tempId, payload, userId }),
          )
        },
        action: () => createCalendarEventAction(payload),
        eventWindow: {
          startsAt: payload.startsAt,
          endsAt: payload.endsAt,
        },
        touchToday: false,
        onSuccess: (data) => {
          patchCache(
            (current) =>
              replaceEventId(current, { tempId, serverId: data.eventId }),
            { startsAt: payload.startsAt, endsAt: payload.endsAt },
          )
          options?.onCommitted?.(data.eventId)
        },
        onError: options?.onError,
      })
      return tempId
    },
    [patchCache, runOptimistic],
  )

  const updateEvent = useCallback(
    (
      eventId: string,
      payload: EventPanelSavePayload,
      options?: { onCommitted?: () => void; onError?: () => void },
    ) => {
      runOptimistic({
        patch: (current) =>
          patchEventFields(current, { eventId, fields: payload }),
        action: () => updateCalendarEventAction({ eventId, ...payload }),
        eventWindow: {
          startsAt: payload.startsAt,
          endsAt: payload.endsAt,
        },
        entityKey: `event:${eventId}`,
        touchToday: false,
        onSuccess: () => options?.onCommitted?.(),
        onError: options?.onError,
      })
    },
    [runOptimistic],
  )

  const deleteEvent = useCallback(
    (eventId: string, eventWindow?: EventTimeWindow | null) => {
      runOptimistic({
        patch: (payload) => removeEvent(payload, eventId),
        action: () => deleteCalendarEventAction({ eventId }),
        eventWindow,
        entityKey: `event:${eventId}`,
        touchToday: false,
      })
    },
    [runOptimistic],
  )

  const toggleTaskStatus = useCallback(
    (taskId: string, done: boolean) => {
      const status: TaskStatus = done ? "done" : "not_started"
      runOptimistic({
        patch: (payload) => patchTaskStatus(payload, { taskId, status }),
        action: () => setTaskStatusAction({ taskId, status }),
        entityKey: `task:${taskId}`,
      })
    },
    [runOptimistic],
  )

  const scheduleTask = useCallback(
    ({
      taskId,
      title,
      startsAt,
      operationKey,
      onCommitted,
    }: {
      taskId: string
      title: string
      startsAt: string
      operationKey: string
      onCommitted?: () => void
    }) => {
      const tempId = createOptimisticEventId()
      const startsAtMs = new Date(startsAt).getTime()
      const endsAt = new Date(startsAtMs + 30 * 60_000).toISOString()
      let targetCalendarId = ""

      runOptimistic({
        patch: (current) => {
          const userId = resolveUserIdFromPayload(current)
          targetCalendarId =
            context.kind === "calendar"
              ? context.calendarId
              : current.calendars.find(({ is_main }) => is_main)?.id ??
                defaultCalendarId(current.calendars)
          const withEvent = appendEvent(
            current,
            buildOptimisticScheduledEvent({
              tempId,
              taskId,
              title,
              startsAt,
              endsAt,
              userId,
              calendarId: targetCalendarId,
            }),
          )
          return removeTodayTask(withEvent, taskId)
        },
        action: () =>
          scheduleTaskFromDragAction({
            taskId,
            calendarId: targetCalendarId,
            operationKey,
            startsAt,
          }),
        eventWindow: { startsAt, endsAt },
        entityKey: `task:${taskId}`,
        onSuccess: (data) => {
          patchCache(
            (current) =>
              replaceEventId(current, { tempId, serverId: data.eventId }),
            { startsAt, endsAt },
          )
          onCommitted?.()
        },
      })
    },
    [context, patchCache, runOptimistic],
  )

  const quickAddTask = useCallback(
    (
      input: { title: string; bucket: "week" | "month" | "none" },
      options?: { onCommitted?: () => void },
    ) => {
      const dueAt = quickAddTaskDueAt(input.bucket)
      const tempId = createOptimisticTaskId()
      let targetCalendarId = ""
      runOptimistic({
        patch: (payload) => {
          targetCalendarId =
            context.kind === "calendar"
              ? context.calendarId
              : payload.calendars.find(({ is_main }) => is_main)?.id ??
                defaultCalendarId(payload.calendars)
          return appendTodayTask(payload, {
            id: tempId,
            title: input.title,
            status: "not_started",
            due_at: dueAt,
          })
        },
        action: () =>
          quickAddTaskAction({
            ...input,
            calendarId: targetCalendarId,
          }),
        onSuccess: (data) => {
          const merged = readMergedCalendarCache(queryClient, keys)
          if (!merged) return
          writeMergedCalendarCache(queryClient, keys, {
            ...merged,
            todayTasks: merged.todayTasks.map((task) =>
              task.id === tempId ? { ...task, id: data.taskId } : task,
            ),
          })
          options?.onCommitted?.()
        },
      })
    },
    [context, keys, queryClient, runOptimistic],
  )

  const completeLinkedTask = useCallback(
    (event: CalendarEventRow) => {
      const taskId = event.task_id
      if (!taskId) return

      runOptimistic({
        patch: (payload) =>
          patchTaskStatus(payload, { taskId, status: "done" }),
        action: () => completeTaskLinkedEventAction({ eventId: event.id }),
        eventWindow: {
          startsAt: event.starts_at,
          endsAt: event.ends_at,
        },
        entityKey: `event:${event.id}`,
      })
    },
    [runOptimistic],
  )

  const unscheduleLinkedTask = useCallback(
    (event: CalendarDisplayEvent | CalendarEventRow) => {
      const taskId = event.task_id
      if (!taskId) return

      const linkedStatus =
        "linked_task" in event && event.linked_task
          ? event.linked_task.status
          : "not_started"

      runOptimistic({
        patch: (payload) => {
          const withoutEvent = removeEvent(payload, event.id)
          return appendTodayTask(withoutEvent, {
            id: taskId,
            title: event.title,
            status: linkedStatus,
            due_at: event.starts_at,
          })
        },
        action: () => unscheduleTaskLinkedEventAction({ eventId: event.id }),
        eventWindow: {
          startsAt: event.starts_at,
          endsAt: event.ends_at,
        },
        entityKey: `event:${event.id}`,
      })
    },
    [runOptimistic],
  )

  /**
   * Optimistic this-occurrence move/resize: patch the occurrence row in cache,
   * fire the recurring action, skip success-path intersecting invalidate.
   */
  const commitRecurringThisMove = useCallback(
    (input: {
      eventId: string
      startsAt: string
      endsAt: string
      action: () => Promise<
        CalendarActionResult<{
          undo: {
            masterEventId: string
            guardEventId: string
            newMasterEventId: string | null
            eventRows: CalendarEventRow[]
          }
        }>
      >
      onSuccess?: (data: {
        undo: {
          masterEventId: string
          guardEventId: string
          newMasterEventId: string | null
          eventRows: CalendarEventRow[]
        }
      }) => void
      onError?: () => void
    }) => {
      runOptimistic({
        patch: (payload) =>
          patchEventTimes(payload, {
            eventId: input.eventId,
            startsAt: input.startsAt,
            endsAt: input.endsAt,
          }),
        action: input.action,
        eventWindow: {
          startsAt: input.startsAt,
          endsAt: input.endsAt,
        },
        entityKey: `event:${input.eventId}`,
        touchToday: false,
        onSuccess: (data) => input.onSuccess?.(data),
        onError: input.onError,
      })
    },
    [runOptimistic],
  )

  /**
   * Optimistic this-occurrence field save: patch the occurrence row in cache,
   * fire the recurring action, skip success-path intersecting invalidate.
   */
  const commitRecurringThisSave = useCallback(
    (input: {
      eventId: string
      payload: EventPanelSavePayload
      action: () => Promise<
        CalendarActionResult<{
          undo: {
            masterEventId: string
            guardEventId: string
            newMasterEventId: string | null
            eventRows: CalendarEventRow[]
          }
        }>
      >
      onSuccess?: (data: {
        undo: {
          masterEventId: string
          guardEventId: string
          newMasterEventId: string | null
          eventRows: CalendarEventRow[]
        }
      }) => void
      onError?: () => void
    }) => {
      runOptimistic({
        patch: (payload) =>
          patchEventFields(payload, {
            eventId: input.eventId,
            fields: input.payload,
          }),
        action: input.action,
        eventWindow: {
          startsAt: input.payload.startsAt,
          endsAt: input.payload.endsAt,
        },
        entityKey: `event:${input.eventId}`,
        touchToday: false,
        onSuccess: (data) => input.onSuccess?.(data),
        onError: input.onError,
      })
    },
    [runOptimistic],
  )

  return {
    moveEventTimes,
    restoreEventTimes,
    moveTaskDueDate,
    applyMonthMove,
    createEvent,
    updateEvent,
    deleteEvent,
    toggleTaskStatus,
    scheduleTask,
    quickAddTask,
    completeLinkedTask,
    unscheduleLinkedTask,
    commitRecurringThisMove,
    commitRecurringThisSave,
  }
}
