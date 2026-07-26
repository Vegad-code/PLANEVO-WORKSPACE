"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { MonthItem } from "@/lib/calendar/month-items"
import { layoutMonthItems, DAYS_PER_WEEK } from "@/lib/calendar/month-lane-layout"
import {
  addLocalDays,
  localDateKey,
  parseLocalDateKey,
} from "@/lib/calendar/month-day-index"
import {
  focusDateAfterPageKey,
  focusDateKeyInGrid,
} from "@/lib/calendar/month-keyboard-focus"
import { calendarDays } from "@planevo/core/state/calendar-state"
import { cn } from "@/lib/utils"
import { MonthWeekdayHeaderRow } from "./month-weekday-header-row"
import { MonthWeekRow } from "./month-week-row"
import { useMonthCapacity } from "./use-month-capacity"

const WEEKS_IN_FETCH_WINDOW = 6

export type MonthGridProps = {
  anchor: Date
  items: MonthItem[]
  now: Date
  onOpenAgenda: (date: Date, anchor: HTMLElement) => void
  onOpenDay: (date: Date) => void
  onSelectItem: (item: MonthItem, anchor: HTMLElement) => void
  onToggleTask: (taskId: string, done: boolean) => void
  onNavigateMonth: (offset: number) => void
  className?: string
}

/**
 * The month view.
 *
 * The whole month is always on screen: the body is a grid of `1fr` week rows,
 * which cannot sum past the container's height, so the grid can never scroll or
 * push the page. How much each cell shows is then measured back out of that
 * geometry rather than hardcoded — the mistake behind every "why does it only
 * show three events" complaint.
 */
export function MonthGrid({
  anchor,
  items,
  now,
  onOpenAgenda,
  onOpenDay,
  onSelectItem,
  onToggleTask,
  onNavigateMonth,
  className,
}: MonthGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [focusedDateKey, setFocusedDateKey] = useState<string | null>(null)
  const pendingFocusRef = useRef<string | null>(null)
  const pendingFocusDateRef = useRef<Date | null>(null)

  const anchorMonth = anchor.getMonth()

  // The 42-day fetch window never changes; only the rendered rows are trimmed
  // so a month that fits in five weeks does not carry a dead sixth row.
  const days = useMemo(() => {
    const window = calendarDays(anchor)
    const lastWeek = window.slice((WEEKS_IN_FETCH_WINDOW - 1) * DAYS_PER_WEEK)
    const isLastWeekEmpty = lastWeek.every(
      (day) => day.getMonth() !== anchorMonth,
    )
    return isLastWeekEmpty
      ? window.slice(0, (WEEKS_IN_FETCH_WINDOW - 1) * DAYS_PER_WEEK)
      : window
  }, [anchor, anchorMonth])

  const rowCount = days.length / DAYS_PER_WEEK
  const { bodyRef, capacity } = useMonthCapacity(rowCount)

  const layout = useMemo(() => layoutMonthItems(items, days), [items, days])

  const weeks = useMemo(
    () =>
      Array.from({ length: rowCount }, (_, weekIndex) => {
        const weekDays = days.slice(
          weekIndex * DAYS_PER_WEEK,
          (weekIndex + 1) * DAYS_PER_WEEK,
        )
        return {
          weekIndex,
          days: weekDays,
          bars: layout.bars.filter((segment) => segment.weekIndex === weekIndex),
        }
      }),
    [days, layout, rowCount],
  )

  const focusDay = useCallback((dateKey: string) => {
    setFocusedDateKey(dateKey)
    pendingFocusRef.current = dateKey
  }, [])

  const navigateMonthWithFocus = useCallback(
    (offset: number, target: Date) => {
      pendingFocusDateRef.current = target
      onNavigateMonth(offset)
    },
    [onNavigateMonth],
  )

  // Moving focus is imperative by necessity: the roving tabindex only marks
  // which cell is reachable, it does not move the caret there.
  useEffect(() => {
    const pendingDate = pendingFocusDateRef.current
    if (pendingDate) {
      pendingFocusDateRef.current = null
      focusDay(focusDateKeyInGrid(pendingDate, days))
      return
    }

    const dateKey = pendingFocusRef.current
    if (!dateKey) return
    pendingFocusRef.current = null
    const cell = gridRef.current?.querySelector(
      `[data-calendar-day="${dateKey}"]`,
    )
    if (cell instanceof HTMLElement) cell.focus()
  }, [focusedDateKey, days, anchor, focusDay])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const activeKey = focusedDateKey ?? localDateKey(days[0]!)
      const active = parseLocalDateKey(activeKey)

      const moveByDays = (offset: number) => {
        const target = addLocalDays(active, offset)
        const targetKey = localDateKey(target)
        if (!days.some((day) => localDateKey(day) === targetKey)) {
          // Stepping off either end follows the calendar rather than stopping
          // dead, so a week of arrow presses crosses months naturally.
          navigateMonthWithFocus(offset > 0 ? 1 : -1, target)
          return
        }
        focusDay(targetKey)
      }

      switch (event.key) {
        case "ArrowLeft":
          moveByDays(-1)
          break
        case "ArrowRight":
          moveByDays(1)
          break
        case "ArrowUp":
          moveByDays(-DAYS_PER_WEEK)
          break
        case "ArrowDown":
          moveByDays(DAYS_PER_WEEK)
          break
        case "Home":
          focusDay(localDateKey(addLocalDays(active, -active.getDay())))
          break
        case "End":
          focusDay(
            localDateKey(
              addLocalDays(active, DAYS_PER_WEEK - 1 - active.getDay()),
            ),
          )
          break
        case "PageUp":
          navigateMonthWithFocus(
            -1,
            focusDateAfterPageKey(active, "PageUp"),
          )
          break
        case "PageDown":
          navigateMonthWithFocus(
            1,
            focusDateAfterPageKey(active, "PageDown"),
          )
          break
        default:
          return
      }

      event.preventDefault()
    },
    [days, focusDay, focusedDateKey, navigateMonthWithFocus],
  )

  // The first cell of the month is the default tab stop until a day is focused.
  const defaultFocusKey = useMemo(() => {
    const todayKey = localDateKey(now)
    if (days.some((day) => localDateKey(day) === todayKey)) return todayKey
    const firstOfMonth = days.find((day) => day.getMonth() === anchorMonth)
    return localDateKey(firstOfMonth ?? days[0]!)
  }, [days, now, anchorMonth])

  const activeFocusKey = focusedDateKey ?? defaultFocusKey

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label={anchor.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })}
      aria-rowcount={rowCount}
      aria-colcount={DAYS_PER_WEEK}
      onKeyDown={handleKeyDown}
      className={cn("calendar-month-grid", className)}
    >
      <div role="rowgroup" className="calendar-month-head">
        <MonthWeekdayHeaderRow days={days.slice(0, DAYS_PER_WEEK)} />
      </div>

      <div
        ref={bodyRef}
        role="rowgroup"
        className="calendar-month-body"
        style={{ gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))` }}
      >
        {weeks.map((week) => (
          <MonthWeekRow
            key={week.weekIndex}
            days={week.days}
            weekIndex={week.weekIndex}
            bars={week.bars}
            singlesByDay={layout.singlesByDay}
            capacity={capacity}
            anchorMonth={anchorMonth}
            today={now}
            focusedDateKey={activeFocusKey}
            onFocusDay={setFocusedDateKey}
            onOpenAgenda={onOpenAgenda}
            onOpenDay={onOpenDay}
            onSelectItem={onSelectItem}
            onToggleTask={onToggleTask}
          />
        ))}
      </div>
    </div>
  )
}
