"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import * as RRulePackage from "rrule";
import { z } from "zod";
import { attachFileToEvent } from "@planevo/core/mutations/file-cross-links";
import {
  restoreCalendarEventUndo,
  restoreCalendarSeriesUndo,
} from "@planevo/core/mutations/calendar-undo";
import {
  createCalendar,
  createCalendarEvent,
  createCalendarView,
  deleteCalendarView,
  deleteCalendarEvent,
  scheduleTaskFromDrag,
  setDefaultCalendar,
  setDefaultCalendarView,
  softDeleteCalendarEvent,
  splitCalendarEventSeries,
  truncateCalendarEventSeries,
  updateCalendarDetails,
  updateCalendarEvent,
  updateCalendarView,
  updateCalendarVisibility,
  upsertCalendarEventException,
} from "@planevo/core/mutations/product-calendar";
import { createTask, updateTask } from "@planevo/core/mutations/product-tasks";
import {
  completeTaskLinkedEvent,
  linkTaskToEvent,
  moveTaskLinkedEvent,
  setTaskStatusWithLinkedEvents,
  unscheduleTaskLinkedEvent,
} from "@planevo/core/mutations/task-calendar-roundtrip";
import { linkResourceToWorkspace } from "@planevo/core/mutations/workspace-links";
import { CALENDAR_COLORS } from "@planevo/core/types/calendar";
import type {
  CalendarEventRow,
  CalendarViewConfigOverrides,
} from "@planevo/core/types/calendar";
import type { DataAccess } from "@/lib/data/access";
import { requireMutationDataAccess } from "@/lib/data/access";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import {
  taskCrossLinkOptions,
  type TaskCrossLinkOptions,
} from "@/lib/tasks/task-cross-link-contracts";
import { taskEstimateMinutes } from "@/lib/calendar/task-linked-events";
import {
  deriveRecurrenceBoundary,
  instantToLocalDateTime,
  localDateTimeToInstant,
  remapRecurrenceIdentitiesForSplit,
} from "@/lib/calendar/recurrence";
import {
  VIEW_PRESETS,
  viewConfigSchema,
  type ViewConfig,
} from "@/lib/calendar/view-config";
import { createCalendarDatabaseWithViews, createWorkspace } from "../actions";

const { RRule } =
  "RRule" in RRulePackage
    ? RRulePackage
    : (RRulePackage as unknown as { default: typeof import("rrule") }).default;

export type EventTaskOption = {
  id: string;
  title: string;
};

export type EventCrossLinkOptions = TaskCrossLinkOptions & {
  tasks: EventTaskOption[];
};

export type CalendarActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; correlationId?: string };

function actionError(
  cause: unknown,
  fallback: string,
): CalendarActionResult<never> {
  const correlationId = randomUUID();
  console.error(`[calendar:${correlationId}]`, cause);

  if (cause instanceof Error) {
    if (cause.message.startsWith("No mutation access")) {
      return {
        ok: false,
        code: "CALENDAR_AUTH_UNAVAILABLE",
        error:
          "Could not save — local dev identity is unavailable. Restart the dev server, or set PLANEVO_DEV_OWNER_UUID in .env.local.",
        correlationId,
      };
    }
    if (
      cause.message === "Event not found." ||
      cause.message === "Task not found."
    ) {
      return {
        ok: false,
        code: "CALENDAR_NOT_FOUND",
        error: cause.message,
        correlationId,
      };
    }
  }

  return {
    ok: false,
    code: "CALENDAR_ACTION_FAILED",
    error: fallback,
    correlationId,
  };
}

async function requireOwnedCalendar(
  access: DataAccess,
  calendarId: string,
): Promise<void> {
  const { data, error } = await access.client
    .from("calendars")
    .select("id")
    .eq("id", calendarId)
    .eq("user_id", access.ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Calendar not found.");
}

const isoDateTimeSchema = z.string().datetime({ offset: true });
const localDateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
const timezoneSchema = z
  .string()
  .min(1)
  .max(120)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid timezone.");
const rruleSchema = z
  .string()
  .trim()
  .min(1)
  .max(1000)
  .refine((value) => {
    try {
      new RRule(RRule.parseString(value));
      return true;
    } catch {
      return false;
    }
  }, "Check the recurrence rule.");

const createCalendarEventSchema = z
  .object({
    calendarId: z.string().uuid(),
    title: z.string().trim().min(1).max(500),
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema,
    startsAtLocal: localDateTimeSchema,
    endsAtLocal: localDateTimeSchema,
    timezone: timezoneSchema,
    durationMinutes: z.number().int().positive().max(525_600),
    rrule: rruleSchema.nullable(),
    location: z.string().trim().max(500).nullable().optional(),
    description: z.string().trim().max(5000).optional(),
  })
  .refine(
    (input) =>
      new Date(input.endsAt).getTime() > new Date(input.startsAt).getTime(),
    { message: "The event must end after it starts." },
  );

export async function createCalendarEventAction(input: {
  calendarId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  startsAtLocal: string;
  endsAtLocal: string;
  timezone: string;
  durationMinutes: number;
  rrule: string | null;
  location?: string | null;
  description?: string;
}): Promise<CalendarActionResult<{ eventId: string }>> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = createCalendarEventSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error:
          parsed.error.issues[0]?.message ??
          "Check the event details and try again.",
      };
    }
    await requireOwnedCalendar(access, parsed.data.calendarId);
    const recurrenceBoundary = parsed.data.rrule
      ? deriveRecurrenceBoundary({
          rrule: parsed.data.rrule,
          startsAtLocal: parsed.data.startsAtLocal,
          timezone: parsed.data.timezone,
        })
      : { valid: true as const, recurrenceEnd: null };
    if (!recurrenceBoundary.valid) {
      return {
        ok: false,
        error: "This repeat pattern is too large or does not match its start.",
      };
    }
    const event = await createCalendarEvent(access.client, access.ownerId, {
      calendarId: parsed.data.calendarId,
      title: parsed.data.title,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      startsAtLocal: parsed.data.startsAtLocal,
      endsAtLocal: parsed.data.endsAtLocal,
      timezone: parsed.data.timezone,
      durationMinutes: parsed.data.durationMinutes,
      rrule: parsed.data.rrule,
      recurrenceEnd: recurrenceBoundary.recurrenceEnd,
      location: parsed.data.location ?? null,
      description: parsed.data.description
        ? { text: parsed.data.description }
        : undefined,
    });
    revalidatePath("/calendar");
    return { ok: true, data: { eventId: event.id } };
  } catch (cause) {
    return actionError(cause, "Could not create the event.");
  }
}

