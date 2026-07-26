"use client"

import type { BarSegment } from "@/lib/calendar/month-lane-layout"
import type { MonthItem } from "@/lib/calendar/month-items"
import { planWeekLanes } from "@/lib/calendar/month-overflow"
import { localDateKey } from "@/lib/calendar/month-day-index"
import { MonthDayCell } from "./month-day-cell"
import { MonthEventBar } from "./month-event-bar"

export type MonthWeekRowProps = {
  days: Date[]
  weekIndex: number
  bars: BarSegment[]
  singlesByDay: Map<string, MonthItem[]>
  capacity: number
  anchorMonth: number
  today: Date
  focusedDateKey: string | null
  onFocusDay: (dateKey: string) => void
  onOpenAgenda: (date: Date, anchor: HTMLElement) => void
  onOpenDay: (date: Date) => void
  onSelectItem: (item: MonthItem, anchor: HTMLElement) => void
  onToggleTask: (taskId: string, done: boolean) => void
}

/**
 * One week of the month grid: seven day cells plus the bar overlay.
 *
 * Multi-day bars live in an overlay rather than inside the cells because a bar
 * spans columns and a cell cannot. The overlay uses the same seven columns and
 * is offset by the date header so its lanes sit exactly on the blank rows each
 * cell reserves.
 */
export function MonthWeekRow({
  days,
  weekIndex,
  bars,
  singlesByDay,
  capacity,
  anchorMonth,
  today,
  focusedDateKey,
  onFocusDay,
  onOpenAgenda,
  onOpenDay,
  onSelectItem,
  onToggleTask,
}: MonthWeekRowProps) {
  const todayKey = localDateKey(today)

  const barsPerColumn = days.map(
    (_, column) =>
      bars.filter(
        (segment) =>
          column >= segment.columnStart &&
          column < segment.columnStart + segment.columnSpan,
      ),
  )

  const { visibleLaneCount } = planWeekLanes({
    laneCountForWeek: bars.reduce(
      (most, segment) => Math.max(most, segment.lane + 1),
      0,
    ),
    dayItemCounts: days.map(
      (day, column) =>
        (barsPerColumn[column]?.length ?? 0) +
        (singlesByDay.get(localDateKey(day))?.length ?? 0),
    ),
    capacity,
  })

  const visibleBars = bars.filter((segment) => segment.lane < visibleLaneCount)

  return (
    <div className="calendar-month-row calendar-month-week" role="row">
      {days.map((day, column) => {
        const key = localDateKey(day)
        return (
          <MonthDayCell
            key={key}
            date={day}
            dateKey={key}
            singles={singlesByDay.get(key) ?? []}
            visibleLaneCount={visibleLaneCount}
            hiddenBarCount={
              barsPerColumn[column]?.filter(
                (segment) => segment.lane >= visibleLaneCount,
              ).length ?? 0
            }
            capacity={capacity}
            isOutsideMonth={day.getMonth() !== anchorMonth}
            isPast={key < todayKey}
            isToday={key === todayKey}
            isFocused={key === focusedDateKey}
            onFocus={() => onFocusDay(key)}
            onOpenAgenda={onOpenAgenda}
            onOpenDay={onOpenDay}
            onSelectItem={onSelectItem}
            onToggleTask={onToggleTask}
          />
        )
      })}

      {visibleLaneCount > 0 ? (
        <div className="calendar-month-bar-layer" aria-hidden="true">
          {visibleBars.map((segment) => (
            <MonthEventBar
              key={`${segment.itemId}-${weekIndex}`}
              segment={segment}
              originDate={days[segment.columnStart] ?? days[0]!}
              onSelect={onSelectItem}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
