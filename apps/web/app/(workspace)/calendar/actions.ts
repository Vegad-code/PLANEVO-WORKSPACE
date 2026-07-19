"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createCalendar,
  createCalendarEvent,
  scheduleTaskFromDrag,
  updateCalendarVisibility,
} from "@planevo/core/mutations/product-calendar";
import { CALENDAR_COLORS } from "@planevo/core/types/calendar";
import type { DataAccess } from "@/lib/data/access";
import { requireMutationDataAccess } from "@/lib/data/access";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { createCalendarDatabaseWithViews, createWorkspace } from "../actions";

export type CalendarActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; correlationId?: string };

function actionError(
  cause: unknown,
  fallback: string,
): CalendarActionResult<never> {
  const correlationId = randomUUID();
  console.error(`[calendar:${correlationId}]`, cause);
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

const createCalendarEventSchema = z
  .object({
    calendarId: z.string().uuid(),
    title: z.string().trim().min(1).max(500),
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema,
    location: z.string().trim().max(500).nullable().optional(),
  })
  .refine(
    (input) => new Date(input.endsAt).getTime() > new Date(input.startsAt).getTime(),
    { message: "The event must end after it starts." },
  );

export async function createCalendarEventAction(input: {
  calendarId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location?: string | null;
}): Promise<CalendarActionResult<{ eventId: string }>> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = createCalendarEventSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error:
          parsed.error.issues[0]?.message ?? "Check the event details and try again.",
      };
    }
    await requireOwnedCalendar(access, parsed.data.calendarId);
    const event = await createCalendarEvent(access.client, access.ownerId, {
      calendarId: parsed.data.calendarId,
      title: parsed.data.title,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      location: parsed.data.location ?? null,
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
    const calendar = await createCalendar(access.client, access.ownerId, parsed.data);
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
      .select("id,title")
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
    });
    revalidatePath("/calendar");
    revalidatePath("/tasks");
    return { ok: true, data: { eventId: event.id } };
  } catch (cause) {
    return actionError(cause, "Could not schedule the task.");
  }
}

/**
 * Legacy kernel face action — still referenced by the pre-cutover /calendar
 * page. Removed with the DatabaseFace strangler in the Task 11 cutover.
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
