import { formatDayHeaderWeekday } from "@/lib/calendar/day-header-model"

/**
 * Sunday-first weekday labels. Shares the week rows' column template, so the
 * columns line up by construction rather than by matched widths.
 */
export function MonthWeekdayHeaderRow({ days }: { days: Date[] }) {
  return (
    <div className="calendar-month-row calendar-month-weekday-row" role="row">
      {days.map((day) => (
        <div
          key={day.getDay()}
          role="columnheader"
          className="calendar-month-weekday"
        >
          {formatDayHeaderWeekday(day)}
        </div>
      ))}
    </div>
  )
}
