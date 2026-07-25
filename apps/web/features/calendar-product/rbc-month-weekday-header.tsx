"use client"

import type { HeaderProps } from "react-big-calendar"
import { formatDayHeaderWeekday } from "@/lib/calendar/day-header-model"

export function RbcMonthWeekdayHeader({ date }: HeaderProps) {
  return (
    <div
      className="flex min-h-0 items-center justify-center py-2"
      aria-hidden="true"
    >
      <span className="calendar-day-weekday">
        {formatDayHeaderWeekday(date)}
      </span>
    </div>
  )
}
