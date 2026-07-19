import type { TaskStatus } from "@planevo/core/types/tasks";

export type TaskDueState = { date: Date; kind: "due" | "overdue" };

export function taskDueState(
  dueAt: string | null,
  status: TaskStatus,
  now = new Date(),
): TaskDueState | null {
  if (!dueAt) return null;
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return null;
  const dueDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const finished = status === "done" || status === "cancelled";
  return { date, kind: !finished && dueDay < today ? "overdue" : "due" };
}
