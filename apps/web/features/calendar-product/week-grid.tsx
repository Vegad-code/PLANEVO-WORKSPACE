"use client";

import { useEffect, useRef } from "react";
import { useDroppable } from "@dnd-kit/core";
import { dateKey } from "@planevo/core/state/calendar-state";
import type {
  CalendarColor,
  CalendarEventRow,
  CalendarRow,
} from "@planevo/core/types/calendar";
import { EventBlock } from "./event-block";
import {
  DAY_START_HOUR,
  DEFAULT_SCROLL_HOUR,
  SLOT_MIN_REM,
  TimeAxis,
  VISIBLE_HOURS,
  formatTimeLabel,
  hoursIntoDayWindow,
  percentOffsetForTime,
} from "./time-axis";

const SLOTS_PER_DAY = VISIBLE_HOURS * 2;

export type WeekGridProps = {
  /** First visible day (Monday for week view, the anchor day for day view). */
  weekStart: Date;
  dayCount?: 1 | 7;
  calendars: CalendarRow[];
  events: CalendarEventRow[];
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
    data: {
      type: "slot",
      startsAt: slotStart.toISOString(),
    } satisfies SlotDropData,
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
      style={{ minHeight: `${SLOT_MIN_REM}rem` }}
      className={`w-full flex-1 cursor-pointer border-b ${
        isHourBoundary ? "border-border/70" : "border-border/30"
      } ${isOver ? "bg-ocean-tint/40" : "hover:bg-surface-raised"}`}
    />
  );
}

function DayHeaderCell({ day, isToday }: { day: Date; isToday: boolean }) {
  const weekday = day
    .toLocaleDateString(undefined, { weekday: "short" })
    .toUpperCase();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-0.5 border-l border-border px-1 py-3">
      <span className="text-label uppercase tracking-wide text-text-muted">
        {weekday}
      </span>
      <span
        className={`flex size-8 items-center justify-center rounded-full text-h3 tabular-nums ${
          isToday
            ? "bg-ink font-medium text-paper"
            : "font-medium text-ink"
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
  const visibleEvents = events.filter(
    (event) =>
      visibleCalendarIds.has(event.calendar_id) && !event.all_day,
  );

  const timedEventsByDay = new Map<string, CalendarEventRow[]>();
  for (const event of visibleEvents) {
    const key = dateKey(new Date(event.starts_at));
    timedEventsByDay.set(key, [...(timedEventsByDay.get(key) ?? []), event]);
  }

  const todayKey = dateKey(now);
  const nowHour = now.getHours();
  const showNowLine =
    days.some((day) => dateKey(day) === todayKey) &&
    nowHour >= DAY_START_HOUR &&
    nowHour < DAY_START_HOUR + VISIBLE_HOURS;

  const scrollRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);

  // Google-style viewing point: on open (and on each remount from week/day
  // navigation) scroll so the current time sits centered in the pane. Uses the
  // measured scrollHeight so it is correct regardless of how tall the flex-fill
  // grid resolved to, and clamps so it can never land in the void past midnight.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || didInitialScroll.current) return;
    const todayInView = days.some((day) => dateKey(day) === todayKey);
    const fraction = todayInView
      ? hoursIntoDayWindow(now) / VISIBLE_HOURS
      : DEFAULT_SCROLL_HOUR / VISIBLE_HOURS;
    const maxScroll = scroller.scrollHeight - scroller.clientHeight;
    const target = fraction * scroller.scrollHeight - scroller.clientHeight / 2;
    scroller.scrollTop = Math.min(Math.max(target, 0), maxScroll);
    didInitialScroll.current = true;
  }, [days, todayKey, now]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex border-b border-border">
        <div
          className="w-20 shrink-0 border-r border-border pl-2"
          aria-hidden="true"
        />
        {days.map((day) => (
          <DayHeaderCell
            key={dateKey(day)}
            day={day}
            isToday={dateKey(day) === todayKey}
          />
        ))}
      </div>

      <div ref={scrollRef} className="flex min-h-0 flex-1 overflow-y-auto">
        <TimeAxis />
        <div className="relative flex min-h-full flex-1">
          {days.map((day) => {
            const key = dateKey(day);
            const dayEvents = timedEventsByDay.get(key) ?? [];
            const isToday = key === todayKey;
            return (
              <div
                key={key}
                className={`relative flex min-h-full min-w-0 flex-1 flex-col border-l border-border ${
                  isToday ? "bg-surface-raised/30" : ""
                }`}
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
              style={{ top: `${percentOffsetForTime(now)}%` }}
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