const createCalendarSchema = z.object({
  name: z.string().trim().min(1).max(120),
  color: z.enum(CALENDAR_COLORS),
});

export async function createCalendarAction(input: {
  name: string;
  color: string;
}): Promise<CalendarActionResult<{ calendarId: string }>> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = createCalendarSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Give the calendar a name and a color." };
    }
    const calendar = await createCalendar(
      access.client,
      access.ownerId,
      parsed.data,
    );
    revalidatePath("/calendar");
    return { ok: true, data: { calendarId: calendar.id } };
  } catch (cause) {
    return actionError(cause, "Could not create the calendar.");
  }
}

const toggleVisibilitySchema = z.object({
  calendarId: z.string().uuid(),
  isVisible: z.boolean(),
});

export async function toggleCalendarVisibilityAction(input: {
  calendarId: string;
  isVisible: boolean;
}): Promise<CalendarActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = toggleVisibilitySchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Choose a valid calendar." };
    }
    await updateCalendarVisibility(
      access.client,
      access.ownerId,
      parsed.data.calendarId,
      parsed.data.isVisible,
    );
    revalidatePath("/calendar");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not update the calendar.");
  }
}

const updateCalendarDetailsSchema = z.object({
  calendarId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  color: z.enum(CALENDAR_COLORS),
});

export async function updateCalendarDetailsAction(input: {
  calendarId: string;
  name: string;
  color: string;
}): Promise<CalendarActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = updateCalendarDetailsSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Give the calendar a name and a color." };
    }
    await updateCalendarDetails(
      access.client,
      access.ownerId,
      parsed.data.calendarId,
      {
        name: parsed.data.name,
        color: parsed.data.color,
      },
    );
    revalidatePath("/calendar");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not update the calendar.");
  }
}

const setDefaultCalendarSchema = z.object({
  calendarId: z.string().uuid(),
});

export async function setDefaultCalendarAction(input: {
  calendarId: string;
}): Promise<CalendarActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = setDefaultCalendarSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Choose a valid calendar." };
    }
    await setDefaultCalendar(
      access.client,
      access.ownerId,
      parsed.data.calendarId,
    );
    revalidatePath("/calendar");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not set the default calendar.");
  }
}

const calendarViewOverridesSchema = viewConfigSchema.partial();
const calendarViewFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  preset: z.enum(VIEW_PRESETS),
  config: calendarViewOverridesSchema,
  sourceCalendarIds: z.array(z.string().uuid()).max(100),
  includeTaskDues: z.boolean(),
});
const updateCalendarViewFieldsSchema = calendarViewFieldsSchema.partial();

function toCalendarViewOverrides(
  config: Partial<ViewConfig>,
): CalendarViewConfigOverrides {
  return structuredClone(config) as CalendarViewConfigOverrides;
}

export async function createCalendarViewAction(input: {
  name: string;
  preset: string;
  config: Partial<ViewConfig>;
  sourceCalendarIds: string[];
  includeTaskDues: boolean;
}): Promise<CalendarActionResult<{ viewId: string }>> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = calendarViewFieldsSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Check the saved view settings." };
    }
    const savedView = await createCalendarView(access.client, access.ownerId, {
      ...parsed.data,
      config: toCalendarViewOverrides(parsed.data.config),
    });
    revalidatePath("/calendar");
    return { ok: true, data: { viewId: savedView.id } };
  } catch (cause) {
    return actionError(cause, "Could not create the saved view.");
  }
}

export async function updateCalendarViewAction(input: {
  viewId: string;
  name?: string;
  preset?: string;
  config?: Partial<ViewConfig>;
  sourceCalendarIds?: string[];
  includeTaskDues?: boolean;
}): Promise<CalendarActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = z
      .object({
        viewId: z.string().uuid(),
        ...updateCalendarViewFieldsSchema.shape,
      })
      .safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Check the saved view settings." };
    }
    const { viewId, config, ...fields } = parsed.data;
    await updateCalendarView(access.client, access.ownerId, viewId, {
      ...fields,
      ...(config === undefined
        ? {}
        : { config: toCalendarViewOverrides(config) }),
    });
    revalidatePath("/calendar");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not update the saved view.");
  }
}

const calendarViewIdSchema = z.object({
  viewId: z.string().uuid(),
});

export async function deleteCalendarViewAction(input: {
  viewId: string;
}): Promise<CalendarActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = calendarViewIdSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Choose a valid saved view." };
    }
    await deleteCalendarView(access.client, access.ownerId, parsed.data.viewId);
    revalidatePath("/calendar");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not delete the saved view.");
  }
}

export async function setDefaultCalendarViewAction(input: {
  viewId: string;
}): Promise<CalendarActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = calendarViewIdSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Choose a valid saved view." };
    }
    await setDefaultCalendarView(
      access.client,
      access.ownerId,
      parsed.data.viewId,
    );
    revalidatePath("/calendar");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not set the default saved view.");
  }
}

const scheduleFromDragSchema = z.object({
  taskId: z.string().uuid(),
  operationKey: z.string().uuid(),
  startsAt: isoDateTimeSchema,
});

