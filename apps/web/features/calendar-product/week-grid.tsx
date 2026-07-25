"use client"

import { useEffect, useRef } from "react"
import { useDroppable } from "@dnd-kit/core"
import { dateKey } from "@planevo/core/state/calendar-state"
import type {
  CalendarColor,
  CalendarEventRow,
  CalendarRow,
} from "@planevo/core/types/calendar"
import {
  formatDayHeaderAccessibleLabel,
  formatDayHeaderDayNumber,
  formatDayHeaderWeekday,
  isCalendarToday,
} from "@/lib/calendar/day-header-model"
import { cn } from "@/lib/utils"
import { EventBlock } from "./event-block"
import {
  DAY_START_HOUR,
  DEFAULT_SCROLL_HOUR,
  HOUR_MIN_REM,
  SLOT_MIN_REM,
  VISIBLE_HOURS,
  formatHourLabel,
  formatTimeLabel,
  hoursIntoDayWindow,
  percentOffsetForTime,
} from "./time-axis"
import {
  CALENDAR_COLOR_BLOCK_CLASS,
  CALENDAR_COLOR_BORDER_CLASS,
} from "./calendar-color-dot"

const SLOTS_PER_DAY = VISIBLE_HOURS * 2
const AXIS_WIDTH_CLASS = "w-[4.5rem]"

export type WeekGridProps = {
  /** First visible day (Sunday for GCal week, anchor day for day view). */
  weekStart: Date
  dayCount?: 1 | 7
  calendars: CalendarRow[]
  events: CalendarEventRow[]
  now: Date
  onSlotClick?: (slotStart: Date) => void
  onEventSelect?: (event: CalendarEventRow, anchor: HTMLElement) => void
  className?: string
}

/** Drop payload attached to every half-hour cell. */
export type SlotDropData = {
  type: "slot"
  startsAt: string
}

function slotStartForIndex(day: Date, slotIndex: number): Date {
  const slotStart = new Date(day)
  slotStart.setHours(
    DAY_START_HOUR + Math.floor(slotIndex / 2),
    slotIndex % 2 === 0 ? 0 : 30,
    0,
    0,
  )
  return slotStart
}

