"use client"

import { memo } from "react"
import { useDraggable } from "@dnd-kit/core"
import { ListTodo } from "lucide-react"
import type { MonthItem } from "@/lib/calendar/month-items"
import type { MonthDragData } from "@/lib/calendar/month-drag"
import { formatCompactMonthTime } from "@/lib/calendar/format-compact-month-time"
import { cn } from "@/lib/utils"
import { CALENDAR_COLOR_DOT_CLASS } from "./calendar-color-dot"

type MonthItemChipProps = {
  item: MonthItem
  dateKey: string
  onSelect: (item: MonthItem, anchor: HTMLElement) => void
  onToggleTask: (taskId: string, done: boolean) => void
}

/**
 * A single-day row in a month cell: a timed event or a task due that day.
 *
 * Timed events read as a coloured dot, a compact time, then the title — the
 * title stays visible rather than collapsing to a dot, which is the single most
 * complained-about thing about Apple's month view.
 *
 * While dragging, the source stays put and fades. A DragOverlay clone follows
 * the pointer — transforming this node would clip it inside overflow:hidden.
 */
export const MonthItemChip = memo(function MonthItemChip({
  item,
  dateKey,
  onSelect,
  onToggleTask,
}: MonthItemChipProps) {
  const isReadOnlyEvent =
    item.kind === "event" && item.source !== "planevo"
  // The pointer sensor's 8px activation distance keeps plain clicks working,
  // so the same element can both open an item and drag it to another day.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `month-item-${item.id}`,
    disabled: isReadOnlyEvent,
    data: {
      type: "month-move",
      item,
      originDateKey: dateKey,
    } satisfies MonthDragData,
  })

  if (item.kind === "task") {
    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={cn(
          "calendar-month-chip calendar-month-chip--task",
          isDragging && "calendar-month-chip--dragging",
        )}
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={item.completed}
          aria-label={
            item.completed
              ? `Mark incomplete: ${item.title}`
              : `Complete task: ${item.title}`
          }
          className={cn(
            "calendar-month-task-checkbox border outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink",
            item.completed
              ? "border-ink bg-ink text-paper"
              : "border-border-strong bg-transparent text-transparent hover:border-ink",
          )}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            onToggleTask(item.taskId, item.toggle.nextCompleted)
          }}
        >
          {item.completed ? (
            <svg
              aria-hidden="true"
              viewBox="0 0 12 12"
              className="calendar-month-task-check-icon"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M2.5 6.2 4.8 8.5 9.5 3.5" />
            </svg>
          ) : null}
        </button>
        <span
          className={cn(
            "calendar-month-chip-title",
            item.completed ? "text-text-muted line-through" : "text-ink",
          )}
        >
          {item.title}
        </span>
      </div>
    )
  }

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "calendar-month-chip calendar-month-chip--event",
        isDragging && "calendar-month-chip--dragging",
      )}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(item, event.currentTarget)
      }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "calendar-month-chip-dot",
          CALENDAR_COLOR_DOT_CLASS[item.calendarColor],
        )}
      />
      <span className="calendar-month-chip-time">
        {formatCompactMonthTime(item.start)}
      </span>
      {item.linkedTask ? (
        <span
          aria-hidden="true"
          className="shrink-0 text-text-secondary"
        >
          <ListTodo aria-hidden="true" className="size-3" />
        </span>
      ) : null}
      {item.linkedTask ? (
        <span className="sr-only">
          {item.isTaskComplete
            ? "Completed task block: "
            : "Scheduled task block: "}
        </span>
      ) : null}
      <span
        className={cn(
          "calendar-month-chip-title",
          item.isTaskComplete
            ? "text-text-muted line-through"
            : "text-ink",
        )}
      >
        {item.title}
      </span>
      {item.isSyncedSource ? (
        <span
          aria-label="Synced calendar event"
          className="calendar-month-chip-synced"
        >
          ↗
        </span>
      ) : null}
    </button>
  )
})
