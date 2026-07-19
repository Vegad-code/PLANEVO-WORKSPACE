"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createSubtask,
  createTask,
  deleteSubtask,
  deleteTask,
  moveTaskOrdered,
  toggleSubtask,
  updateTaskAndStatus,
} from "@planevo/core/mutations/product-tasks";
import {
  attachFileToTask,
  claimTaskAttachment,
  linkTaskToWorkspace,
  scheduleTask,
} from "@planevo/core/mutations/task-cross-links";
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type TaskRow,
} from "@planevo/core/types/tasks";
import type { DataAccess } from "@/lib/data/access";
import { requireMutationDataAccess } from "@/lib/data/access";
import { getCurrentWorkspace } from "@/lib/data/current-workspace";
import { cleanupOwnedTaskAttachment } from "@/lib/tasks/task-attachment-cleanup.server";
import {
  requireTaskAttachmentCleanupCandidate,
  requireTaskAttachmentSize,
} from "@/lib/tasks/task-attachment-integrity";
import {
  MAX_TASK_ATTACHMENT_BYTES,
  MAX_TASK_ATTACHMENTS,
  TASK_ATTACHMENT_BUCKET,
  isVisibleFileSourceMetadata,
  taskAttachmentObjectName,
  type UploadedTaskAttachment,
} from "@/lib/tasks/task-attachments";
import {
  attachFileToTaskActionInputSchema,
  linkTaskToWorkspaceActionInputSchema,
  scheduleTaskActionInputSchema,
  taskCrossLinkOptions,
  taskCrossLinkOptionsInputSchema,
  type TaskCrossLinkOptions,
} from "@/lib/tasks/task-cross-link-contracts";

export type TaskActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; correlationId?: string };

const taskIdSchema = z.string().uuid();
const boardStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "in_review",
  "done",
]);
const dueAtSchema = z.string().datetime({ offset: true }).nullable();

const uploadedAttachmentSchema = z.object({
  sourceId: z.string().uuid(),
  storagePath: z.string().min(1).max(1_024),
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().max(255),
  sizeBytes: z
    .number()
    .finite()
    .int()
    .positive()
    .max(MAX_TASK_ATTACHMENT_BYTES),
  claimOperationKey: z.string().uuid(),
});

const createProductTaskSchema = z.object({
  operationKey: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(20_000),
  status: boardStatusSchema,
  priority: z.enum(TASK_PRIORITIES).nullable(),
  dueAt: dueAtSchema,
  estimateMinutes: z.number().int().min(1).max(10_080).nullable(),
  tags: z.array(z.string().trim().min(1).max(32)).max(8),
  attachments: z
    .array(uploadedAttachmentSchema)
    .max(MAX_TASK_ATTACHMENTS)
    .superRefine((attachments, context) => {
      const paths = new Set<string>();
      const sourceIds = new Set<string>();
      for (const [index, attachment] of attachments.entries()) {
        if (
          paths.has(attachment.storagePath) ||
          sourceIds.has(attachment.sourceId)
        ) {
          context.addIssue({
            code: "custom",
            path: [index],
            message: "Attachment reservations must be unique.",
          });
        }
        paths.add(attachment.storagePath);
        sourceIds.add(attachment.sourceId);
      }
    }),
});

const updateProductTaskSchema = z.object({
  taskId: taskIdSchema,
  title: z.string().trim().min(1).max(500),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES).nullable(),
  dueAt: dueAtSchema,
  description: z.string().max(20_000),
});

const moveProductTaskSchema = z
  .object({
    taskId: taskIdSchema,
    status: boardStatusSchema,
    beforeTaskId: taskIdSchema.nullable(),
    afterTaskId: taskIdSchema.nullable(),
  })
  .superRefine((input, context) => {
    if (input.beforeTaskId === input.taskId || input.afterTaskId === input.taskId) {
      context.addIssue({
        code: "custom",
        message: "A task cannot be its own board neighbor.",
      });
    }
    if (input.beforeTaskId && input.beforeTaskId === input.afterTaskId) {
      context.addIssue({
        code: "custom",
        message: "Board neighbors must be distinct.",
      });
    }
  });