export async function scheduleTaskFromDragAction(input: {
  taskId: string;
  operationKey: string;
  startsAt: string;
}): Promise<CalendarActionResult<{ eventId: string }>> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = scheduleFromDragSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Choose a valid drop time." };
    }
    const { data: task, error } = await access.client
      .from("tasks")
      .select("id,title,description_json")
      .eq("id", parsed.data.taskId)
      .eq("user_id", access.ownerId)
      .maybeSingle();
    if (error) throw error;
    if (!task) return { ok: false, error: "Task not found." };

    const event = await scheduleTaskFromDrag(access.client, access.ownerId, {
      operationKey: parsed.data.operationKey,
      taskId: task.id,
      title: task.title,
      startsAt: parsed.data.startsAt,
      durationMinutes:
        taskEstimateMinutes(task.description_json as Record<string, unknown>) ??
        60,
    });
    revalidatePath("/calendar");
    revalidatePath("/tasks");
    return { ok: true, data: { eventId: event.id } };
  } catch (cause) {
    return actionError(cause, "Could not schedule the task.");
  }
}

const setTaskStatusSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(["not_started", "done"]),
});

/**
 * Toggle a task done/undone from the Today-column checkbox. Only the two
 * checkbox states are accepted; ownership is re-checked before the write.
 */
export async function setTaskStatusAction(input: {
  taskId: string;
  status: "not_started" | "done";
}): Promise<CalendarActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = setTaskStatusSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid task update." };
    await setTaskStatusWithLinkedEvents(access.client, access.ownerId, {
      taskId: parsed.data.taskId,
      status: parsed.data.status,
    });
    revalidatePath("/calendar");
    revalidatePath("/tasks");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not update the task.");
  }
}

/** Sunday 23:59 of the current week (Monday-start), for a "this week" quick-add. */
function endOfWeekIso(now: Date): string {
  const date = new Date(now);
  const daysUntilSunday = (7 - date.getDay()) % 7;
  date.setDate(date.getDate() + daysUntilSunday);
  date.setHours(23, 59, 0, 0);
  return date.toISOString();
}

/** Last day of the current month at 23:59, for a "this month" quick-add. */
function endOfMonthIso(now: Date): string {
  return new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    0,
    0,
  ).toISOString();
}

const quickAddTaskSchema = z.object({
  title: z.string().trim().min(1).max(500),
  bucket: z.enum(["week", "month", "none"]),
});

/**
 * Quick-add a task from a Today-rail group's "+" control. The bucket picks a
 * due date so the new task lands back in the same group after refresh.
 */
export async function quickAddTaskAction(input: {
  title: string;
  bucket: "week" | "month" | "none";
}): Promise<CalendarActionResult<{ taskId: string }>> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = quickAddTaskSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Enter a task title." };
    const now = new Date();
    const dueAt =
      parsed.data.bucket === "week"
        ? endOfWeekIso(now)
        : parsed.data.bucket === "month"
          ? endOfMonthIso(now)
          : null;
    const task = await createTask(access.client, access.ownerId, {
      operationKey: randomUUID(),
      title: parsed.data.title,
      due_at: dueAt,
    });
    revalidatePath("/calendar");
    revalidatePath("/tasks");
    return { ok: true, data: { taskId: task.id } };
  } catch (cause) {
    return actionError(cause, "Could not add the task.");
  }
}

async function requireOwnedEvent(
  access: DataAccess,
  eventId: string,
): Promise<
  Pick<
    CalendarEventRow,
    "id" | "task_id" | "starts_at" | "ends_at" | "timezone"
  >