function SlotCell({
  dayKey,
  slotStart,
  onSlotClick,
}: {
  dayKey: string
  slotStart: Date
  onSlotClick?: (slotStart: Date) => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${slotStart.getTime()}`,
    data: {
      type: "slot",
      startsAt: slotStart.toISOString(),
    } satisfies SlotDropData,
  })
  const isHalfHour = slotStart.getMinutes() === 30
  const timeKey = `${String(slotStart.getHours()).padStart(2, "0")}:${String(slotStart.getMinutes()).padStart(2, "0")}:00`

  return (
    <button
      ref={setNodeRef}
      type="button"
      tabIndex={-1}
      data-calendar-day={dayKey}
      data-calendar-slot-time={timeKey}
      aria-label={`New event ${slotStart.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
      })} ${formatTimeLabel(slotStart)}`}
      onClick={() => onSlotClick?.(slotStart)}
      className={cn(
        "block h-full w-full cursor-pointer border-t border-l bg-calendar-grid",
        isHalfHour ? "border-dotted border-border" : "border-border",
        isOver && "bg-ocean-tint/40",
        !isOver && "hover:bg-surface-raised/40",
      )}
    />
  )
}

function DayHeaderCell({ day, now }: { day: Date; now: Date }) {
  const isToday = isCalendarToday(day, now)
  const label = formatDayHeaderAccessibleLabel(day)

  return (
    <div
      className={cn(
        "flex min-h-[3.5rem] min-w-0 flex-1 flex-col items-center justify-center gap-[var(--spacing-calendar-day-header-gap)] border-l border-border bg-surface-raised px-1 py-2",
      )}
      aria-label={label}
    >
      <span
        className={cn(
          "calendar-day-weekday",
          isToday && "calendar-day-weekday--today",
        )}
        aria-hidden="true"
      >
        {formatDayHeaderWeekday(day)}
      </span>
      <span
        className={cn(
          "calendar-day-number",
          isToday && "calendar-day-number--today",
        )}
        aria-hidden="true"
        aria-current={isToday ? "date" : undefined}
      >
        {formatDayHeaderDayNumber(day)}
      </span>
    </div>
  )
}

function AllDayEventChip({
  event,
  color,
  onSelect,
}: {
  event: CalendarEventRow
  color: CalendarColor
  onSelect?: (event: CalendarEventRow, anchor: HTMLElement) => void
}) {
  return (
    <button
      type="button"
      onClick={(clickEvent) => onSelect?.(event, clickEvent.currentTarget)}
      className={cn(
        "mb-0.5 w-full truncate rounded-md border-l-[3px] px-1.5 py-0.5 text-left text-product-meta font-medium text-ink outline-none focus-visible:outline focus-visible:outline-offset-1 focus-visible:outline-ink",
        CALENDAR_COLOR_BLOCK_CLASS[color],
        CALENDAR_COLOR_BORDER_CLASS[color],
      )}
    >
      {event.title}
    </button>
  )
}

export function WeekGrid({
  weekStart,
  dayCount = 7,
  calendars,
  events,
  now,
  onSlotClick,
  onEventSelect,
  className,
}: WeekGridProps) {
  const days = Array.from({ length: dayCount }, (_, index) => {
    const day = new Date(weekStart)
    day.setDate(day.getDate() + index)
    day.setHours(0, 0, 0, 0)
    return day
  })

  const colorByCalendarId = new Map<string, CalendarColor>(
    calendars.map((calendar) => [calendar.id, calendar.color]),
  )
  const visibleCalendarIds = new Set(
    calendars
      .filter((calendar) => calendar.is_visible)
      .map((calendar) => calendar.id),
  )
  const visibleEvents = events.filter((event) =>
    visibleCalendarIds.has(event.calendar_id),
  )

  const timedEventsByDay = new Map<string, CalendarEventRow[]>()
  const allDayEventsByDay = new Map<string, CalendarEventRow[]>()
  for (const event of visibleEvents) {
    const key = dateKey(new Date(event.starts_at))
    const bucket = event.all_day ? allDayEventsByDay : timedEventsByDay
    bucket.set(key, [...(bucket.get(key) ?? []), event])
  }

  const hasAllDayEvents = visibleEvents.some((event) => event.all_day)

  const todayKey = dateKey(now)
  const nowHour = now.getHours()
  const showNowLine =
    days.some((day) => dateKey(day) === todayKey) &&
    nowHour >= DAY_START_HOUR &&
    nowHour < DAY_START_HOUR + VISIBLE_HOURS

  const scrollRef = useRef<HTMLDivElement>(null)
  const didInitialScroll = useRef(false)

  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller || didInitialScroll.current) return
    const todayInView = days.some((day) => dateKey(day) === todayKey)
    const fraction = todayInView
      ? hoursIntoDayWindow(now) / VISIBLE_HOURS
      : DEFAULT_SCROLL_HOUR / VISIBLE_HOURS
    const maxScroll = scroller.scrollHeight - scroller.clientHeight
    const target = fraction * scroller.scrollHeight - scroller.clientHeight / 2
    scroller.scrollTop = Math.min(Math.max(target, 0), maxScroll)
    didInitialScroll.current = true
  }, [days, todayKey, now])

  return (
    <div
      className={cn(
        "planevo-calendar-grid flex h-full min-h-0 w-full flex-col overflow-hidden rounded-t-[var(--radius-calendar-shell)] border border-border bg-calendar-grid",
        className,
      )}
      data-calendar-grid="native"
      aria-label="Calendar grid"
    >
      <div className="flex shrink-0 border-b border-border">
        <div
          className={cn(AXIS_WIDTH_CLASS, "shrink-0 border-r border-border bg-surface-raised")}
          aria-hidden="true"
        />
        {days.map((day) => (
          <DayHeaderCell key={dateKey(day)} day={day} now={now} />
        ))}
      </div>

      {hasAllDayEvents ? (
        <div className="flex shrink-0 border-b border-border">
          <div
            className={cn(
              AXIS_WIDTH_CLASS,
              "shrink-0 border-r border-border bg-surface-raised",
            )}
            aria-hidden="true"
          >
            <span className="sr-only">All day</span>
          </div>
          {days.map((day) => {
            const key = dateKey(day)
            const dayEvents = allDayEventsByDay.get(key) ?? []
            return (
              <div
                key={key}
                data-calendar-day={key}
                className="flex min-w-0 flex-1 flex-col border-l border-border bg-calendar-grid px-0.5 py-0.5"
              >
                {dayEvents.map((event) => (
                  <AllDayEventChip
                    key={event.id}
                    event={event}
                    color={colorByCalendarId.get(event.calendar_id) ?? "slate"}
                    onSelect={onEventSelect}
                  />
                ))}
              </div>
            )
          })}
        </div>
      ) : null}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div
          className="flex"
          style={{ minHeight: `calc(${SLOTS_PER_DAY} * ${SLOT_MIN_REM}rem)` }}
        >
          {/* GCal-style time gutter — no horizontal grid lines, labels align to hour ticks in the grid */}
          <div
            className={cn(
              AXIS_WIDTH_CLASS,
              "sticky left-0 z-10 shrink-0 border-r border-border bg-surface-raised",
            )}
            data-calendar-time-gutter
            aria-hidden="true"
          >
            {Array.from({ length: VISIBLE_HOURS }, (_, hourIndex) => {
              const hour = DAY_START_HOUR + hourIndex
              const isFirstHour = hourIndex === 0
              return (
                <div
                  key={hour}
                  className="relative"
                  style={{ height: `${HOUR_MIN_REM}rem` }}
                >
                  <span
                    className={cn(
                      "absolute right-2 leading-none text-product-meta font-normal tabular-nums text-text-muted",
                      isFirstHour ? "top-0.5" : "top-0 -translate-y-1/2",
                    )}
                  >
                    {formatHourLabel(hour)}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="relative min-w-0 flex-1">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
                gridAutoRows: `${SLOT_MIN_REM}rem`,
              }}
            >
              {Array.from({ length: SLOTS_PER_DAY }, (_, slotIndex) =>
                days.map((day) => {
                  const key = dateKey(day)
                  const slotStart = slotStartForIndex(day, slotIndex)
                  const isToday = key === todayKey
                  return (
                    <div
                      key={`${key}-${slotIndex}`}
                      className={cn(
                        isToday &&
                          "bg-[color-mix(in_srgb,var(--color-ink)_4%,var(--color-calendar-grid))]",
                      )}
                    >
                      <SlotCell
                        dayKey={key}
                        slotStart={slotStart}
                        onSlotClick={onSlotClick}
                      />
                    </div>
                  )
                }),
              )}
            </div>

            <div className="pointer-events-none absolute inset-0 flex min-w-0">
              {days.map((day) => {
                const key = dateKey(day)
                const dayEvents = timedEventsByDay.get(key) ?? []
                return (
                  <div key={key} className="relative min-w-0 flex-1">
                    {dayEvents.map((event) => (
                      <div key={event.id} className="pointer-events-auto">
                        <EventBlock
                          event={event}
                          color={
                            colorByCalendarId.get(event.calendar_id) ?? "slate"
                          }
                          onSelect={onEventSelect}
                        />
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>

            {showNowLine ? (
              <div
                aria-hidden="true"
                style={{ top: `${percentOffsetForTime(now)}%` }}
                className="pointer-events-none absolute inset-x-0 z-20"
              >
                <div className="relative border-t border-ink">
                  <span className="absolute -top-1 -left-1 size-2 rounded-full bg-ink" />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
