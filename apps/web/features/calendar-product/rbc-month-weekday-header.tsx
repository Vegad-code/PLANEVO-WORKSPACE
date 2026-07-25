"use client"

import type { HeaderProps } from "react-big-calendar"
import { formatDayHeaderWeekday } from "@/lib/calendar/day-header-model"

export function RbcMonthWeekdayHeader({ date }: HeaderProps) {
  return (
    <div className="calendar-month-weekday-header" aria-hidden="true">
      <span className="calendar-day-weekday">
        {formatDayHeaderWeekday(date)}
      </span>
    </div>
  )
}