> {
  const { data, error } = await access.client
    .from("calendar_events")
    .select("id,task_id,starts_at,ends_at,timezone")
    .eq("id", eventId)
    .eq("user_id", access.ownerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Event not found.");
  return data;
}

const eventIdSchema = z.object({ eventId: z.string().uuid() });

const updateEventTimesSchema = z
  .object({
    eventId: z.string().uuid(),
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema,
  })
  .refine(
    (input) =>
      new Date(input.endsAt).getTime() > new Date(input.startsAt).getTime(),
    { message: "The event must end after it starts." },
  );

const restoreEventTimesSchema = z
  .object({
    eventId: z.string().uuid(),
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema,
    startsAtLocal: localDateTimeSchema.nullable(),
    endsAtLocal: localDateTimeSchema.nullable(),
    durationMinutes: z.number().int().positive().max(525_600).nullable(),
  })
  .refine(
    (input) =>
      new Date(input.endsAt).getTime() > new Date(input.startsAt).getTime(),
    { message: "The event must end after it starts." },
  );

const updateCalendarEventSchema = z
  .object({
    eventId: z.string().uuid(),
    title: z.string().trim().min(1).max(500).optional(),
    startsAt: isoDateTimeSchema.optional(),
    endsAt: isoDateTimeSchema.optional(),
    startsAtLocal: localDateTimeSchema.optional(),
    endsAtLocal: localDateTimeSchema.optional(),
    timezone: timezoneSchema.optional(),
    durationMinutes: z.number().int().positive().max(525_600).optional(),
    rrule: rruleSchema.nullable().optional(),
    calendarId: z.string().uuid().optional(),
    location: z.string().trim().max(500).nullable().optional(),
    description: z.string().trim().max(5000).optional(),
  })
  .refine(
    (input) => {
      if (!input.startsAt || !input.endsAt) return true;
      return (
        new Date(input.endsAt).getTime() > new Date(input.startsAt).getTime()
      );
    },
    { message: "The event must end after it starts." },
  );

/** Update editable event fields from the event detail panel. */
export async function updateCalendarEventAction(input: {
  eventId: string;
  title?: string;
  startsAt?: string;
  endsAt?: string;
  startsAtLocal?: string;
  endsAtLocal?: string;
  timezone?: string;
  durationMinutes?: number;
  rrule?: string | null;
  calendarId?: string;
  location?: string | null;
  description?: string;
}): Promise<CalendarActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = updateCalendarEventSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error:
          parsed.error.issues[0]?.message ??
          "Check the event details and try again.",
      };
    }
    const ownedEvent = await requireOwnedEvent(access, parsed.data.eventId);
    if (ownedEvent.task_id && parsed.data.rrule) {
      return {
        ok: false,
        error: "Task blocks cannot repeat. Unschedule the task first.",
      };
    }
    if (parsed.data.calendarId) {
      await requireOwnedCalendar(access, parsed.data.calendarId);
    }
    const recurrenceBoundary =
      parsed.data.rrule === undefined
        ? null
        : parsed.data.rrule === null
          ? { valid: true as const, recurrenceEnd: null }
          : parsed.data.startsAtLocal && parsed.data.timezone
            ? deriveRecurrenceBoundary({
                rrule: parsed.data.rrule,
                startsAtLocal: parsed.data.startsAtLocal,
                timezone: parsed.data.timezone,
              })
            : { valid: false as const, recurrenceEnd: null };
    if (recurrenceBoundary && !recurrenceBoundary.valid) {
      return {
        ok: false,
        error: "A repeating event needs a valid local start and timezone.",
      };
    }
    const syncTaskDueTime =
      Boolean(ownedEvent.task_id) &&
      (parsed.data.startsAt !== undefined || parsed.data.endsAt !== undefined);
    if (syncTaskDueTime) {
      const startsAt = parsed.data.startsAt ?? ownedEvent.starts_at;
      const endsAt = parsed.data.endsAt ?? ownedEvent.ends_at;
      if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
        return { ok: false, error: "The event must end after it starts." };
      }
      await moveTaskLinkedEvent(access.client, access.ownerId, {
        eventId: parsed.data.eventId,
        startsAt,
        endsAt,
      });
    }

    await updateCalendarEvent(
      access.client,
      access.ownerId,
      parsed.data.eventId,
      {
        ...(parsed.data.title !== undefined
          ? { title: parsed.data.title }
          : {}),
        ...(!syncTaskDueTime && parsed.data.startsAt !== undefined
          ? { startsAt: parsed.data.startsAt }
          : {}),
        ...(!syncTaskDueTime && parsed.data.endsAt !== undefined
          ? { endsAt: parsed.data.endsAt }
          : {}),
        ...(parsed.data.startsAtLocal !== undefined
          ? { startsAtLocal: parsed.data.startsAtLocal }
          : {}),
        ...(parsed.data.endsAtLocal !== undefined
          ? { endsAtLocal: parsed.data.endsAtLocal }
          : {}),
        ...(parsed.data.timezone !== undefined
          ? { timezone: parsed.data.timezone }
          : {}),
        ...(parsed.data.durationMinutes !== undefined
          ? { durationMinutes: parsed.data.durationMinutes }
          : {}),
        ...(parsed.data.rrule !== undefined
          ? { rrule: parsed.data.rrule }
          : {}),
        ...(recurrenceBoundary
          ? { recurrenceEnd: recurrenceBoundary.recurrenceEnd }
          : {}),
        ...(parsed.data.calendarId !== undefined
          ? { calendarId: parsed.data.calendarId }
          : {}),
        ...(parsed.data.location !== undefined
          ? { location: parsed.data.location }
          : {}),
        ...(parsed.data.description !== undefined
          ? { description: { text: parsed.data.description } }
          : {}),
      },
    );
    revalidatePath("/calendar");
    if (ownedEvent.task_id) revalidatePath("/tasks");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not update the event.");
  }
}

export type RecurrenceMutationScope = "this" | "following" | "all";

export type RecurringCalendarUndo = {
  masterEventId: string;
  guardEventId: string;
  newMasterEventId: string | null;
  eventRows: CalendarEventRow[];
};

const recurrenceMutationSchema = z
  .object({
    masterId: z.string().uuid(),
    recurrenceId: isoDateTimeSchema,
    operationKey: z.string().uuid(),
    scope: z.enum(["this", "following", "all"]),
    calendarId: z.string().uuid(),
    title: z.string().trim().min(1).max(500),
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema,
    startsAtLocal: localDateTimeSchema,
    endsAtLocal: localDateTimeSchema,
    timezone: timezoneSchema,
    durationMinutes: z.number().int().positive().max(525_600),
    rrule: rruleSchema.nullable(),
    location: z.string().trim().max(500).nullable(),
    description: z.string().trim().max(5000),
  })
  .refine(
    (input) =>
      new Date(input.endsAt).getTime() > new Date(input.startsAt).getTime(),
    { message: "The event must end after it starts." },
  );

const recurringDeleteSchema = z.object({
  masterId: z.string().uuid(),
  recurrenceId: isoDateTimeSchema,
  operationKey: z.string().uuid(),
  scope: z.enum(["this", "following", "all"]),
});

const recurringUndoSchema = z.object({
  masterEventId: z.string().uuid(),
  guardEventId: z.string().uuid(),
  newMasterEventId: z.string().uuid().nullable(),
  eventRows: z
    .array(
      z
        .object({
          id: z.string().uuid(),
          user_id: z.string().uuid(),
          calendar_id: z.string().uuid(),
          parent_event_id: z.string().uuid().nullable(),
          deleted_at: isoDateTimeSchema.nullable(),
        })
        .passthrough(),
    )
    .min(1)
    .max(10_000),
});

async function loadOwnedRecurringMaster(
  access: DataAccess,
  masterId: string,
): Promise<CalendarEventRow> {
  const { data, error } = await access.client
    .from("calendar_events")
    .select("*")
    .eq("id", masterId)
    .eq("user_id", access.ownerId)
    .is("parent_event_id", null)
    .not("rrule", "is", null)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Event not found.");
  return data as unknown as CalendarEventRow;
}

