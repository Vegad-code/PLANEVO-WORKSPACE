"use client";

import { useDroppable } from "@dnd-kit/core";
import { dateKey } from "@planevo/core/state/calendar-state";
import type {
  CalendarColor,
  CalendarEventRow,
  CalendarRow,
  TaskDueChip,
} from "@planevo/core/types/calendar";
import { CALENDAR_COLOR_BLOCK_CLASS } from "./calendar-color-dot";
import { EventBlock } from "./event-block";
import {
  DAY_START_HOUR,
  GRID_HEIGHT_REM,
  TimeAxis,
  VISIBLE_HOURS,
  formatTimeLabel,
  remOffsetForTime,
} from "./time-axis";

const SLOTS_PER_DAY = VISIBLE_HOURS * 2;

export type WeekGridProps = {
  /** First visible day (Monday for week view, the anchor day for day view). */
  weekStart: Date;
  dayCount?: 1 | 7;
  calendars: CalendarRow[];
  events: CalendarEventRow[];
  taskDues: TaskDueChip[];
  now: Date;
  onSlotClick?: (slotStart: Date) => void;
  onEventSelect?: (event: CalendarEventRow, anchor: HTMLElement) => void;
};

/** Drop payload attached to every half-hour cell. */
export type SlotDropData = {
  type: "slot";
  startsAt: string;
};

function slotStartForIndex(day: Date, slotIndex: number): Date {
  const slotStart = new Date(day);
  slotStart.setHours(
    DAY_START_HOUR + Math.floor(slotIndex / 2),
    slotIndex % 2 === 0 ? 0 : 30,
    0,
    0,
  );
  return slotStart;
}

function SlotCell({
  slotStart,
  onSlotClick,
}: {
  slotStart: Date;
  onSlotClick?: (slotStart: Date) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `slot-${slotStart.getTime()}`,
    data: { type: "slot", startsAt: slotStart.toISOString() } satisfies SlotDropData,
  });
  const isHourBoundary = slotStart.getMinutes() === 30;

  return (
    <button
      ref={setNodeRef}
      type="button"
      tabIndex={-1}
      aria-label={`New event ${slotStart.toLocaleDateString(undefined, {
        weekday: "short",
        day: "numeric",
      })} ${formatTimeLabel(slotStart)}`}
      onClick={() => onSlotClick?.(slotStart)}
      className={`h-7 w-full cursor-pointer border-b ${
        isHourBoundary ? "border-border/70" : "border-border/30"
      } ${isOver ? "bg-marigold-tint/50" : "hover:bg-surface-raised"}`}
    />
  );
}

function DayHeaderCell({ day, isToday }: { day: Date; isToday: boolean }) {
  const label = day
    .toLocaleDateString(undefined, { weekday: "short" })
    .substring(0, 3)
    .toUpperCase();
  return (
    <div className="flex-1 border-l border-border px-1 py-2 text-center flex flex-col items-center justify-center">
      <span className="text-label uppercase font-medium text-text-muted mb-1">
        {label}
      </span>
      <span
        className={`text-product-body flex size-7 items-center justify-center rounded-full ${
          isToday ? "bg-ink text-paper font-medium" : "text-ink"
        }`}
      >
        {day.getDate()}
      </span>
    </div>
  );
}

