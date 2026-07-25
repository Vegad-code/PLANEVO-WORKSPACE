"use client"

import type { HeaderProps } from "react-big-calendar"
import {
  formatDayHeaderAccessibleLabel,
  formatDayHeaderDayNumber,
  formatDayHeaderWeekday,
  isCalendarToday,
} from "@/lib/calendar/day-header-model"
import { cn } from "@/lib/utils"

type RbcDayHeaderProps = HeaderProps & {
  now: Date
}

export function RbcDayHeader({ date, now }: RbcDayHeaderProps) {
  const isToday = isCalendarToday(date, now)

  return (
    <div
      className="flex min-h-[3.5rem] min-w-0 flex-col items-center justify-center gap-[var(--spacing-calendar-day-header-gap)] px-1 py-2"
      aria-label={formatDayHeaderAccessibleLabel(date)}
    >
      <span
        className={cn(
          "calendar-day-weekday",
          isToday && "calendar-day-weekday--today",
        )}
      >
        {formatDayHeaderWeekday(date)}
      </span>
      <span
        className={cn(
          "calendar-day-number",
          isToday && "calendar-day-number--today",
        )}
      >
        {formatDayHeaderDayNumber(date)}
      </span>
    </div>
  )
}
