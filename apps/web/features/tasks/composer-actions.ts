"use server";

import { revalidatePath } from "next/cache";
import { createProductTaskFromFields } from "@/lib/tasks/create-product-task";

export type TaskFormState =
  | { status: "idle"; message: null }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

function optionalString(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Home command center composer — writes to the product `tasks` table. */
export async function submitTask(
  _previousState: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  const title = optionalString(formData, "title");
  if (!title) return { status: "error", message: "Add a task title to continue." };

  const dueDateValue = optionalString(formData, "dueDate");
  const estimateValue = optionalString(formData, "estimateMinutes");
  const tags = (optionalString(formData, "tags") ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  try {
    await createProductTaskFromFields({
      title,
      description: optionalString(formData, "description"),
      status: optionalString(formData, "status") ?? "Not started",
      priority: optionalString(formData, "priority") ?? null,
      dueAt: dueDateValue ? new Date(dueDateValue).toISOString() : null,
      estimateMinutes: estimateValue
        ? Number.parseInt(estimateValue, 10)
        : null,
      tags,
    });
  } catch (cause) {
    return {
      status: "error",
      message:
        cause instanceof Error ? cause.message : "Could not create the task.",
    };
  }

  revalidatePath("/tasks");
  revalidatePath("/", "layout");
  return { status: "success", message: "Task created." };
}
