"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { attachFileToEvent } from "@planevo/core/mutations/file-cross-links";
import {
  createCalendar,
  createCalendarEvent,
  scheduleTaskFromDrag,
  updateCalendarEvent,
  updateCalendarVisibility,
} from "@planevo/core/mutations/product-calendar";
import { createTask, updateTaskStatus } from "@planevo/core/mutations/product-tasks";
import { linkResourceToWorkspace } from "@planevo/core/mutations/workspace-links";
import { CALENDAR_COLORS } from "@planevo/core/types/calendar";
import type { DataAccess } from "@/lib/data/access";
import { requireMutationDataAccess } from "@/lib/data/access";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import {
  taskCrossLinkOptions,
  type TaskCrossLinkOptions,
} from "@/lib/tasks/task-cross-link-contracts";
import { createCalendarDatabaseWithViews, createWorkspace } from "../actions";

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
    const { data: task, error } = await access.client
      .from("tasks")
      .select("id")
      .eq("id", parsed.data.taskId)
      .eq("user_id", access.ownerId)
      .maybeSingle();
    if (error) throw error;
    if (!task) return { ok: false, error: "Task not found." };

    await updateTaskStatus(
      access.client,
      access.ownerId,
      task.id,
      parsed.data.status,
    );
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
): Promise<void> {
  const { data, error } = await access.client
    .from("calendar_events")
    .select("id")
    .eq("id", eventId)
    .eq("user_id", access.ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Event not found.");
}

const updateEventTimesSchema = z
  .object({
    eventId: z.string().uuid(),
    startsAt: isoDateTimeSchema,
    endsAt: isoDateTimeSchema,
  })
  .refine(
    (input) => new Date(input.endsAt).getTime() > new Date(input.startsAt).getTime(),
    { message: "The event must end after it starts." },
  );

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
    await requireOwnedEvent(access, parsed.data.eventId);
    await updateCalendarEvent(access.client, access.ownerId, parsed.data.eventId, {
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
    });
    revalidatePath("/calendar");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not update the event.");
  }
}

const eventIdSchema = z.object({ eventId: z.string().uuid() });

/** Files, tasks, and workspaces an event peek can link to. */
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
        current?.access.ownerId === access.ownerId ? current.workspace.id : null,
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
    const { data: task, error } = await access.client
      .from("tasks")
      .select("id")
      .eq("id", parsed.data.taskId)
      .eq("user_id", access.ownerId)
      .maybeSingle();
    if (error) throw error;
    if (!task) return { ok: false, error: "Task not found." };
    await updateCalendarEvent(access.client, access.ownerId, parsed.data.eventId, {
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
    if (!parsed.success) return { ok: false, error: "Choose a valid workspace." };
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
