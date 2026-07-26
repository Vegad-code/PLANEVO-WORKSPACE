"use client"

import type { MonthDragData } from "@/lib/calendar/month-drag"
import type { MonthEventItem, MonthItem } from "@/lib/calendar/month-items"
import { formatCompactMonthTime } from "@/lib/calendar/format-compact-month-time"
import { cn } from "@/lib/utils"
import {
  CALENDAR_COLOR_BLOCK_CLASS,
  CALENDAR_COLOR_DOT_CLASS,
} from "./calendar-color-dot"

type MonthDragOverlayProps = {
  drag: MonthDragData
  /** Measured width of the grabbed segment/chip so the ghost matches the source. */
  width: number | null
}

/**
 * Floating clone that follows the pointer during a month drag.
 *
 * The source stays put inside overflow-clipped cells; this overlay is the
 * visible feedback. Presentational only — never mounts useDraggable.
 */
export function MonthDragOverlay({ drag, width }: MonthDragOverlayProps) {
  if (drag.type === "month-resize") {
    return (
      <MonthBarGhost
        item={drag.item}
        width={width}
        edge={drag.edge}
      />
    )
  }

  if (drag.item.kind === "event" && drag.item.displayStyle === "bar") {
    return <MonthBarGhost item={drag.item} width={width} />
  }

  return <MonthChipGhost item={drag.item} width={width} />
}

function MonthChipGhost({
  item,
  width,
}: {
  item: MonthItem
  width: number | null
}) {
  return (
    <div
      aria-hidden="true"
      className="calendar-month-drag-ghost"
      style={width ? { width } : undefined}
    >
      {item.kind === "task" ? (
        <div className="calendar-month-chip calendar-month-chip--task">
          <span
            aria-hidden="true"
            className={cn(
              "calendar-month-task-checkbox border",
              item.completed
                ? "border-ink bg-ink text-paper"
                : "border-border-strong bg-transparent",
            )}
          />
          <span
            className={cn(
              "calendar-month-chip-title",
              item.completed ? "text-text-muted line-through" : "text-ink",
            )}
          >
            {item.title}
          </span>
        </div>
      ) : (
        <div className="calendar-month-chip calendar-month-chip--event">
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
          <span className="calendar-month-chip-title text-ink">{item.title}</span>
        </div>
      )}
    </div>
  )
}

function MonthBarGhost({
  item,
  width,
  edge,
}: {
  item: MonthEventItem
  width: number | null
  edge?: "start" | "end"
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "calendar-month-drag-ghost calendar-month-bar",
        CALENDAR_COLOR_BLOCK_CLASS[item.calendarColor],
        edge && "calendar-month-drag-ghost--resize",
      )}
      style={width ? { width } : { minWidth: "8rem" }}
    >
      <div className="calendar-month-bar-body">
        <span
          aria-hidden="true"
          className={cn(
            "calendar-month-bar-edge",
            CALENDAR_COLOR_DOT_CLASS[item.calendarColor],
          )}
        />
        <span className="calendar-month-bar-title">{item.title}</span>
      </div>
    </div>
  )
}
