"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export type TodayColumnTask = {
  id: string;
  title: string;
  status: string;
  due_at: string | null;
};

/** Drag payload the week grid reads on drop. */
export type TaskDragData = {
  type: "task";
  taskId: string;
  title: string;
};

export function TodayTaskRow({ task }: { task: TodayColumnTask }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `today-task-${task.id}`,
      data: {
        type: "task",
        taskId: task.id,
        title: task.title,
      } satisfies TaskDragData,
    });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`flex cursor-grab touch-none items-center gap-3 rounded-md px-2 py-1.5 outline-none hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
        isDragging ? "z-10 opacity-70" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className="size-4 shrink-0 rounded-full border border-border-strong bg-paper"
      />
      <span className="truncate text-product-body text-ink">{task.title}</span>
    </div>
  );
}
