"use client";

import { useMemo, useRef, useState } from "react";
import { ListTodo } from "lucide-react";
import type { CalendarEventRow } from "@planevo/core/types/calendar";
import { layoutIntervals } from "@/lib/calendar/interval-layout";
import {
  timelineAxis,
  timelineAxisSlots,
} from "@/lib/calendar/timeline-axis";
import {
  type TimelineItem,
} from "@/lib/calendar/timeline-items";
import {
  nextTimelineFocusIndex,
  type TimelineNavigationKey,
} from "@/lib/calendar/timeline-keyboard-focus";
import type { ViewConfig } from "@/lib/calendar/view-config";
import { cn } from "@/lib/utils";
import {
  CALENDAR_EVENT_BLOCK_CLASS,
} from "./calendar-color-dot";
import { formatTimeLabel } from "./time-axis";

export type TimelineGridProps = {
  day: Date;
  items: TimelineItem[];
  config: ViewConfig;
  now: Date;
  onSelectEvent: (event: CalendarEventRow, anchor: HTMLElement) => void;
  onCreateRange: (
    range: { startsAt: string; endsAt: string },
    anchor: HTMLElement,
  ) => void;
  onToggleTask: (taskId: string, done: boolean) => void;
};

function itemAccessibleLabel(item: TimelineItem): string {
  const time = formatTimeLabel(item.start);
  if (item.kind === "task") {
    return item.completed
      ? `Mark incomplete: ${item.title}, due ${time}`
      : `Complete task: ${item.title}, due ${time}`;
  }

  const taskState = item.linkedTask
    ? item.isTaskComplete
      ? "Completed task block. "
      : "Scheduled task block. "
    : "";
  const source = item.isReadOnly ? "Read-only synced event. " : "";
  return `${source}${taskState}${item.title}, ${time} to ${formatTimeLabel(item.end)}`;
}

