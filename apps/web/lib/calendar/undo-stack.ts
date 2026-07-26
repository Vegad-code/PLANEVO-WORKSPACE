import type { CalendarEventRow } from "@planevo/core/types/calendar"

/**
 * Immutable, UI-independent state for Calendar's short undo window.
 *
 * Restore payloads contain the values changed by their originating mutation so
 * an undo does not need to infer prior local times, duration, or task due date
 * from the event's current state.
 */

export const DEFAULT_CALENDAR_UNDO_TTL_MS = 8_000

export type LinkedTaskDueRestore = {
  taskId: string
  dueAt: string | null
}

export type DeleteEventUndoPayload = {
  kind: "restore-event"
  operation: "delete"
  eventId: string
  deletedAt: string | null
}

export type UnscheduleTaskUndoPayload = {
  kind: "restore-event"
  operation: "unschedule"
  eventId: string
  deletedAt: string | null
  linkedTask: LinkedTaskDueRestore
}

export type RestoreEventTimesUndoPayload = {
  kind: "restore-times"
  operation: "move" | "resize"
  eventId: string
  startsAt: string
  endsAt: string
  startsAtLocal: string | null
  endsAtLocal: string | null
  durationMinutes: number | null
  linkedTask: LinkedTaskDueRestore | null
}

export type RestoreRecurringSeriesUndoPayload = {
  kind: "restore-series"
  operation: "recurrence-delete" | "recurrence-move" | "recurrence-resize"
  masterEventId: string
  guardEventId: string
  newMasterEventId: string | null
  eventRows: CalendarEventRow[]
}

export type CalendarUndoPayload =
  | DeleteEventUndoPayload
  | UnscheduleTaskUndoPayload
  | RestoreEventTimesUndoPayload
  | RestoreRecurringSeriesUndoPayload

export type CalendarUndoEntry = {
  id: string
  recordedAt: number
  expiresAt: number
  payload: CalendarUndoPayload
}

export type CalendarUndoStack = Readonly<{
  ttlMs: number
  entries: readonly CalendarUndoEntry[]
}>

export type PopUndoResult = Readonly<{
  stack: CalendarUndoStack
  entry: CalendarUndoEntry | null
}>

function clonePayload(payload: CalendarUndoPayload): CalendarUndoPayload {
  switch (payload.operation) {
    case "delete":
      return { ...payload }
    case "unschedule":
      return { ...payload, linkedTask: { ...payload.linkedTask } }
    case "move":
    case "resize":
      return {
        ...payload,
        linkedTask: payload.linkedTask ? { ...payload.linkedTask } : null,
      }
    case "recurrence-delete":
    case "recurrence-move":
    case "recurrence-resize":
      return {
        ...payload,
        eventRows: structuredClone(payload.eventRows),
      }
    default: {
      const exhaustive: never = payload
      return exhaustive
    }
  }
}

export function createUndoStack({
  ttlMs = DEFAULT_CALENDAR_UNDO_TTL_MS,
}: {
  ttlMs?: number
} = {}): CalendarUndoStack {
  return {
    ttlMs:
      Number.isFinite(ttlMs) && ttlMs > 0
        ? ttlMs
        : DEFAULT_CALENDAR_UNDO_TTL_MS,
    entries: [],
  }
}

/** Remove entries whose undo deadline has passed. */
export function expireUndo({
  stack,
  now = Date.now(),
}: {
  stack: CalendarUndoStack
  now?: number
}): CalendarUndoStack {
  if (!Number.isFinite(now) || stack.entries.length === 0) return stack

  const entries = stack.entries.filter((entry) => now < entry.expiresAt)
  return entries.length === stack.entries.length
    ? stack
    : { ...stack, entries }
}

/** Add one undo, replacing an existing toast with the same stable id. */
export function pushUndo({
  stack,
  id,
  payload,
  now = Date.now(),
}: {
  stack: CalendarUndoStack
  id: string
  payload: CalendarUndoPayload
  now?: number
}): CalendarUndoStack {
  if (!id.trim() || !Number.isFinite(now)) return stack

  const live = expireUndo({ stack, now })
  const entry: CalendarUndoEntry = {
    id,
    recordedAt: now,
    expiresAt: now + live.ttlMs,
    payload: clonePayload(payload),
  }

  return {
    ...live,
    entries: [
      ...live.entries.filter((existing) => existing.id !== id),
      entry,
    ],
  }
}

/**
 * Consume an undo by toast id. Expired and unknown ids fail closed with null;
 * an expired entry is pruned even when it was the requested item.
 */
export function popUndo({
  stack,
  id,
  now = Date.now(),
}: {
  stack: CalendarUndoStack
  id: string
  now?: number
}): PopUndoResult {
  if (!id.trim() || !Number.isFinite(now)) return { stack, entry: null }

  const live = expireUndo({ stack, now })
  const index = live.entries.findIndex((entry) => entry.id === id)
  if (index === -1) return { stack: live, entry: null }

  return {
    stack: {
      ...live,
      entries: [
        ...live.entries.slice(0, index),
        ...live.entries.slice(index + 1),
      ],
    },
    entry: live.entries[index] ?? null,
  }
}
