/**
 * F-15: map a parsed quick-capture draft into a `tasks` insert payload.
 * Pure — no Supabase client, no side effects. Consumes the output of
 * `parseQuickCapture` (natural-capture.ts) and produces DB-enum fields.
 */
import type { QuickCaptureDraft } from "./natural-capture.ts";
import { TASK_STATUS_LABELS } from "../types/tasks.ts";
import type { TaskPriority, TaskStatus } from "../types/tasks.ts";

export type TaskInsertPayload = {
  title: string;
  status: TaskStatus;
  priority: TaskPriority | null;
  due_at: string | null;
};

// Reverse of TASK_STATUS_LABELS so a parsed label ("Done") maps back to its enum.
const STATUS_BY_LABEL: Record<string, TaskStatus> = Object.fromEntries(
  Object.entries(TASK_STATUS_LABELS).map(([value, label]) => [label, value]),
) as Record<string, TaskStatus>;

/**
 * due_at policy: a due date needs a calendar day. The parser's `dueDate` is an
 * ISO at LOCAL start-of-day; if the line also named a `time`, we stamp that
 * wall-clock time onto that day. Date-only stays at midnight (dueDate
 * unchanged). A time with no date is dropped — we do not invent a day.
 */
function combineDueAt(
  dueDate: string | null,
  time: { hour: number; minute: number } | null,
): string | null {
  if (!dueDate) return null;
  if (!time) return dueDate;
  const at = new Date(dueDate);
  at.setHours(time.hour, time.minute, 0, 0);
  return at.toISOString();
}

export function quickCaptureToTaskInsert(
  draft: QuickCaptureDraft,
): TaskInsertPayload {
  return {
    title: draft.title,
    // priorityToken is already "low" | "medium" | "high" | null = TaskPriority | null.
    priority: draft.priorityToken,
    // Quick capture never sets status, but the draft type allows a label; default not_started.
    status: (draft.status && STATUS_BY_LABEL[draft.status]) || "not_started",
    due_at: combineDueAt(draft.dueDate, draft.time),
  };
}
