"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Check } from "lucide-react";

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

export function TodayTaskRow({
  task,
  onToggle,
}: {
  task: TodayColumnTask;
  onToggle?: (taskId: string, done: boolean) => void;
}) {
  const [checked, setChecked] = useState(task.status === "done");
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `today-task-${task.id}`,
      data: {
        type: "task",
        taskId: task.id,
        title: task.title,
      } satisfies TaskDragData,
      disabled: checked,
    });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 outline-none hover:bg-surface-raised focus-within:bg-surface-raised ${
        isDragging ? "z-10 opacity-70" : ""
      } ${checked ? "" : "cursor-grab touch-none"}`}
    >
      <button
        type="button"
        aria-pressed={checked}
        aria-label={
          checked ? `Mark ${task.title} not done` : `Mark ${task.title} done`
        }
        onClick={() => {
          const next = !checked;
          setChecked(next);
          onToggle?.(task.id, next);
        }}
        className={`flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-md border outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
          checked
            ? "border-ink bg-ink text-paper"
            : "border-border-strong bg-transparent text-transparent hover:border-ink"
        }`}
      >
        <Check aria-hidden="true" className="size-3" strokeWidth={3} />
      </button>
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={checked}
        className={`min-w-0 flex-1 truncate text-left text-product-body outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
          checked ? "cursor-default text-text-muted line-through" : "text-ink"
        }`}
      >
        {task.title}
      </button>
    </div>
  );
}
