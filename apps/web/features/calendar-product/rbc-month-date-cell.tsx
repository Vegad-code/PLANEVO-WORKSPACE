"use client"

import type { DateHeaderProps } from "react-big-calendar"
import {
  formatDayHeaderAccessibleLabel,
  formatMonthDateLabel,
  isCalendarToday,
} from "@/lib/calendar/day-header-model"
import { cn } from "@/lib/utils"

type RbcMonthDateCellProps = DateHeaderProps & {
  now: Date
}

export function RbcMonthDateCell({ date, label, now }: RbcMonthDateCellProps) {
  const isToday = isCalendarToday(date, now)
  const isOffRange = label !== "current"

  return (
    <div
      className={cn(
        "flex justify-end px-[var(--spacing-calendar-month-cell-padding)] pt-[var(--spacing-calendar-month-cell-padding)]",
        isOffRange && "text-text-muted",
      )}
      aria-label={formatDayHeaderAccessibleLabel(date)}
      aria-current={isToday ? "date" : undefined}
    >
      <span
        className={cn(
          "calendar-month-date inline-flex items-center justify-center",
          isToday && "calendar-month-date--today",
          isOffRange && "font-normal",
        )}
      >
        {formatMonthDateLabel(date)}
      </span>
    </div>
  )
}