async function loadOwnedRecurringFamily(
  access: DataAccess,
  masterId: string,
): Promise<CalendarEventRow[]> {
  const { data, error } = await access.client
    .from("calendar_events")
    .select("*")
    .eq("user_id", access.ownerId)
    .or(`id.eq.${masterId},parent_event_id.eq.${masterId}`)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as unknown as CalendarEventRow[];
  if (!rows.some((row) => row.id === masterId)) {
    throw new Error("Recurring event not found.");
  }
  return rows;
}

function newMasterIdFromSplit(result: unknown): string {
  const parsed = z.object({ newMasterId: z.string().uuid() }).safeParse(result);
  if (!parsed.success) throw new Error("Invalid recurring split response.");
  return parsed.data.newMasterId;
}

function descriptionJson(description: string): Record<string, unknown> {
  return description ? { text: description } : {};
}

function localTimestampMs(value: string): number {
  return new Date(`${value}Z`).getTime();
}

function shiftLocalTimestamp(value: string, deltaMs: number): string | null {
  const timestamp = localTimestampMs(value);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp + deltaMs).toISOString().slice(0, 19);
}

function shiftedSeriesStart(input: {
  master: CalendarEventRow;
  recurrenceId: string;
  desiredStartsAtLocal: string;
  timezone: string;
  durationMinutes: number;
}): {
  startsAt: string;
  endsAt: string;
  startsAtLocal: string;
  endsAtLocal: string;
  localDeltaMs: number;
} | null {
  if (!input.master.timezone || !input.master.starts_at_local) return null;
  const originalOccurrenceLocal = instantToLocalDateTime(
    input.recurrenceId,
    input.master.timezone,
  );
  if (!originalOccurrenceLocal) return null;

  const localDeltaMs =
    localTimestampMs(input.desiredStartsAtLocal) -
    localTimestampMs(originalOccurrenceLocal);
  const startsAtLocal = shiftLocalTimestamp(
    input.master.starts_at_local,
    localDeltaMs,
  );
  if (!startsAtLocal) return null;
  const startsAt = localDateTimeToInstant(startsAtLocal, input.timezone);
  if (!startsAt) return null;
  const endsAt = new Date(
    new Date(startsAt).getTime() + input.durationMinutes * 60_000,
  ).toISOString();
  const endsAtLocal = instantToLocalDateTime(endsAt, input.timezone);
  if (!endsAtLocal) return null;

  return {
    startsAt,
    endsAt,
    startsAtLocal,
    endsAtLocal,
    localDeltaMs,
  };
}

/** Applies one recurrence scope without ever sending a synthetic id to SQL. */
export async function updateRecurringEventAction(input: {
  masterId: string;
  recurrenceId: string;
  operationKey: string;
  scope: RecurrenceMutationScope;
  calendarId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  startsAtLocal: string;
  endsAtLocal: string;
  timezone: string;
  durationMinutes: number;
  rrule: string | null;
  location: string | null;
  description: string;
}): Promise<CalendarActionResult<{ undo: RecurringCalendarUndo }>> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = recurrenceMutationSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error:
          parsed.error.issues[0]?.message ??
          "Check the recurring event and try again.",
      };
    }
    const master = await loadOwnedRecurringMaster(access, parsed.data.masterId);
    await requireOwnedCalendar(access, parsed.data.calendarId);
    const eventRows = await loadOwnedRecurringFamily(access, master.id);
    let guardEventId = master.id;
    let newMasterEventId: string | null = null;

    if (parsed.data.scope === "this") {
      const exception = await upsertCalendarEventException(
        access.client,
        access.ownerId,
        {
          operationKey: parsed.data.operationKey,
          masterEventId: master.id,
          calendarId: parsed.data.calendarId,
          recurrenceId: parsed.data.recurrenceId,
          isCancelled: false,
          title: parsed.data.title,
          startsAt: parsed.data.startsAt,
          endsAt: parsed.data.endsAt,
          startsAtLocal: parsed.data.startsAtLocal,
          endsAtLocal: parsed.data.endsAtLocal,
          timezone: parsed.data.timezone,
          durationMinutes: parsed.data.durationMinutes,
          allDay: master.all_day,
          location: parsed.data.location,
          description: descriptionJson(parsed.data.description),
          color: master.color,
          conferenceUrl: master.conference_url,
        },
      );
      guardEventId = exception.id;
    } else {
      if (!parsed.data.rrule) {
        return {
          ok: false,
          error: "Choose a repeat pattern for a series-wide edit.",
        };
      }
      const shifted = shiftedSeriesStart({
        master,
        recurrenceId: parsed.data.recurrenceId,
        desiredStartsAtLocal: parsed.data.startsAtLocal,
        timezone: parsed.data.timezone,
        durationMinutes: parsed.data.durationMinutes,
      });
      if (!shifted) {
        return {
          ok: false,
          error: "Could not preserve the series wall-clock time.",
        };
      }

      if (parsed.data.scope === "all") {
        const changesOccurrenceIdentity =
          shifted.localDeltaMs !== 0 ||
          parsed.data.timezone !== master.timezone ||
          parsed.data.rrule !== master.rrule;
        const changesExceptionCalendar =
          parsed.data.calendarId !== master.calendar_id;
        if (changesOccurrenceIdentity || changesExceptionCalendar) {
          const { data: existingException, error } = await access.client
            .from("calendar_events")
            .select("id")
            .eq("user_id", access.ownerId)
            .eq("parent_event_id", master.id)
            .is("deleted_at", null)
            .limit(1)
            .maybeSingle();
          if (error) throw error;
          if (existingException) {
            return {
              ok: false,
              error:
                "This series has edited occurrences. Use This and following to change its schedule or calendar safely.",
            };
          }
        }
        const remappedSeries = remapRecurrenceIdentitiesForSplit({
          master,
          splitRecurrenceId: master.starts_at,
          newStartsAtLocal: shifted.startsAtLocal,
          newTimezone: parsed.data.timezone,
          newRrule: parsed.data.rrule,
          exceptionRecurrenceIds: [],
        });
        if (!remappedSeries) {
          return {
            ok: false,
            error: "This repeat pattern cannot preserve the series boundaries.",
          };
        }
        await updateCalendarEvent(access.client, access.ownerId, master.id, {
          calendarId: parsed.data.calendarId,
          title: parsed.data.title,
          startsAt: shifted.startsAt,
          endsAt: shifted.endsAt,
          startsAtLocal: shifted.startsAtLocal,
          endsAtLocal: shifted.endsAtLocal,
          timezone: parsed.data.timezone,
          durationMinutes: parsed.data.durationMinutes,
          rrule: parsed.data.rrule,
          recurrenceEnd: remappedSeries.recurrenceEnd,
          location: parsed.data.location,
          description: descriptionJson(parsed.data.description),
        });
      } else {
        const { data: futureExceptions, error } = await access.client
          .from("calendar_events")
          .select("recurrence_id")
          .eq("user_id", access.ownerId)
          .eq("parent_event_id", master.id)
          .is("deleted_at", null)
          .gte("recurrence_id", parsed.data.recurrenceId);
        if (error) throw error;

        const remappedSeries = remapRecurrenceIdentitiesForSplit({
          master,
          splitRecurrenceId: parsed.data.recurrenceId,
          newStartsAtLocal: parsed.data.startsAtLocal,
          newTimezone: parsed.data.timezone,
          newRrule: parsed.data.rrule,
          exceptionRecurrenceIds: (futureExceptions ?? []).map(
            ({ recurrence_id }) => recurrence_id as string,
          ),
        });
        if (!remappedSeries) {
          return {
            ok: false,
            error:
              "Could not preserve edited occurrences with this repeat pattern.",
          };
        }

        const splitResult = await splitCalendarEventSeries(
          access.client,
          access.ownerId,
          {
            operationKey: parsed.data.operationKey,
            masterEventId: master.id,
            splitRecurrenceId: parsed.data.recurrenceId,
            calendarId: parsed.data.calendarId,
            title: parsed.data.title,
            startsAt: parsed.data.startsAt,
            endsAt: parsed.data.endsAt,
            startsAtLocal: parsed.data.startsAtLocal,
            endsAtLocal: parsed.data.endsAtLocal,
            timezone: parsed.data.timezone,
            durationMinutes: parsed.data.durationMinutes,
            rrule: parsed.data.rrule,
            recurrenceEnd: remappedSeries.recurrenceEnd,
            allDay: master.all_day,
            location: parsed.data.location,
            description: descriptionJson(parsed.data.description),
            color: master.color,
            conferenceUrl: master.conference_url,
            exceptionRecurrenceIdMap: remappedSeries.exceptionRecurrenceIdMap,
          },
        );
        newMasterEventId = newMasterIdFromSplit(splitResult);
        guardEventId = newMasterEventId;
      }
    }

    revalidatePath("/calendar");
    return {
      ok: true,
      data: {
        undo: {
          masterEventId: master.id,
          guardEventId,
          newMasterEventId,
          eventRows,
        },
      },
    };
  } catch (cause) {
    return actionError(cause, "Could not update the recurring event.");
  }
}