function TimelineItemButton({
  item,
  tabIndex,
  cardDensity,
  buttonRef,
  onFocus,
  onKeyDown,
  onSelectEvent,
  onToggleTask,
}: {
  item: TimelineItem;
  tabIndex: number;
  cardDensity: ViewConfig["cardDensity"];
  buttonRef: (node: HTMLButtonElement | null) => void;
  onFocus: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  onSelectEvent: TimelineGridProps["onSelectEvent"];
  onToggleTask: TimelineGridProps["onToggleTask"];
}) {
  if (item.kind === "task") {
    return (
      <button
        ref={buttonRef}
        type="button"
        role="gridcell"
        tabIndex={tabIndex}
        aria-label={itemAccessibleLabel(item)}
        data-timeline-item-id={item.id}
        className="flex h-full w-full min-w-0 items-center gap-2 rounded-[var(--radius-calendar-control)] border border-border bg-paper px-3 py-2 text-left outline-none hover:bg-surface-raised focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onClick={() => onToggleTask(item.taskId, item.toggle.nextCompleted)}
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full border",
            item.completed
              ? "border-ink bg-ink text-paper"
              : "border-border-strong text-transparent",
          )}
        >
          ✓
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-product-body font-medium",
              item.completed ? "text-text-muted line-through" : "text-ink",
            )}
          >
            {item.title}
          </span>
          {cardDensity !== "minimal" ? (
            <span className="block text-product-meta tabular-nums text-text-muted">
              Due {formatTimeLabel(item.start)}
            </span>
          ) : null}
        </span>
      </button>
    );
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      role="gridcell"
      tabIndex={tabIndex}
      aria-label={itemAccessibleLabel(item)}
      data-event-id={item.eventId}
      data-timeline-item-id={item.id}
      className={cn(
        "calendar-event-block flex h-full w-full min-w-0 items-start gap-2 rounded-[var(--radius-calendar-control)] px-3 py-2 text-left outline-none hover:brightness-95 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink",
        CALENDAR_EVENT_BLOCK_CLASS[item.calendarColor],
      )}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onClick={(event) => onSelectEvent(item.event, event.currentTarget)}
    >
      {item.linkedTask ? (
        <ListTodo
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-text-secondary"
        />
      ) : null}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-product-body font-medium",
            item.isTaskComplete ? "text-text-muted line-through" : "text-ink",
          )}
        >
          {item.title}
        </span>
        {cardDensity !== "minimal" ? (
          <span className="block truncate text-product-meta tabular-nums text-text-secondary">
            {item.allDay
              ? "All day"
              : `${formatTimeLabel(item.start)} – ${formatTimeLabel(item.end)}`}
            {item.isReadOnly ? " · Synced" : null}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/**
 * One-day vertical renderer shared by Planner and Flow. Slots remain concrete
 * DOM targets even when event cards are proportional, so the existing outer
 * DnD context can resolve a backlog drop without nesting a second provider.
 */
export function TimelineGrid({
  day,
  items,
  config,
  now,
  onSelectEvent,
  onCreateRange,
  onToggleTask,
}: TimelineGridProps) {
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const axis = useMemo(
    () => timelineAxis({ day, items, mode: config.timeAxis.mode }),
    [day, items, config.timeAxis.mode],
  );
  const slots = useMemo(
    () => (axis ? timelineAxisSlots(axis) : []),
    [axis],
  );
  const allDayItems = useMemo(
    () => items.filter((item) => item.kind === "event" && item.allDay),
    [items],
  );
  const timedItems = useMemo(
    () => items.filter((item) => item.kind === "task" || !item.allDay),
    [items],
  );
  const laidOutItems = useMemo(
    () => layoutIntervals({ intervals: timedItems }),
    [timedItems],
  );
  const focusOrder = useMemo(
    () => [...allDayItems, ...laidOutItems.map(({ interval }) => interval)],
    [allDayItems, laidOutItems],
  );
  const activeItemId = focusOrder.some((item) => item.id === focusedItemId)
    ? focusedItemId
    : (focusOrder[0]?.id ?? null);

  if (!axis) {
    return (
      <div
        role="grid"
        aria-label="Timeline unavailable"
        className="calendar-timeline-grid items-center justify-center text-product-body text-text-muted"
      >
        Invalid calendar day
      </div>
    );
  }

  const axisDuration = axis.end.getTime() - axis.start.getTime();
  const proportional = config.timeAxis.rowHeight === "proportional-to-duration";
  const nowOffset =
    now.getTime() >= axis.start.getTime() && now.getTime() < axis.end.getTime()
      ? ((now.getTime() - axis.start.getTime()) / axisDuration) * 100
      : null;

  function handleItemKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    itemId: string,
  ) {
    if (
      event.key !== "ArrowUp" &&
      event.key !== "ArrowDown" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    const currentIndex = focusOrder.findIndex((item) => item.id === itemId);
    const nextIndex = nextTimelineFocusIndex({
      key: event.key as TimelineNavigationKey,
      currentIndex,
      itemCount: focusOrder.length,
    });
    if (nextIndex === null) return;

    const nextId = focusOrder[nextIndex]?.id;
    if (!nextId) return;
    event.preventDefault();
    setFocusedItemId(nextId);
    itemRefs.current.get(nextId)?.focus();
  }

  function itemButtonProps(item: TimelineItem) {
    return {
      item,
      tabIndex: item.id === activeItemId ? 0 : -1,
      cardDensity: config.cardDensity,
      buttonRef: (node: HTMLButtonElement | null) => {
        if (node) itemRefs.current.set(item.id, node);
        else itemRefs.current.delete(item.id);
      },
      onFocus: () => setFocusedItemId(item.id),
      onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) =>
        handleItemKeyDown(event, item.id),
      onSelectEvent,
      onToggleTask,
    };
  }

  return (
    <div
      role="grid"
      aria-label={`${day.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })} timeline`}
      aria-rowcount={focusOrder.length}
      aria-colcount={1}
      className="planevo-calendar-grid calendar-timeline-grid"
    >
      <div className="calendar-timeline-header px-4 py-3">
        <p className="text-product-meta font-medium uppercase tracking-wide text-text-muted">
          {day.toLocaleDateString("en-US", { weekday: "long" })}
        </p>
        <p className="text-product-body font-semibold text-ink">
          {day.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {allDayItems.length > 0 ? (
          <div
            role="rowgroup"
            aria-label="All-day events"
            className="flex flex-col gap-1 border-b border-border bg-surface-raised px-3 py-2"
          >
            {allDayItems.map((item) => (
              <div
                key={item.id}
                role="row"
                className="calendar-timeline-all-day-item"
              >
                <TimelineItemButton {...itemButtonProps(item)} />
              </div>
            ))}
          </div>
        ) : null}

        <div className="relative min-h-full" role="rowgroup">
          <div aria-hidden="false">
            {slots.map((slot) => (
              <div
                key={slot.start.toISOString()}
                className="calendar-timeline-slot"
              >
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Create event at ${formatTimeLabel(slot.start)}`}
                  data-calendar-day={`${slot.start.getFullYear()}-${String(
                    slot.start.getMonth() + 1,
                  ).padStart(2, "0")}-${String(slot.start.getDate()).padStart(
                    2,
                    "0",
                  )}`}
                  data-calendar-slot-time={`${String(
                    slot.start.getHours(),
                  ).padStart(2, "0")}:${String(
                    slot.start.getMinutes(),
                  ).padStart(2, "0")}`}
                  className="flex w-full items-start text-left outline-none focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
                  onClick={(event) =>
                    onCreateRange(
                      {
                        startsAt: slot.start.toISOString(),
                        endsAt: slot.end.toISOString(),
                      },
                      event.currentTarget,
                    )
                  }
                >
                  <span className="calendar-timeline-gutter shrink-0 px-2 pt-1 text-right text-product-meta tabular-nums text-text-muted">
                    {formatTimeLabel(slot.start)}
                  </span>
                  <span
                    aria-hidden="true"
                    className="mt-2 block flex-1 border-t border-border"
                  />
                </button>
              </div>
            ))}
          </div>

          <div className="calendar-timeline-event-layer">
            {nowOffset !== null ? (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 z-20 border-t border-brick"
                style={{ top: `${nowOffset}%` }}
              />
            ) : null}

            {laidOutItems.map(({ interval: item, left, width }) => {
              const top =
                ((item.start.getTime() - axis.start.getTime()) / axisDuration) *
                100;
              const durationHeight =
                ((Math.max(item.end.getTime(), item.start.getTime()) -
                  item.start.getTime()) /
                  axisDuration) *
                100;

              return (
                <div
                  key={item.id}
                  role="row"
                  className={cn(
                    "calendar-timeline-event",
                    !proportional && "calendar-timeline-event--fixed",
                  )}
                  style={{
                    top: `${top}%`,
                    left: `${left * 100}%`,
                    width: `${width * 100}%`,
                    height: proportional ? `${durationHeight}%` : undefined,
                  }}
                >
                  <TimelineItemButton {...itemButtonProps(item)} />
                </div>
              );
            })}
          </div>

          {timedItems.length === 0 ? (
            <p className="calendar-timeline-empty text-product-body text-text-muted">
              No timed items
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
