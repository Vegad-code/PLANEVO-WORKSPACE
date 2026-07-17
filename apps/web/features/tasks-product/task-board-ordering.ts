import { positionBetween } from "@planevo/core/ordering/fractional";

export type TaskBoardStatus = "not_started" | "in_progress" | "done";

type TaskBoardOrderItem = {
  id: string;
  status: string;
  position: number;
};

type ResolveTaskBoardDropInput = {
  tasks: readonly TaskBoardOrderItem[];
  activeId: string;
  overId: string;
  overStatus: TaskBoardStatus;
  activation: "keyboard" | "pointer";
  pointerIsAfterTarget?: boolean;
};

type TaskBoardDropResult = {
  status: TaskBoardStatus;
  position: number;
};

export function resolveTaskBoardDrop(
  {
    tasks,
    activeId,
    overId,
    overStatus,
    activation,
    pointerIsAfterTarget = false,
  }: ResolveTaskBoardDropInput,
): TaskBoardDropResult | null {
  if (activeId === overId) return null;

  const activeTask = tasks.find((task) => task.id === activeId);
  if (!activeTask) return null;

  const currentTargetTasks = tasks
    .filter((task) => task.status === overStatus)
    .sort(
      (left, right) =>
        left.position - right.position || left.id.localeCompare(right.id),
    );
  const targetTasks = currentTargetTasks.filter(
    (task) => task.id !== activeId,
  );
  const overTaskIndex = targetTasks.findIndex((task) => task.id === overId);

  let insertionIndex = targetTasks.length;
  if (overTaskIndex >= 0) {
    if (activation === "pointer") {
      insertionIndex = overTaskIndex + (pointerIsAfterTarget ? 1 : 0);
    } else if (activeTask.status === overStatus) {
      const activeIndex = currentTargetTasks.findIndex(
        (task) => task.id === activeId,
      );
      const originalOverIndex = currentTargetTasks.findIndex(
        (task) => task.id === overId,
      );
      insertionIndex = overTaskIndex + (activeIndex < originalOverIndex ? 1 : 0);
    } else {
      // A cross-column keyboard move has no shared vertical origin, so place it
      // before the focused task consistently instead of guessing from geometry.
      insertionIndex = overTaskIndex;
    }
  }

  if (activeTask.status === overStatus) {
    const nextOrder = targetTasks.map((task) => task.id);
    nextOrder.splice(insertionIndex, 0, activeId);
    if (
      currentTargetTasks.every((task, index) => task.id === nextOrder[index])
    ) {
      return null;
    }
  }

  const before = targetTasks[insertionIndex - 1]?.position ?? null;
  const after = targetTasks[insertionIndex]?.position ?? null;

  return {
    status: overStatus,
    position: positionBetween(before, after),
  };
}