const taskMutationSchema = z.object({ taskId: taskIdSchema });
const createSubtaskSchema = z.object({
  taskId: taskIdSchema,
  title: z.string().trim().min(1).max(500),
});
const toggleSubtaskSchema = z.object({
  subtaskId: z.string().uuid(),
  isDone: z.boolean(),
});
const deleteSubtaskSchema = z.object({ subtaskId: z.string().uuid() });

type OwnedTask = Pick<
  TaskRow,
  "id" | "title" | "status" | "position" | "description_json"
>;

function actionError(cause: unknown, fallback: string): TaskActionResult<never> {
  const correlationId = randomUUID();
  console.error(`[tasks:${correlationId}]`, cause);
  return {
    ok: false,
    code: "TASK_ACTION_FAILED",
    error: fallback,
    correlationId,
  };
}

async function requireOwnedTask(
  access: DataAccess,
  taskId: string,
): Promise<OwnedTask> {
  const { data, error } = await access.client
    .from("tasks")
    .select("id,title,status,position,description_json")
    .eq("id", taskId)
    .eq("user_id", access.ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Task not found.");

  const status = z.enum(TASK_STATUSES).safeParse(data.status);
  if (!status.success) throw new Error("Task has an invalid status.");
  const descriptionJson =
    data.description_json &&
    typeof data.description_json === "object" &&
    !Array.isArray(data.description_json)
      ? (data.description_json as Record<string, unknown>)
      : {};
  return { ...data, status: status.data, description_json: descriptionJson };
}

async function requireOwnedVisibleFileSource(
  access: DataAccess,
  fileSourceId: string,
): Promise<{ id: string; name: string }> {
  const { data, error } = await access.client
    .from("file_sources")
    .select("id,name,metadata_json")
    .eq("id", fileSourceId)
    .eq("user_id", access.ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!data || !isVisibleFileSourceMetadata(data.metadata_json)) {
    throw new Error("File not found.");
  }
  return { id: data.id, name: data.name };
}

async function requireOwnedWorkspace(
  access: DataAccess,
  workspaceId: string,
): Promise<{ id: string; name: string }> {
  const { data, error } = await access.client
    .from("workspaces")
    .select("id,name")
    .eq("id", workspaceId)
    .eq("owner_id", access.ownerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Workspace not found.");
  return data;
}

async function loadOwnedTaskCrossLinkOptions(
  access: DataAccess,
  taskId: string,
): Promise<TaskCrossLinkOptions> {
  const [files, attachedFiles, workspaces, linkedWorkspaces, current] =
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
        .eq("target_type", "task")
        .eq("target_id", taskId),
      access.client
        .from("workspaces")
        .select("id,name")
        .eq("owner_id", access.ownerId)
        .order("created_at", { ascending: true })
        .limit(100),
      access.client
        .from("workspace_links")
        .select("workspace_id")
        .eq("resource_type", "task")
        .eq("resource_id", taskId),
      getCurrentWorkspace(),
    ]);

  if (files.error) throw files.error;
  if (attachedFiles.error) throw attachedFiles.error;
  if (workspaces.error) throw workspaces.error;
  if (linkedWorkspaces.error) throw linkedWorkspaces.error;

  return taskCrossLinkOptions({
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
}

async function countTaskFiles(
  access: DataAccess,
  taskId: string,
): Promise<number> {
  const { count, error } = await access.client
    .from("file_links")
    .select("id", { count: "exact", head: true })
    .eq("target_type", "task")
    .eq("target_id", taskId);
  if (error) throw error;
  return count ?? 0;
}

async function requireOwnedSubtask(
  access: DataAccess,
  subtaskId: string,
): Promise<void> {
  const { data, error } = await access.client
    .from("task_subtasks")
    .select("id,task_id")
    .eq("id", subtaskId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Subtask not found.");

  await requireOwnedTask(access, data.task_id);
}

function uploadedAttachmentValues(formData: FormData): unknown[] {
  return formData.getAll("attachments").map((entry) => {
    if (typeof entry !== "string") return null;
    try {
      return JSON.parse(entry) as unknown;
    } catch {
      return null;
    }
  });
}

/**
 * Prove that every client-reported signed upload is present in the current
 * workspace folder, matches its immutable reservation, and has not been
 * claimed by a task.
 * This happens before task insertion so a failed prerequisite never creates a
 * task that the client is told failed.
 */
async function requireUploadedAttachments(
  access: DataAccess,
  workspaceId: string,
  attachments: UploadedTaskAttachment[],
): Promise<void> {
  if (attachments.length === 0) return;

  const sourceIds = attachments.map((attachment) => attachment.sourceId);
  const objectNames = attachments.map((attachment) => {
    const objectName = taskAttachmentObjectName(
      attachment.storagePath,
      workspaceId,
    );
    if (!objectName) throw new Error("Invalid attachment path.");
    return objectName;
  });

  const { data: sources, error: sourcesError } = await access.client
    .from("file_sources")
    .select(
      "id,workspace_id,storage_path,name,mime_type,size_bytes,metadata_json",
    )
    .eq("user_id", access.ownerId)
    .in("id", sourceIds);
  if (sourcesError) throw sourcesError;
  if ((sources ?? []).length !== attachments.length) {
    throw new Error("An attachment reservation is missing.");
  }

  const { data: links, error: linksError } = await access.client
    .from("file_links")
    .select("file_source_id")
    .in("file_source_id", sourceIds);
  if (linksError) throw linksError;
  if ((links ?? []).length > 0) {
    throw new Error("An attachment has already been claimed.");
  }

  const sourcesById = new Map((sources ?? []).map((source) => [source.id, source]));
  await Promise.all(
    attachments.map(async (attachment, index) => {
      const source = sourcesById.get(attachment.sourceId);
      if (
        !source ||
        source.workspace_id !== workspaceId ||
        source.storage_path !== attachment.storagePath ||
        source.name !== attachment.name ||
        (source.mime_type ?? "") !== attachment.mimeType
      ) {
        throw new Error(`Attachment ${attachment.name} has an invalid reservation.`);
      }
      requireTaskAttachmentCleanupCandidate(source.metadata_json);
      requireTaskAttachmentSize(source.size_bytes, attachment.sizeBytes);

      const objectName = objectNames[index]!;
      const { data, error } = await access.client.storage
        .from(TASK_ATTACHMENT_BUCKET)
        .list(workspaceId, { limit: 10, search: objectName });
      if (error) throw error;

      const object = (data ?? []).find((entry) => entry.name === objectName);
      if (!object) throw new Error(`Attachment ${attachment.name} was not uploaded.`);
      requireTaskAttachmentSize(
        object.metadata?.size,
        attachment.sizeBytes,
      );
    }),
  );
}

/** Atomically claim one completed upload for its newly-created task. */
async function registerUploadedAttachment(
  access: DataAccess,
  taskId: string,
  attachment: UploadedTaskAttachment,
): Promise<void> {
  try {
    await claimTaskAttachment(access.client, access.ownerId, {
      taskId,
      fileSourceId: attachment.sourceId,
      operationKey: attachment.claimOperationKey,
    });
  } catch (cause) {
    const { data: links, error: confirmationError } = await access.client
      .from("file_links")
      .select("target_id")
      .eq("file_source_id", attachment.sourceId)
      .eq("target_type", "task")
      .limit(1);
    if (confirmationError) {
      throw new Error(
        "Attachment claim could not be confirmed; cleanup was not attempted.",
      );
    }

    const linkedTaskId = links?.[0]?.target_id;
    if (linkedTaskId === taskId) return;
    if (linkedTaskId) {
      throw new Error("Attachment is already linked to another task.");
    }

    const cleanup = await cleanupOwnedTaskAttachment(access, {
      sourceId: attachment.sourceId,
      storagePath: attachment.storagePath,
    });
    if (!cleanup.ok) {
      throw new Error(
        `Attachment could not be linked; cleanup remains pending at the ${cleanup.stage} step.`,
      );
    }
    throw cause;
  }
}

export type CreateTaskData = {
  task: TaskRow;
  attachmentError: string | null;
};

export async function createProductTaskAction(
  formData: FormData,
): Promise<TaskActionResult<CreateTaskData>> {
  try {
    const access = await requireMutationDataAccess();
    const priorityValue = formData.get("priority");
    const dueAtValue = formData.get("dueAt");
    const estimateValue = formData.get("estimateMinutes");
    const parsed = createProductTaskSchema.safeParse({
      operationKey: formData.get("operationKey"),
      title: formData.get("title"),
      description: formData.get("description") ?? "",
      status: formData.get("status") || "not_started",
      priority: priorityValue ? priorityValue : null,
      dueAt: dueAtValue ? dueAtValue : null,
      estimateMinutes: estimateValue ? Number(estimateValue) : null,
      tags: formData.getAll("tags"),
      attachments: uploadedAttachmentValues(formData),
    });
    if (!parsed.success || formData.getAll("files").length > 0) {
      return { ok: false, error: "Check the task details and try again." };
    }

    let workspaceId: string | null = null;
    if (parsed.data.attachments.length > 0) {
      const current = await getCurrentWorkspace();
      if (!current || current.access.ownerId !== access.ownerId) {
        return {
          ok: false,
          error: "Open a workspace before attaching files to a task.",
        };
      }
      workspaceId = current.workspace.id;
      await requireUploadedAttachments(
        access,
        workspaceId,
        parsed.data.attachments,
      );
    }

    const descriptionJson: Record<string, unknown> = {};
    if (parsed.data.description) descriptionJson.text = parsed.data.description;
    if (parsed.data.tags.length > 0) descriptionJson.tags = parsed.data.tags;
    if (parsed.data.estimateMinutes !== null) {
      descriptionJson.estimateMinutes = parsed.data.estimateMinutes;
    }

    const task = await createTask(access.client, access.ownerId, {
      operationKey: parsed.data.operationKey,
      title: parsed.data.title,
      status: parsed.data.status,
      priority: parsed.data.priority,
      due_at: parsed.data.dueAt,
      description_json: descriptionJson,
    });

    let attachmentError: string | null = null;
    if (workspaceId) {
      let failed = 0;
      let cleanupPending = 0;
      for (const attachment of parsed.data.attachments) {
        try {
          await registerUploadedAttachment(
            access,
            task.id,
            attachment,
          );
        } catch (cause) {
          failed += 1;
          if (
            cause instanceof Error &&
            cause.message.includes("cleanup remains pending")
          ) {
            cleanupPending += 1;
          }
        }
      }
      if (failed > 0) {
        attachmentError = `Task created, but ${failed} ${failed === 1 ? "attachment" : "attachments"} could not be linked.${
          cleanupPending > 0
            ? ` Cleanup remains pending for ${cleanupPending}.`
            : ""
        }`;
      }
    }

    revalidatePath("/tasks");
    return { ok: true, data: { task, attachmentError } };
  } catch (cause) {
    return actionError(cause, "Could not create the task.");
  }
}

export async function updateProductTaskAction(input: {
  taskId: string;
  title: string;
  status: (typeof TASK_STATUSES)[number];
  priority: (typeof TASK_PRIORITIES)[number] | null;
  dueAt: string | null;
  description: string;
}): Promise<TaskActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = updateProductTaskSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Check the task details and try again." };
    }
    const current = await requireOwnedTask(access, parsed.data.taskId);
    // Merge into the existing payload so create-time tags/estimate survive
    // a description edit from the peek panel.
    const descriptionJson = { ...current.description_json };
    if (parsed.data.description) {
      descriptionJson.text = parsed.data.description;
    } else {
      delete descriptionJson.text;
    }
    await updateTaskAndStatus(
      access.client,
      access.ownerId,
      parsed.data.taskId,
      {
        title: parsed.data.title,
        priority: parsed.data.priority,
        due_at: parsed.data.dueAt,
        description_json: descriptionJson,
        status: parsed.data.status,
      },
    );
    revalidatePath("/tasks");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not update the task.");
  }
}

