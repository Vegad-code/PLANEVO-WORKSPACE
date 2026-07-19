import { randomUUID } from "node:crypto";
import { createTask } from "@planevo/core/mutations/product-tasks";
import {
  TASK_PRIORITIES,
  TASK_STATUS_LABELS,
  type TaskPriority,
  type TaskRow,
  type TaskStatus,
} from "@planevo/core/types/tasks";
import { requireMutationDataAccess } from "@/lib/data/access";

const STATUS_BY_LABEL: Record<string, TaskStatus> = Object.fromEntries(
  Object.entries(TASK_STATUS_LABELS).map(([value, label]) => [
    label,
    value as TaskStatus,
  ]),
) as Record<string, TaskStatus>;

const PRIORITY_BY_LABEL: Record<string, TaskPriority> = {
  Low: "low",
  Medium: "medium",
  High: "high",
};

export type CreateProductTaskFields = {
  title: string;
  description?: string;
  /** UI label ("Not started") or DB enum (`not_started`). */
  status?: string;
  /** UI label ("High") or DB enum (`high`). */
  priority?: string | null;
  dueAt?: string | null;
  estimateMinutes?: number | null;
  tags?: string[];
};

function resolveStatus(value?: string): TaskStatus {
  if (!value) return "not_started";
  if (
    value === "not_started" ||
    value === "in_progress" ||
    value === "in_review" ||
    value === "done" ||
    value === "cancelled"
  ) {
    return value;
  }
  return STATUS_BY_LABEL[value] ?? "not_started";
}

function resolvePriority(value?: string | null): TaskPriority | null {
  if (!value) return null;
  if ((TASK_PRIORITIES as readonly string[]).includes(value)) {
    return value as TaskPriority;
  }
  return PRIORITY_BY_LABEL[value] ?? null;
}

/** Create a global product task row on `public.tasks`. */
export async function createProductTaskFromFields(
  input: CreateProductTaskFields,
): Promise<TaskRow> {
  const access = await requireMutationDataAccess();
  const descriptionJson: Record<string, unknown> = {};
  if (input.description?.trim()) {
    descriptionJson.text = input.description.trim();
  }
  if (input.tags?.length) {
    descriptionJson.tags = input.tags;
  }
  if (input.estimateMinutes != null && input.estimateMinutes > 0) {
    descriptionJson.estimateMinutes = input.estimateMinutes;
  }

  return createTask(access.client, access.ownerId, {
    operationKey: randomUUID(),
    title: input.title.trim(),
    status: resolveStatus(input.status),
    priority: resolvePriority(input.priority),
    due_at: input.dueAt ?? null,
    description_json: descriptionJson,
  });
}