export function WeekGrid({
  weekStart,
  dayCount = 7,
  calendars,
  events,
  taskDues,
  now,
  onSlotClick,
  onEventSelect,
}: WeekGridProps) {
  const days = Array.from({ length: dayCount }, (_, index) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + index);
    day.setHours(0, 0, 0, 0);
    return day;
  });

  const colorByCalendarId = new Map<string, CalendarColor>(
    calendars.map((calendar) => [calendar.id, calendar.color]),
  );
  const visibleCalendarIds = new Set(
    calendars
      .filter((calendar) => calendar.is_visible)
      .map((calendar) => calendar.id),
  );
  const visibleEvents = events.filter((event) =>
    visibleCalendarIds.has(event.calendar_id),
  );

  const timedEventsByDay = new Map<string, CalendarEventRow[]>();
  const allDayEventsByDay = new Map<string, CalendarEventRow[]>();
  for (const event of visibleEvents) {
    const key = dateKey(new Date(event.starts_at));
    const bucket = event.all_day ? allDayEventsByDay : timedEventsByDay;
    bucket.set(key, [...(bucket.get(key) ?? []), event]);
  }

  const dueChipsByDay = new Map<string, TaskDueChip[]>();
  for (const chip of taskDues) {
    const key = dateKey(new Date(chip.dueAt));
    dueChipsByDay.set(key, [...(dueChipsByDay.get(key) ?? []), chip]);
  }

  const todayKey = dateKey(now);
  const nowHour = now.getHours();
  const showNowLine =
    days.some((day) => dateKey(day) === todayKey) &&
    nowHour >= DAY_START_HOUR &&
    nowHour < DAY_START_HOUR + VISIBLE_HOURS;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex border-b border-border">
        <div className="w-14 shrink-0" />
        {days.map((day) => (
          <DayHeaderCell
            key={dateKey(day)}
            day={day}
            isToday={dateKey(day) === todayKey}
          />
        ))}
      </div>

      <div className="flex min-h-9 border-b border-border">
        <div className="flex w-14 shrink-0 items-center justify-end pr-2">
          <span className="text-product-meta text-text-muted">Due</span>
        </div>
        {days.map((day) => {
          const key = dateKey(day);
          const chips = dueChipsByDay.get(key) ?? [];
          const allDayEvents = allDayEventsByDay.get(key) ?? [];
          return (
            <div
              key={key}
              className="flex min-w-0 flex-1 flex-col gap-1 border-l border-border p-1"
            >
              {allDayEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={(clickEvent) =>
                    onEventSelect?.(event, clickEvent.currentTarget)
                  }
                  className={`truncate rounded-full px-2 py-0.5 text-left text-product-meta text-ink ${
                    CALENDAR_COLOR_BLOCK_CLASS[
                      colorByCalendarId.get(event.calendar_id) ?? "slate"
                    ]
                  }`}
                >
                  {event.title}
                </button>
              ))}
              {chips.map((chip) => (
                <span
                  key={chip.taskId}
                  title={`Task due: ${chip.title}`}
                  className="truncate rounded-full border border-border bg-surface-raised px-2 py-0.5 text-product-meta text-ink"
                >
                  {chip.title}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      <div className="flex flex-1 overflow-y-auto">
        <TimeAxis />
        <div
          className="relative flex flex-1"
          style={{ height: `${GRID_HEIGHT_REM}rem` }}
        >
          {days.map((day) => {
            const key = dateKey(day);
            const dayEvents = timedEventsByDay.get(key) ?? [];
            return (
              <div
                key={key}
                className="relative min-w-0 flex-1 border-l border-border"
              >
                {Array.from({ length: SLOTS_PER_DAY }, (_, slotIndex) => {
                  const slotStart = slotStartForIndex(day, slotIndex);
                  return (
                    <SlotCell
                      key={slotIndex}
                      slotStart={slotStart}
                      onSlotClick={onSlotClick}
                    />
                  );
                })}
                {dayEvents.map((event) => (
                  <EventBlock
                    key={event.id}
                    event={event}
                    color={colorByCalendarId.get(event.calendar_id) ?? "slate"}
                    onSelect={onEventSelect}
                  />
                ))}
              </div>
            );
          })}

          {showNowLine ? (
            <div
              aria-hidden="true"
              style={{ top: `${remOffsetForTime(now)}rem` }}
              className="pointer-events-none absolute inset-x-0 z-20"
            >
              <div className="relative border-t border-brick">
                <span className="absolute -top-1 -left-1 size-2 rounded-full bg-brick" />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