export async function moveProductTaskAction(input: {
  taskId: string;
  status: "not_started" | "in_progress" | "in_review" | "done";
  beforeTaskId: string | null;
  afterTaskId: string | null;
}): Promise<TaskActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = moveProductTaskSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid task move." };
    await requireOwnedTask(access, parsed.data.taskId);
    await moveTaskOrdered(
      access.client,
      access.ownerId,
      parsed.data.taskId,
      parsed.data.status,
      parsed.data.beforeTaskId,
      parsed.data.afterTaskId,
    );
    revalidatePath("/tasks");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not move the task.");
  }
}

export async function deleteProductTaskAction(input: {
  taskId: string;
}): Promise<TaskActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = taskMutationSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid task." };
    await requireOwnedTask(access, parsed.data.taskId);
    await deleteTask(access.client, access.ownerId, parsed.data.taskId);
    revalidatePath("/tasks");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not delete the task.");
  }
}

export async function createProductSubtaskAction(input: {
  taskId: string;
  title: string;
}): Promise<TaskActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = createSubtaskSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Add a subtask title." };
    await requireOwnedTask(access, parsed.data.taskId);
    await createSubtask(access.client, parsed.data.taskId, parsed.data.title);
    revalidatePath("/tasks");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not add the subtask.");
  }
}