export async function deleteRecurringEventAction(input: {
  masterId: string;
  recurrenceId: string;
  operationKey: string;
  scope: RecurrenceMutationScope;
}): Promise<CalendarActionResult<{ undo: RecurringCalendarUndo }>> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = recurringDeleteSchema.safeParse(input);
    if (!parsed.success)
      return { ok: false, error: "Invalid recurring event." };
    const master = await loadOwnedRecurringMaster(access, parsed.data.masterId);
    const eventRows = await loadOwnedRecurringFamily(access, master.id);
    let guardEventId = master.id;

    if (parsed.data.scope === "all") {
      await softDeleteCalendarEvent(access.client, access.ownerId, master.id);
    } else if (parsed.data.scope === "following") {
      const truncated = await truncateCalendarEventSeries(
        access.client,
        access.ownerId,
        {
          masterEventId: master.id,
          recurrenceId: parsed.data.recurrenceId,
        },
      );
      guardEventId = truncated.id;
    } else {
      if (
        !master.timezone ||
        !master.duration_minutes ||
        !master.starts_at_local
      ) {
        return { ok: false, error: "This series has incomplete time data." };
      }
      const startsAtLocal = instantToLocalDateTime(
        parsed.data.recurrenceId,
        master.timezone,
      );
      if (!startsAtLocal) {
        return { ok: false, error: "Invalid occurrence time." };
      }
      const endsAt = new Date(
        new Date(parsed.data.recurrenceId).getTime() +
          master.duration_minutes * 60_000,
      ).toISOString();
      const endsAtLocal = instantToLocalDateTime(endsAt, master.timezone);
      if (!endsAtLocal) {
        return { ok: false, error: "Invalid occurrence time." };
      }
      const exception = await upsertCalendarEventException(
        access.client,
        access.ownerId,
        {
          operationKey: parsed.data.operationKey,
          masterEventId: master.id,
          calendarId: master.calendar_id,
          recurrenceId: parsed.data.recurrenceId,
          isCancelled: true,
          title: master.title,
          startsAt: parsed.data.recurrenceId,
          endsAt,
          startsAtLocal,
          endsAtLocal,
          timezone: master.timezone,
          durationMinutes: master.duration_minutes,
          allDay: master.all_day,
          location: master.location,
          description: master.description_json,
          color: master.color,
          conferenceUrl: master.conference_url,
        },
      );
      guardEventId = exception.id;
    }

    revalidatePath("/calendar");
    return {
      ok: true,
      data: {
        undo: {
          masterEventId: master.id,
          guardEventId,
          newMasterEventId: null,
          eventRows,
        },
      },
    };
  } catch (cause) {
    return actionError(cause, "Could not delete the recurring event.");
  }
}

