"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveIconDefinition } from "@planevo/core/tasks/icon-catalog";
import type { TaskIconDefinition, TaskIconRef } from "@planevo/core/tasks/task-icon-types";
import { toast } from "@/components/ui/toast";
import { updateTaskIconAction } from "@/app/(workspace)/tasks/actions";
import { TaskIconPicker } from "./task-icon-picker";
import { TaskIconRender } from "./task-icon-render";

type TaskIconSlotProps = {
  taskId: string;
  iconRef: TaskIconRef;
  definition: TaskIconDefinition;
  active: boolean;
  interactive?: boolean;
};

export function TaskIconSlot({
  taskId,
  iconRef,
  definition,
  active,
  interactive = true,
}: TaskIconSlotProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [optimisticIconRef, setOptimisticIconRef] = useState<TaskIconRef | null>(
    null,
  );
  const localIconRef = optimisticIconRef ?? iconRef;
  const containerRef = useRef<HTMLDivElement>(null);

  const currentDefinition =
    resolveIconDefinition(localIconRef.id, localIconRef.emoji) ?? definition;

  function handleIconSelect(nextIcon: TaskIconRef) {
    setOptimisticIconRef(nextIcon);
    setPickerOpen(false);

    startTransition(async () => {
      const result = await updateTaskIconAction({
        taskId,
        iconId: nextIcon.id,
        style: nextIcon.style,
        emoji: nextIcon.emoji,
      });
      if (!result.ok) {
        setOptimisticIconRef(null);
        toast(result.error, { tone: "error" });
        return;
      }
      setOptimisticIconRef(null);
      router.refresh();
    });
  }

  const wellClassName = `flex size-task-icon-well shrink-0 items-center justify-center rounded-lg bg-sidebar ring-1 ring-inset ring-border/80 ${
    active ? "text-text-secondary" : "text-text-muted/65"
  }`;

  const frameClassName =
    "mx-auto w-fit rounded-xl border border-border bg-paper p-2";

  if (!interactive) {
    return (
      <div className={frameClassName}>
        <div className={wellClassName}>
          <TaskIconRender
            definition={currentDefinition}
            active={active}
            style={localIconRef.style}
            size="slot"
          />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${frameClassName}`}>
      <button
        type="button"
        aria-label="Change task icon"
        aria-expanded={pickerOpen}
        disabled={isPending}
        onClick={(event) => {
          event.stopPropagation();
          setPickerOpen((open) => !open);
        }}
        onKeyDown={(event) => event.stopPropagation()}
        className={`group rounded-lg outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink ${
          pickerOpen ? "ring-1 ring-inset ring-border-strong" : ""
        }`}
      >
        <div
          className={`${wellClassName} transition-colors group-hover:ring-border-strong`}
        >
          <TaskIconRender
            definition={currentDefinition}
            active={active}
            style={localIconRef.style}
            size="slot"
          />
        </div>
      </button>
      {pickerOpen ? (
        <TaskIconPicker
          currentIconRef={localIconRef}
          onSelect={handleIconSelect}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}