export async function toggleProductSubtaskAction(input: {
  subtaskId: string;
  isDone: boolean;
}): Promise<TaskActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = toggleSubtaskSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid subtask update." };
    await requireOwnedSubtask(access, parsed.data.subtaskId);
    await toggleSubtask(access.client, parsed.data.subtaskId, parsed.data.isDone);
    revalidatePath("/tasks");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not update the subtask.");
  }
}

export async function deleteProductSubtaskAction(input: {
  subtaskId: string;
}): Promise<TaskActionResult> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = deleteSubtaskSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid subtask." };
    await requireOwnedSubtask(access, parsed.data.subtaskId);
    await deleteSubtask(access.client, parsed.data.subtaskId);
    revalidatePath("/tasks");
    return { ok: true, data: undefined };
  } catch (cause) {
    return actionError(cause, "Could not delete the subtask.");
  }
}

export async function scheduleProductTaskAction(input: {
  taskId: string;
  operationKey: string;
  startsAt: string;
  endsAt: string;
}): Promise<TaskActionResult<{ eventId: string }>> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = scheduleTaskActionInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error:
          parsed.error.issues[0]?.message ?? "Choose a valid date and time.",
      };
    }
    const task = await requireOwnedTask(access, parsed.data.taskId);
    const event = await scheduleTask(access.client, access.ownerId, {
      taskId: task.id,
      operationKey: parsed.data.operationKey,
      title: task.title,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
    });
    revalidatePath("/tasks");
    return { ok: true, data: { eventId: event.id } };
  } catch (cause) {
    return actionError(cause, "Could not schedule the task.");
  }
}