/** Restore a recurring family snapshot within the database-enforced window. */
export async function restoreRecurringCalendarMutationAction(
  input: RecurringCalendarUndo,
): Promise<CalendarActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = recurringUndoSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "This recurring undo is invalid." };
    }

    await restoreCalendarSeriesUndo(access.client, access.ownerId, {
      masterEventId: parsed.data.masterEventId,
      guardEventId: parsed.data.guardEventId,
      newMasterEventId: parsed.data.newMasterEventId,
      eventRows: parsed.data.eventRows as unknown as CalendarEventRow[],
    });
    revalidatePath("/calendar");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not undo the recurring calendar change.");
  }
}

/** Soft-delete an event so the shared calendar chrome can offer Undo. */
export async function deleteCalendarEventAction(input: {
  eventId: string;
}): Promise<CalendarActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = eventIdSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid event." };
    const event = await requireOwnedEvent(access, parsed.data.eventId);
    if (event.task_id) {
      await unscheduleTaskLinkedEvent(
        access.client,
        access.ownerId,
        parsed.data.eventId,
      );
      revalidatePath("/calendar");
      revalidatePath("/tasks");
      return { ok: true, data: undefined };
    }
    await deleteCalendarEvent(
      access.client,
      access.ownerId,
      parsed.data.eventId,
    );
    revalidatePath("/calendar");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not delete the event.");
  }
}

/** Complete the task represented by an owned calendar block. */
export async function completeTaskLinkedEventAction(input: {
  eventId: string;
}): Promise<CalendarActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = eventIdSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid event." };
    const event = await requireOwnedEvent(access, parsed.data.eventId);
    if (!event.task_id) {
      return { ok: false, error: "This event is not linked to a task." };
    }
    await completeTaskLinkedEvent(
      access.client,
      access.ownerId,
      parsed.data.eventId,
    );
    revalidatePath("/calendar");
    revalidatePath("/tasks");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not complete the task.");
  }
}

/** Remove an owned task block from the calendar while preserving the task. */
export async function unscheduleTaskLinkedEventAction(input: {
  eventId: string;
}): Promise<CalendarActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = eventIdSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid event." };
    const event = await requireOwnedEvent(access, parsed.data.eventId);
    if (!event.task_id) {
      return { ok: false, error: "This event is not linked to a task." };
    }
    await unscheduleTaskLinkedEvent(
      access.client,
      access.ownerId,
      parsed.data.eventId,
    );
    revalidatePath("/calendar");
    revalidatePath("/tasks");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not unschedule the task.");
  }
}

/** Restore a soft-deleted event and any linked task schedule during Undo. */
export async function restoreCalendarEventAction(input: {
  eventId: string;
}): Promise<CalendarActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = eventIdSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid event." };

    const event = await restoreCalendarEventUndo(
      access.client,
      access.ownerId,
      parsed.data.eventId,
    );
    revalidatePath("/calendar");
    if (event.task_id) revalidatePath("/tasks");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not restore the event.");
  }
}

/** Move or resize an event on the grid (react-big-calendar drop/resize). */
export async function updateEventTimesAction(input: {
  eventId: string;
  startsAt: string;
  endsAt: string;
}): Promise<CalendarActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = updateEventTimesSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Choose a valid time." };
    const event = await requireOwnedEvent(access, parsed.data.eventId);
    if (event.task_id) {
      await moveTaskLinkedEvent(access.client, access.ownerId, parsed.data);
    } else {
      const startsAtLocal = event.timezone
        ? instantToLocalDateTime(parsed.data.startsAt, event.timezone)
        : null;
      const endsAtLocal = event.timezone
        ? instantToLocalDateTime(parsed.data.endsAt, event.timezone)
        : null;
      if (event.timezone && (!startsAtLocal || !endsAtLocal)) {
        return { ok: false, error: "Choose a valid time." };
      }
      await updateCalendarEvent(
        access.client,
        access.ownerId,
        parsed.data.eventId,
        {
          startsAt: parsed.data.startsAt,
          endsAt: parsed.data.endsAt,
          startsAtLocal,
          endsAtLocal,
          durationMinutes: Math.max(
            1,
            Math.round(
              (new Date(parsed.data.endsAt).getTime() -
                new Date(parsed.data.startsAt).getTime()) /
                60_000,
            ),
          ),
        },
      );
    }
    revalidatePath("/calendar");
    if (event.task_id) revalidatePath("/tasks");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not update the event.");
  }
}

/** Restore the exact authored time fields captured before a move or resize. */
export async function restoreCalendarEventTimesAction(input: {
  eventId: string;
  startsAt: string;
  endsAt: string;
  startsAtLocal: string | null;
  endsAtLocal: string | null;
  durationMinutes: number | null;
}): Promise<CalendarActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = restoreEventTimesSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Choose a valid time." };

    const event = await requireOwnedEvent(access, parsed.data.eventId);
    if (event.task_id) {
      await moveTaskLinkedEvent(access.client, access.ownerId, parsed.data);
    } else {
      await updateCalendarEvent(
        access.client,
        access.ownerId,
        parsed.data.eventId,
        {
          startsAt: parsed.data.startsAt,
          endsAt: parsed.data.endsAt,
          startsAtLocal: parsed.data.startsAtLocal,
          endsAtLocal: parsed.data.endsAtLocal,
          durationMinutes: parsed.data.durationMinutes,
        },
      );
    }

    revalidatePath("/calendar");
    if (event.task_id) revalidatePath("/tasks");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not undo the calendar change.");
  }
}

const updateTaskDueDateSchema = z.object({
  taskId: z.string().uuid(),
  dueAt: isoDateTimeSchema,
});

/** Move a task's due date by dragging its chip to another day in Month. */
export async function updateTaskDueDateAction(input: {
  taskId: string;
  dueAt: string;
}): Promise<CalendarActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = updateTaskDueDateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Choose a valid date." };
    await updateTask(access.client, access.ownerId, parsed.data.taskId, {
      due_at: parsed.data.dueAt,
    });
    revalidatePath("/calendar");
    revalidatePath("/tasks");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not update the task.");
  }
}

