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
  /** Week view only — opens Day view for this column's date (GCal). */
  onSelectDay?: (date: Date) => void
}

export function RbcDayHeader({
  date,
  now,
  align = "center",
  onSelectDay,
}: RbcDayHeaderProps) {
  const isToday = isCalendarToday(date, now)
  const accessibleLabel = formatDayHeaderAccessibleLabel(date)

  const weekdayLabel = (
    <span
      className={cn(
        "calendar-day-weekday",
        isToday && "calendar-day-weekday--today",
      )}
      aria-hidden="true"
    >
      {formatDayHeaderWeekday(date)}
    </span>
  )

  const dayNumberLabel = (
    <span
      className={cn(
        "calendar-day-number",
        isToday && "calendar-day-number--today",
      )}
      aria-hidden="true"
      aria-current={onSelectDay ? undefined : isToday ? "date" : undefined}
    >
      {formatDayHeaderDayNumber(date)}
    </span>
  )

  return (
    <div
      className={cn(
        "flex min-w-0 py-0",
        align === "start" ? "justify-start pl-3 pr-1" : "justify-center px-1",
      )}
    >
      {onSelectDay ? (
        <div className="calendar-day-header-stack">
          {weekdayLabel}
          <button
            type="button"
            className="calendar-day-header-button"
            aria-label={`Open ${accessibleLabel} in day view`}
            aria-current={isToday ? "date" : undefined}
            onClick={() => onSelectDay(date)}
          >
            {dayNumberLabel}
          </button>
        </div>
      ) : (
        <div
          className="calendar-day-header-static"
          aria-label={accessibleLabel}
        >
          {weekdayLabel}
          {dayNumberLabel}
        </div>
      )}
    </div>
  )
}
