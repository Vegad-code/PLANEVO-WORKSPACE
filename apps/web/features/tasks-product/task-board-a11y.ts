import { TASK_STATUS_LABELS } from "@planevo/core/types/tasks";
import type { TaskBoardStatus } from "./task-board-ordering.ts";

type AnnouncedTask = { id: string; title: string; status: string; position: number };
type AnnouncementPhase = "start" | "over" | "drop" | "cancel";

export function taskBoardAnnouncement(
  tasks: readonly AnnouncedTask[],
  phase: AnnouncementPhase,
  activeId: string,
  overStatus: TaskBoardStatus | null,
  overId: string | null,
): string {
  const active = tasks.find((task) => task.id === activeId);
  if (!active) return "Task drag update.";
  const title = active.title.trim() || "Untitled task";
  if (phase === "cancel") return `Cancelled moving ${title}.`;
  const lane = overStatus ?? (active.status as TaskBoardStatus);
  const laneTasks = tasks
    .filter((task) => task.id !== activeId && task.status === lane)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const overIndex = overId ? laneTasks.findIndex((task) => task.id === overId) : -1;
  const position = overIndex < 0 ? laneTasks.length + 1 : overIndex + 1;
  const label = TASK_STATUS_LABELS[lane];
  if (phase === "start") return `Picked up ${title}. Current lane ${label}.`;
  if (phase === "drop") return `Dropped ${title} in ${label}, position ${position} of ${laneTasks.length + 1}.`;
  return `${title} is over ${label}, position ${position} of ${laneTasks.length + 1}.`;
}
