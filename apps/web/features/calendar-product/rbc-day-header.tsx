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
  /** Day view: left like GCal. Week view: centered in each column. */
  align?: "start" | "center"
}

export function RbcDayHeader({
  date,
  now,
  align = "center",
}: RbcDayHeaderProps) {
  const isToday = isCalendarToday(date, now)

  return (
    <div
      className={cn(
        "flex min-w-0 py-0",
        align === "start" ? "justify-start pl-3 pr-1" : "justify-center px-1",
      )}
      aria-label={formatDayHeaderAccessibleLabel(date)}
    >
      {/* Inner stack keeps FRI centered over the date disc (GCal). */}
      <div className="flex flex-col items-center gap-[var(--spacing-calendar-day-header-gap)]">
        <span
          className={cn(
            "calendar-day-weekday",
            isToday && "calendar-day-weekday--today",
          )}
          aria-hidden="true"
        >
          {formatDayHeaderWeekday(date)}
        </span>
        <span
          className={cn(
            "calendar-day-number",
            isToday && "calendar-day-number--today",
          )}
          aria-hidden="true"
          aria-current={isToday ? "date" : undefined}
        >
          {formatDayHeaderDayNumber(date)}
        </span>
      </div>
    </div>
  )
}