/** Files, tasks, and workspaces an event can link to. */
export async function loadEventCrossLinkOptionsAction(input: {
  eventId: string;
}): Promise<CalendarActionResult<EventCrossLinkOptions>> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = eventIdSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid event." };
    await requireOwnedEvent(access, parsed.data.eventId);

    const [files, attachedFiles, tasks, workspaces, linkedWorkspaces, current] =
      await Promise.all([
        access.client
          .from("file_sources")
          .select("id,name,mime_type,size_bytes,metadata_json")
          .eq("user_id", access.ownerId)
          .order("created_at", { ascending: false })
          .limit(100),
        access.client
          .from("file_links")
          .select("file_source_id")
          .eq("target_type", "calendar_event")
          .eq("target_id", parsed.data.eventId),
        access.client
          .from("tasks")
          .select("id,title,status")
          .eq("user_id", access.ownerId)
          .order("position", { ascending: true })
          .limit(100),
        access.client
          .from("workspaces")
          .select("id,name")
          .eq("owner_id", access.ownerId)
          .order("created_at", { ascending: true })
          .limit(100),
        access.client
          .from("workspace_links")
          .select("workspace_id")
          .eq("resource_type", "calendar_event")
          .eq("resource_id", parsed.data.eventId),
        getCurrentWorkspace(),
      ]);
    if (files.error) throw files.error;
    if (attachedFiles.error) throw attachedFiles.error;
    if (tasks.error) throw tasks.error;
    if (workspaces.error) throw workspaces.error;
    if (linkedWorkspaces.error) throw linkedWorkspaces.error;

    const shared = taskCrossLinkOptions({
      files: files.data ?? [],
      attachedFileIds: (attachedFiles.data ?? []).map(
        (link) => link.file_source_id,
      ),
      workspaces: workspaces.data ?? [],
      currentWorkspaceId:
        current?.access.ownerId === access.ownerId
          ? current.workspace.id
          : null,
      linkedWorkspaceIds: (linkedWorkspaces.data ?? []).map(
        (link) => link.workspace_id,
      ),
    });
    const openTasks = (tasks.data ?? [])
      .filter((task) => task.status !== "done" && task.status !== "cancelled")
      .map((task) => ({ id: task.id, title: task.title }));

    return { ok: true, data: { ...shared, tasks: openTasks } };
  } catch (cause) {
    return actionError(cause, "Could not load cross-feature options.");
  }
}

const attachFileToEventSchema = z.object({
  eventId: z.string().uuid(),
  fileSourceId: z.string().uuid(),
});

export async function attachFileToEventAction(input: {
  eventId: string;
  fileSourceId: string;
}): Promise<CalendarActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = attachFileToEventSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Choose a valid file." };
    await requireOwnedEvent(access, parsed.data.eventId);
    await attachFileToEvent(access.client, {
      eventId: parsed.data.eventId,
      fileSourceId: parsed.data.fileSourceId,
    });
    revalidatePath("/calendar");
    revalidatePath("/files");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not attach the file.");
  }
}

const linkTaskToEventSchema = z.object({
  eventId: z.string().uuid(),
  taskId: z.string().uuid(),
});

export async function linkTaskToEventAction(input: {
  eventId: string;
  taskId: string;
}): Promise<CalendarActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = linkTaskToEventSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Choose a valid task." };
    await requireOwnedEvent(access, parsed.data.eventId);
    await linkTaskToEvent(access.client, access.ownerId, {
      eventId: parsed.data.eventId,
      taskId: parsed.data.taskId,
    });
    revalidatePath("/calendar");
    revalidatePath("/tasks");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not link the task.");
  }
}

const linkEventToWorkspaceSchema = z.object({
  eventId: z.string().uuid(),
  workspaceId: z.string().uuid(),
});

export async function linkEventToWorkspaceAction(input: {
  eventId: string;
  workspaceId: string;
}): Promise<CalendarActionResult<{ workspaceName: string }>> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = linkEventToWorkspaceSchema.safeParse(input);
    if (!parsed.success)
      return { ok: false, error: "Choose a valid workspace." };
    await requireOwnedEvent(access, parsed.data.eventId);
    const { data: workspace, error } = await access.client
      .from("workspaces")
      .select("id,name")
      .eq("id", parsed.data.workspaceId)
      .eq("owner_id", access.ownerId)
      .maybeSingle();
    if (error) throw error;
    if (!workspace) return { ok: false, error: "Workspace not found." };
    await linkResourceToWorkspace(access.client, access.ownerId, {
      workspaceId: workspace.id,
      resourceType: "calendar_event",
      resourceId: parsed.data.eventId,
    });
    revalidatePath("/calendar");
    return { ok: true, data: { workspaceName: workspace.name } };
  } catch (cause) {
    return actionError(cause, "Could not add the event to the workspace.");
  }
}

/**
 * Legacy kernel face action — the product route no longer uses it, but the
 * /design kernel preview (features/calendar/calendar-view.tsx) still does.
 * Deleted with the kernel faces in Phase 8.
 */
export async function createWorkspaceCalendar(): Promise<void> {
  // Resolved server-side — a client-supplied workspace id is never trusted.
  const current = await getCurrentWorkspace();
  let workspaceId = current?.workspace.id;

  if (!workspaceId) {
    const workspace = await createWorkspace({ name: "My workspace" });
    if (!workspace.success) throw new Error(workspace.error);
    workspaceId = workspace.data.workspaceId;
  }

  const calendar = await createCalendarDatabaseWithViews({
    workspaceId,
    name: "Calendar",
  });
  if (!calendar.success) throw new Error(calendar.error);

  revalidatePath("/calendar");
  revalidatePath("/", "layout");
}
