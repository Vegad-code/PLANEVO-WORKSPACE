"use client"

import type { RefObject } from "react"
import { useCalendarNow } from "./calendar-now-context"
import { CalendarNowIndicator } from "./calendar-now-indicator"
import { DAY_START_HOUR, VISIBLE_HOURS } from "./time-axis"

type CalendarNowIndicatorHostProps = {
  visible: boolean
  preferSingleDaySlot?: boolean
  rbcRootRef: RefObject<HTMLElement | null>
}

/**
 * Leaf subscriber for the minute clock — keeps the grid engine off the tick.
 */
export function CalendarNowIndicatorHost({
  visible,
  preferSingleDaySlot = false,
  rbcRootRef,
}: CalendarNowIndicatorHostProps) {
  const now = useCalendarNow()
  const nowHour = now.getHours()
  const inVisibleHours =
    nowHour >= DAY_START_HOUR && nowHour < DAY_START_HOUR + VISIBLE_HOURS

  return (
    <CalendarNowIndicator
      now={now}
      visible={visible && inVisibleHours}
      preferSingleDaySlot={preferSingleDaySlot}
      rbcRootRef={rbcRootRef}
    />
  )
}
