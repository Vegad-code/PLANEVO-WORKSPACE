"use client"

import { memo } from "react"
import { useDroppable } from "@dnd-kit/core"
import type { MonthItem } from "@/lib/calendar/month-items"
import type { MonthDropData } from "@/lib/calendar/month-drag"
import {
  computeDayOverflow,
  MAX_MONTH_ITEMS_PER_DAY,
} from "@/lib/calendar/month-overflow"
import {
  formatDayHeaderAccessibleLabel,
  formatMonthDateLabel,
} from "@/lib/calendar/day-header-model"
import { openMonthDayFromCell } from "@/lib/calendar/month-day-open"
import { cn } from "@/lib/utils"
import { MonthItemChip } from "./month-item-chip"

export type MonthDayCellProps = {
  date: Date
  dateKey: string
  singles: MonthItem[]
  /** Lane rows this cell reserves so the week's bars stay on one baseline. */
  visibleLaneCount: number
  /** Bars covering this day whose lane the week could not fit. */
  hiddenBarCount: number
  capacity: number
  isOutsideMonth: boolean
  isPast: boolean
  isToday: boolean
  isFocused: boolean
  onFocus: () => void
  onOpenAgenda: (date: Date, anchor: HTMLElement) => void
  onOpenDay: (date: Date) => void
  onSelectItem: (item: MonthItem, anchor: HTMLElement) => void
  onToggleTask: (taskId: string, done: boolean) => void
}

/**
 * One day of the month grid.
 *
 * The cell reserves the week's visible bar lanes as blank rows so the bar
 * overlay lands on the same baseline in every column, then stacks this day's
 * single-item chips underneath. Items past the cell's capacity stay mounted and
 * hidden rather than being unmounted, so resolving overflow is a visibility
 * toggle and never triggers a relayout.
 */
export const MonthDayCell = memo(function MonthDayCell({
  date,
  dateKey,
  singles,
  visibleLaneCount,
  hiddenBarCount,
  capacity,
  isOutsideMonth,
  isPast,
  isToday,
  isFocused,
  onFocus,
  onOpenAgenda,
  onOpenDay,
  onSelectItem,
  onToggleTask,
}: MonthDayCellProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `month-day-${dateKey}`,
    data: { type: "month-day", dateKey } satisfies MonthDropData,
  })

  const { visibleSingles, overflowCount, hasOverflow } = computeDayOverflow({
    visibleLaneCount,
    hiddenBarCount,
    singlesForDay: singles,
    capacity,
  })
  // Overflow counts every item, but only a bounded prefix is worth mounting.
  const mountedSingles = singles.slice(0, MAX_MONTH_ITEMS_PER_DAY)

  return (
    <div
      ref={setNodeRef}
      role="gridcell"
      aria-label={formatDayHeaderAccessibleLabel(date)}
      aria-current={isToday ? "date" : undefined}
      data-calendar-day={dateKey}
      tabIndex={isFocused ? 0 : -1}
      onFocus={onFocus}
      onClick={(event) => onOpenAgenda(date, event.currentTarget)}
      onDoubleClick={() => openMonthDayFromCell(date, onOpenDay)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return
        // Enter on the cell is the keyboard route to every item for this day,
        // including the multi-day bars that live in the overlay.
        event.preventDefault()
        event.stopPropagation()
        onOpenAgenda(date, event.currentTarget)
      }}
      className={cn(
        "calendar-month-cell",
        isOutsideMonth && "calendar-month-cell--outside",
        !isOutsideMonth && isPast && "calendar-month-cell--past",
        isOver && "calendar-month-cell--drop-target",
      )}
    >
      <div className="calendar-month-cell-date">
        <span
          className={cn(
            "calendar-month-date",
            isToday && "calendar-month-date--today",
            !isToday && isOutsideMonth && "text-text-muted",
            !isToday && !isOutsideMonth && isPast && "calendar-month-date--past",
          )}
        >
          {formatMonthDateLabel(date)}
        </span>
      </div>

      <div className="calendar-month-cell-stack">
        {Array.from({ length: visibleLaneCount }, (_, lane) => (
          <div
            key={`lane-${lane}`}
            aria-hidden="true"
            className="calendar-month-lane-spacer"
          />
        ))}

        {mountedSingles.map((item, index) => (
          <div key={item.id} hidden={index >= visibleSingles.length}>
            <MonthItemChip
              item={item}
              dateKey={dateKey}
              onSelect={onSelectItem}
              onToggleTask={onToggleTask}
            />
          </div>
        ))}

        {hasOverflow ? (
          <button
            type="button"
            className="calendar-month-overflow"
            aria-label={`${overflowCount} more events`}
            onClick={(event) => {
              event.stopPropagation()
              onOpenAgenda(date, event.currentTarget)
            }}
          >
            {`+${overflowCount} more`}
          </button>
        ) : null}
      </div>
    </div>
  )
})