export async function attachFileToProductTaskAction(input: {
  taskId: string;
  fileSourceId: string;
}): Promise<TaskActionResult<{ fileCount: number; fileName: string }>> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = attachFileToTaskActionInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Choose a valid file." };
    }
    await requireOwnedTask(access, parsed.data.taskId);
    const file = await requireOwnedVisibleFileSource(
      access,
      parsed.data.fileSourceId,
    );
    await attachFileToTask(access.client, parsed.data);
    const fileCount = await countTaskFiles(access, parsed.data.taskId);
    revalidatePath("/tasks");
    return {
      ok: true,
      data: { fileCount, fileName: file.name },
    };
  } catch (cause) {
    return actionError(cause, "Could not attach the file.");
  }
}

export async function linkProductTaskToWorkspaceAction(input: {
  taskId: string;
  workspaceId: string;
}): Promise<TaskActionResult<{ workspaceName: string }>> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = linkTaskToWorkspaceActionInputSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "Choose a valid workspace." };
    }
    await requireOwnedTask(access, parsed.data.taskId);
    const workspace = await requireOwnedWorkspace(
      access,
      parsed.data.workspaceId,
    );
    await linkTaskToWorkspace(access.client, access.ownerId, parsed.data);
    revalidatePath("/tasks");
    return { ok: true, data: { workspaceName: workspace.name } };
  } catch (cause) {
    return actionError(cause, "Could not add the task to the workspace.");
  }
}

export async function loadTaskCrossLinkOptionsAction(input: {
  taskId: string;
}): Promise<TaskActionResult<TaskCrossLinkOptions>> {
  try {
    const access = await requireMutationDataAccess();
    const parsed = taskCrossLinkOptionsInputSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Invalid task." };
    await requireOwnedTask(access, parsed.data.taskId);
    const data = await loadOwnedTaskCrossLinkOptions(
      access,
      parsed.data.taskId,
    );
    return { ok: true, data };
  } catch (cause) {
    return actionError(cause, "Could not load cross-feature options.");
  }
}
