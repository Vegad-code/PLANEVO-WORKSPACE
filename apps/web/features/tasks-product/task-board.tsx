"use client";

import {
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS, isKeyboardEvent } from "@dnd-kit/utilities";
import type { TaskWithMeta } from "@planevo/core/queries/product-tasks";
import {
  TASK_STATUS_LABELS,
  type TaskStatus,
} from "@planevo/core/types/tasks";
import { Icon } from "@/components/ui/planevo-icon";
import { TaskCard } from "./task-card";
import {
  resolveTaskBoardDrop,
  type TaskBoardStatus,
} from "./task-board-ordering";
import { taskBoardAnnouncement } from "./task-board-a11y";

export type { TaskBoardStatus } from "./task-board-ordering";

const BOARD_STATUSES = [
  "not_started",
  "in_progress",
  "in_review",
  "done",
] as const satisfies readonly TaskStatus[];

type TaskBoardProps = {
  tasks: TaskWithMeta[];
  onStatusChange: (
    taskId: string,
    status: TaskBoardStatus,
    position: number,
  ) => void | Promise<void>;
  onTaskSelect?: (taskId: string) => void;
  onCreateTask?: (status: TaskBoardStatus) => void;
};

function isBoardStatus(value: unknown): value is TaskBoardStatus {
  return BOARD_STATUSES.some((status) => status === value);
}

function sortedTasks(tasks: TaskWithMeta[]): TaskWithMeta[] {
  return [...tasks].sort(
    (left, right) =>
      left.position - right.position || left.id.localeCompare(right.id),
  );
}

function columnId(status: TaskBoardStatus): string {
  return `task-column:${status}`;
}

function SortableTaskCard({
  task,
  onTaskSelect,
}: {
  task: TaskWithMeta;
  onTaskSelect?: (taskId: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "task", status: task.status },
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard
        task={task}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
        dragHandleRef={setActivatorNodeRef}
        onOpen={onTaskSelect ? () => onTaskSelect(task.id) : undefined}
      />
    </div>
  );
}

function TaskColumn({
  status,
  tasks,
  onTaskSelect,
  onCreateTask,
}: {
  status: TaskBoardStatus;
  tasks: TaskWithMeta[];
  onTaskSelect?: (taskId: string) => void;
  onCreateTask?: (status: TaskBoardStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnId(status),
    data: { type: "column", status },
  });
  const headingId = `task-column-heading-${status}`;
  const taskCountLabel = `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`;

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={`flex w-72 shrink-0 flex-col rounded-xl border bg-sidebar p-2 transition-colors motion-reduce:transition-none xl:w-auto ${
        isOver ? "border-ink" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-3 px-1 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <h2 id={headingId} className="truncate text-small font-medium">
            {TASK_STATUS_LABELS[status]}
          </h2>
          <span
            aria-label={taskCountLabel}
            className="shrink-0 rounded-full border border-border bg-paper px-2 py-0.5 font-mono text-label text-text-secondary"
          >
            {String(tasks.length).padStart(2, "0")}
          </span>
        </div>
        {onCreateTask ? (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-label={`Create task in ${TASK_STATUS_LABELS[status]}`}
            onClick={() => onCreateTask(status)}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-paper text-text-secondary outline-none hover:border-border-strong hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Icon name="plus" className="size-4" />
          </button>
        ) : null}
      </div>

      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="mt-2 flex min-h-32 flex-1 flex-col gap-2">
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              onTaskSelect={onTaskSelect}
            />
          ))}
          {tasks.length === 0 && (
            <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-raised px-4 py-8 text-center">
              <p className="text-small font-medium text-text-secondary">No tasks here</p>
              <p className="mt-1 text-small text-text-muted">Drag a task into this column.</p>
            </div>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

export function TaskBoard({
  tasks,
  onStatusChange,
  onTaskSelect,
  onCreateTask,
}: TaskBoardProps) {
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const columns = useMemo(
    () =>
      BOARD_STATUSES.map((status) => ({
        status,
        tasks: sortedTasks(tasks.filter((task) => task.status === status)),
      })),
    [tasks],
  );
  const activeTask = activeTaskId
    ? tasks.find((task) => task.id === activeTaskId) ?? null
    : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveTaskId(String(event.active.id));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTaskId(null);

    const { active, activatorEvent, over } = event;
    if (!over) return;

    const taskId = String(active.id);
    const overStatus = over.data.current?.status;
    if (!isBoardStatus(overStatus)) return;

    const translatedRect = active.rect.current.translated;
    const pointerIsAfterTarget = translatedRect
      ? translatedRect.top + translatedRect.height / 2 >
        over.rect.top + over.rect.height / 2
      : false;
    const drop = resolveTaskBoardDrop({
      tasks,
      activeId: taskId,
      overId: String(over.id),
      overStatus,
      activation: isKeyboardEvent(activatorEvent) ? "keyboard" : "pointer",
      pointerIsAfterTarget,
    });
    if (!drop) return;

    await onStatusChange(taskId, drop.status, drop.position);
  }

  return (
    <DndContext
      id="tasks-product-board"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragCancel={() => setActiveTaskId(null)}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements: {
          onDragStart({ active }) {
            return taskBoardAnnouncement(tasks, "start", String(active.id), null, null);
          },
          onDragOver({ active, over }) {
            const status = over?.data.current?.status;
            return taskBoardAnnouncement(
              tasks,
              "over",
              String(active.id),
              isBoardStatus(status) ? status : null,
              over ? String(over.id) : null,
            );
          },
          onDragEnd({ active, over }) {
            const status = over?.data.current?.status;
            return taskBoardAnnouncement(
              tasks,
              "drop",
              String(active.id),
              isBoardStatus(status) ? status : null,
              over ? String(over.id) : null,
            );
          },
          onDragCancel({ active }) {
            return taskBoardAnnouncement(tasks, "cancel", String(active.id), null, null);
          },
        },
      }}
    >
      <div
        role="region"
        aria-label="Task board"
        className="overflow-x-auto rounded-card border border-border bg-paper p-2 pb-4"
      >
        <div className="flex min-w-max items-stretch gap-2 xl:grid xl:min-w-0 xl:grid-cols-4">
          {columns.map((column) => (
            <TaskColumn
              key={column.status}
              status={column.status}
              tasks={column.tasks}
              onTaskSelect={onTaskSelect}
              onCreateTask={onCreateTask}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-72">
            <TaskCard task={activeTask} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
