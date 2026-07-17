export const TASK_STATUSES = [
  "not_started",
  "in_progress",
  "done",
  "cancelled",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
  cancelled: "Cancelled",
};

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority | null;
  due_at: string | null;
  description_json: Record<string, unknown>;
  position: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export function taskStatusLabel(status: TaskStatus): string {
  return TASK_STATUS_LABELS[status];
}
