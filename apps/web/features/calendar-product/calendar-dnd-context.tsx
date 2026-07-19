"use client";

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import type { TaskDragData } from "./today-task-row";
import type { SlotDropData } from "./week-grid";

type CalendarDndContextProps = {
  onScheduleTask: (taskId: string, startsAt: string) => void;
  children: React.ReactNode;
};

/** Bridges Today-column task drags onto week-grid slot drops. */
export function CalendarDndContext({
  onScheduleTask,
  children,
}: CalendarDndContextProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  function handleDragEnd(dragEvent: DragEndEvent) {
    const taskData = dragEvent.active.data.current as TaskDragData | undefined;
    const slotData = dragEvent.over?.data.current as SlotDropData | undefined;
    if (taskData?.type !== "task" || slotData?.type !== "slot") return;
    onScheduleTask(taskData.taskId, slotData.startsAt);
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {children}
    </DndContext>
  );
}
