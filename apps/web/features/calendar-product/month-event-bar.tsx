"use client"

import { useDraggable } from "@dnd-kit/core"
import { ListTodo } from "lucide-react"
import type { BarSegment } from "@/lib/calendar/month-lane-layout"
import type { MonthItem } from "@/lib/calendar/month-items"
import type { MonthDragData } from "@/lib/calendar/month-drag"
import { localDateKey } from "@/lib/calendar/month-day-index"
import { cn } from "@/lib/utils"
import {
  CALENDAR_COLOR_BLOCK_CLASS,
  CALENDAR_COLOR_DOT_CLASS,
} from "./calendar-color-dot"

type MonthEventBarProps = {
  segment: BarSegment
  /** The day under this segment's first column, used as the drag origin. */
  originDate: Date
  onSelect: (item: MonthItem, anchor: HTMLElement) => void
}

/** One edge handle. Dragging it to a day extends or shortens the run. */
function BarResizeHandle({
  segment,
  edge,
  disabled = false,
}: {
  segment: BarSegment
  edge: "start" | "end"
  disabled?: boolean
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: `month-bar-${segment.itemId}-${edge}`,
    disabled,
    data: {
      type: "month-resize",
      item: segment.item,
      edge,
    } satisfies MonthDragData,
  })

  if (disabled) return null

  return (
    <span
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-hidden="true"
      className={cn(
        "calendar-month-bar-handle",
        edge === "start"
          ? "calendar-month-bar-handle--start"
          : "calendar-month-bar-handle--end",
      )}
    />
  )
}

/**
 * One week's slice of an all-day or multi-day event.
 *
 * The title repeats on every row the run touches, matching Google and Apple —
 * a blank continuation bar leaves the reader guessing. The edge that continues
 * into an adjacent week loses its corner radius and its handle, which is what
 * signals the run carries on past the row.
 *
 * While dragging, the source stays put and fades. A DragOverlay clone follows
 * the pointer — transforming this node would clip it inside overflow:hidden.
 */
export function MonthEventBar({
  segment,
  originDate,
  onSelect,
}: MonthEventBarProps) {
  const { item, isContinuedFromPrevWeek, isContinuedIntoNextWeek } = segment

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `month-bar-${segment.itemId}-w${segment.weekIndex}`,
    data: {
      type: "month-move",
      item,
      originDateKey: localDateKey(originDate),
    } satisfies MonthDragData,
  })

  return (
    <div
      style={{
        gridColumn: `${segment.columnStart + 1} / span ${segment.columnSpan}`,
        gridRow: segment.lane + 1,
      }}
      className={cn(
        "calendar-month-bar",
        CALENDAR_COLOR_BLOCK_CLASS[item.calendarColor],
        isContinuedFromPrevWeek && "calendar-month-bar--continues-before",
        isContinuedIntoNextWeek && "calendar-month-bar--continues-after",
        isDragging && "calendar-month-bar--dragging",
      )}
    >
      {!isContinuedFromPrevWeek ? (
        <BarResizeHandle segment={segment} edge="start" />
      ) : null}

      <button
        type="button"
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        // The overlay sits outside the gridcells, so a focusable bar would be
        // unreachable in grid navigation anyway. Keyboard and screen-reader
        // users get every item for a day — bars included — from the agenda.
        tabIndex={-1}
        className="calendar-month-bar-body"
        onClick={(event) => {
          event.stopPropagation()
          onSelect(item, event.currentTarget)
        }}
      >
        <span
          aria-hidden="true"
          className={cn(
            "calendar-month-bar-edge",
            CALENDAR_COLOR_DOT_CLASS[item.calendarColor],
          )}
        />
        <span className="calendar-month-bar-title">
          {item.linkedTask ? (
            <span
              aria-hidden="true"
              className="mr-1 inline-flex align-middle text-text-secondary"
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
          {isContinuedFromPrevWeek ? (
            <span className="sr-only">Continued: </span>
          ) : null}
          <span
            className={
              item.isTaskComplete ? "text-text-muted line-through" : undefined
            }
          >
            {item.title}
          </span>
        </span>
      </button>

      {!isContinuedIntoNextWeek ? (
        <BarResizeHandle segment={segment} edge="end" />
      ) : null}
    </div>
  )
}
