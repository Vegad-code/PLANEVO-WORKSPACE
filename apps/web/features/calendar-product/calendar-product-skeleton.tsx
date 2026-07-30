"use client";

import { useLayoutEffect, useMemo, useState, type CSSProperties } from "react";
import Skeleton from "react-loading-skeleton";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PanelLeft,
  SlidersHorizontal,
} from "lucide-react";
import { ProductSkeletonTheme } from "@/components/ui/product-skeleton-theme";
import {
  DEFAULT_PLANNING_COLLAPSED,
  DEFAULT_PLANNING_WIDTH,
  getPlanningCollapsed,
  getPlanningWidth,
} from "@/lib/calendar/planning-prefs";
import { formatCompactMonthTime } from "@/lib/calendar/format-compact-month-time";
import { cn } from "@/lib/utils";
import {
  CALENDAR_SKELETON_TIME_LABEL_MIN_HEIGHT_PERCENT,
  calendarSkeletonColumnCount,
  planCalendarGridSkeletonLayout,
  type CalendarSkeletonAllDayItem,
  type CalendarSkeletonMonthBarItem,
  type CalendarSkeletonMonthSingleItem,
  type CalendarSkeletonTimedItem,
  type CalendarSkeletonView,
} from "@/lib/calendar/calendar-grid-skeleton-layout";
import { DAYS_PER_WEEK } from "@/lib/calendar/month-lane-layout";
import type { CalendarSkeletonEventGeometry } from "@/lib/calendar/calendar-skeleton-event-memory";
import { resolveCalendarSkeletonEvents } from "@/lib/calendar/calendar-skeleton-event-memory";
import { monthGridDays } from "@/lib/calendar/month-grid-days";
import { DEFAULT_MONTH_CAPACITY, planWeekLanes } from "@/lib/calendar/month-overflow";
import {
  parseCalendarDate,
  parseCalendarView,
} from "@/lib/calendar/calendar-range";
import { VISIBLE_HOURS } from "@/lib/calendar/event-block-position";
import {
  calendarEventSurface,
  isCustomCalendarColor,
} from "@/lib/calendar/calendar-color";
import type { CalendarColorValue } from "@planevo/core/types/calendar";
import {
  calendarColorStyle,
  CALENDAR_COLOR_DOT_CLASS,
} from "./calendar-color-dot";
import { formatTimeLabel } from "./time-axis";

const MINI_MONTH_CELLS = 35;
const SKELETON_TASK_ROWS = 4;
const SKELETON_WEEK_COLUMNS = 7;

function PlanningSectionHeader({ label }: { label: string }) {
  return (
    <div className="flex w-full items-center gap-1.5 px-1 py-2">
      <ChevronDown
        aria-hidden="true"
        className="size-3.5 shrink-0 text-text-muted"
      />
      <span className="flex-1 text-product-body font-medium text-ink">
        {label}
      </span>
    </div>
  );
}

/**
 * Agenda rail chrome. Kept in the layout tree at all times (width 0 when
 * collapsed) so the main column does not jump when prefs restore — same
 * geometry contract as CalendarProductView's motion.aside.
 */
function PlanningRailSkeleton({
  collapsed,
  width,
  prefsRestored,
}: {
  collapsed: boolean;
  width: number;
  prefsRestored: boolean;
}) {
  return (
    <aside
      aria-hidden="true"
      className={cn(
        "hidden shrink-0 overflow-hidden bg-calendar-chrome lg:flex lg:flex-col",
        !prefsRestored && "planning-rail-boot",
        collapsed && "pointer-events-none",
      )}
      style={prefsRestored ? { width: collapsed ? 0 : width } : undefined}
    >
      <div
        className="relative flex h-full shrink-0 flex-col overflow-hidden"
        style={{ width }}
      >
        <div className="flex h-full w-full flex-col gap-3 px-4 pt-4 pb-4 pr-3">
          <div className="flex min-h-8 items-center justify-between gap-2">
            <h2 className="text-h3 font-semibold text-ink">Agenda</h2>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg text-text-muted">
              <PanelLeft aria-hidden="true" className="size-4" />
            </span>
          </div>

          <nav className="-mx-1 min-h-0 flex-1 overflow-hidden px-1">
            <section className="border-b border-border">
              <PlanningSectionHeader label="Date" />
              <div className="px-1 pb-3">
                <div className="mb-2 flex items-center justify-between gap-1">
                  <Skeleton
                    width={112}
                    height={16}
                    enableAnimation={false}
                  />
                  <div className="flex items-center gap-0.5 text-product-meta text-text-secondary">
                    <span className="rounded-md px-2 py-0.5">Prev</span>
                    <span className="rounded-md px-2 py-0.5">Next</span>
                  </div>
                </div>
                <div className="mb-1 grid grid-cols-7 text-center">
                  {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
                    <span
                      key={`${day}-${index}`}
                      className="text-label uppercase text-text-muted"
                    >
                      {day}
                    </span>
                  ))}
                </div>
                {/* Static day discs — shimmering 35 circles reads as glitch. */}
                <div className="grid grid-cols-7 gap-y-1 place-items-center">
                  {Array.from({ length: MINI_MONTH_CELLS }).map((_, index) => (
                    <span
                      key={index}
                      className="size-6 rounded-full bg-sidebar"
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className="border-b border-border">
              <PlanningSectionHeader label="Tasks" />
              <div className="flex flex-col gap-2 px-1 pb-3">
                {Array.from({ length: SKELETON_TASK_ROWS }).map((_, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="size-4 shrink-0 rounded-full border border-border-strong" />
                    <Skeleton
                      height={14}
                      enableAnimation={false}
                      containerClassName="flex-1 leading-none"
                    />
                  </div>
                ))}
              </div>
            </section>

          </nav>
        </div>
      </div>
    </aside>
  );
}

function ToolbarSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex h-9 items-center rounded-[var(--radius-calendar-control)] border border-border bg-surface-raised px-3 text-product-body font-medium text-ink">
          Today
        </span>
        <div className="flex items-center gap-0.5 text-text-secondary">
          <span className="flex size-8 items-center justify-center">
            <ChevronLeft aria-hidden="true" className="size-4" />
          </span>
          <span className="flex size-8 items-center justify-center">
            <ChevronRight aria-hidden="true" className="size-4" />
          </span>
        </div>
        <Skeleton width={144} height={28} enableAnimation={false} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton
          width={112}
          height={36}
          borderRadius="var(--radius-calendar-control)"
          enableAnimation={false}
        />
        <span className="flex h-9 items-center gap-1.5 rounded-[var(--radius-calendar-control)] border border-border bg-surface-raised px-3 text-product-body font-medium text-text-secondary">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          Filter
        </span>
      </div>
    </div>
  );
}

function timedGhostStyle(color: CalendarColorValue): CSSProperties {
  const surface = calendarEventSurface(color)
  return {
    "--planevo-rbc-event-accent": surface.accent,
    "--planevo-rbc-event-text": `var(--color-${surface.text})`,
  } as CSSProperties
}

function TitleGhost({
  title,
  emptyClassName,
}: {
  title: string;
  emptyClassName: string;
}) {
  if (!title) {
    return <span aria-hidden="true" className={emptyClassName} />;
  }
  return <span className="calendar-skeleton-event__title">{title}</span>;
}

/** Timed block — mirrors live RBC event chrome with the user's color + title. */
function TimedEventGhost({
  item,
  columns,
}: {
  item: CalendarSkeletonTimedItem;
  columns: number;
}) {
  const showTime =
    item.heightPercent >= CALENDAR_SKELETON_TIME_LABEL_MIN_HEIGHT_PERCENT;
  return (
    <div
      className="calendar-skeleton-event absolute"
      style={{
        ...timedGhostStyle(item.color),
        left: `calc((100% / ${columns}) * ${item.column} + (100% / ${columns}) * ${item.left})`,
        width: `calc((100% / ${columns}) * ${item.width} - 0.25rem)`,
        top: `${item.topPercent}%`,
        height: `${item.heightPercent}%`,
      }}
    >
      {showTime ? (
        <span className="calendar-skeleton-event__time">
          {formatTimeLabel(item.startsAt)} - {formatTimeLabel(item.endsAt)}
        </span>
      ) : null}
      <TitleGhost
        title={item.title}
        emptyClassName="calendar-skeleton-event__title--empty"
      />
    </div>
  );
}

/** All-day chip — filled with the calendar color, real title ghost. */
function AllDayEventGhost({
  item,
}: {
  item: CalendarSkeletonAllDayItem;
}) {
  return (
    <div
      className="calendar-skeleton-allday self-center"
      style={{
        ...calendarColorStyle(item.color),
        gridColumn: `${item.columnStart + 2} / span ${item.columnSpan}`,
        gridRow: item.row + 1,
      }}
    >
      <TitleGhost
        title={item.title}
        emptyClassName="calendar-skeleton-event__title--empty"
      />
    </div>
  );
}

/** Month single-day chip — colored dot + time + title, same density as live. */
function MonthSingleGhost({
  item,
}: {
  item: CalendarSkeletonMonthSingleItem;
}) {
  return (
    <div
      className="calendar-skeleton-month-chip"
      style={calendarColorStyle(item.color)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "calendar-month-chip-dot",
          !isCustomCalendarColor(item.color) &&
            CALENDAR_COLOR_DOT_CLASS[item.color],
        )}
        style={
          isCustomCalendarColor(item.color)
            ? { backgroundColor: item.color }
            : undefined
        }
      />
      {!item.allDay ? (
        <span className="calendar-month-chip-time">
          {formatCompactMonthTime(item.startsAt)}
        </span>
      ) : null}
      {item.title ? (
        <span className="calendar-skeleton-month-chip__title">{item.title}</span>
      ) : (
        <span
          aria-hidden="true"
          className="calendar-skeleton-month-chip__title--empty"
        />
      )}
    </div>
  );
}

/** Multi-day month bar — solid calendar fill with title ghost. */
function MonthBarGhost({
  item,
}: {
  item: CalendarSkeletonMonthBarItem;
}) {
  return (
    <div
      className="calendar-skeleton-month-bar"
      style={{
        ...calendarColorStyle(item.color),
        gridColumn: `${item.columnStart + 1} / span ${item.columnSpan}`,
        gridRow: item.lane + 1,
      }}
    >
      <TitleGhost
        title={item.title}
        emptyClassName="calendar-skeleton-event__title--empty"
      />
    </div>
  );
}

export function CalendarGridSkeleton({
  view: viewProp,
  className,
  anchor: anchorProp,
  events = [],
}: {
  view?: CalendarSkeletonView;
  className?: string;
  /** Visible range anchor — same date the real grid uses. */
  anchor?: Date;
  /**
   * Known events for this range. Placeholders only render where these sit;
   * an empty list shows chrome with no invented event plots.
   */
  events?: ReadonlyArray<CalendarSkeletonEventGeometry>;
}) {
  const search =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
  const viewFromUrl = parseCalendarView(search?.get("view") ?? undefined);
  const view: CalendarSkeletonView =
    viewProp ??
    (viewFromUrl === "day" || viewFromUrl === "week" || viewFromUrl === "month"
      ? viewFromUrl
      : "week");
  const anchor =
    anchorProp ?? parseCalendarDate(search?.get("date") ?? undefined);
  const columns = calendarSkeletonColumnCount(view);
  const skeletonEvents = resolveCalendarSkeletonEvents({
    view,
    anchor,
    liveEvents: events,
  });
  const layout = planCalendarGridSkeletonLayout({
    view,
    anchor,
    events: skeletonEvents,
  });

  const monthSinglesByCell = useMemo(() => {
    const map = new Map<number, typeof layout.monthSingles>();
    for (const item of layout.monthSingles) {
      const list = map.get(item.cellIndex) ?? [];
      list.push(item);
      map.set(item.cellIndex, list);
    }
    return map;
  }, [layout.monthSingles]);

  const monthBarsByWeek = useMemo(() => {
    const map = new Map<number, typeof layout.monthBars>();
    for (const item of layout.monthBars) {
      const list = map.get(item.weekIndex) ?? [];
      list.push(item);
      map.set(item.weekIndex, list);
    }
    return map;
  }, [layout.monthBars]);

  const allDayRowCount = useMemo(
    () =>
      layout.allDay.reduce(
        (max, item) => Math.max(max, item.row + 1),
        0,
      ),
    [layout.allDay],
  );

  const monthDays = useMemo(() => monthGridDays(anchor), [anchor]);

  if (view === "month") {
    const monthCellCount = layout.monthRowCount * DAYS_PER_WEEK;
    return (
      <div
        aria-hidden="true"
        className={cn(
          "planevo-calendar-grid-shell flex min-h-0 flex-1 flex-col overflow-hidden bg-calendar-grid",
          className,
        )}
      >
        <div
          className="grid shrink-0 border-b border-border"
          style={{
            gridTemplateColumns: `repeat(${SKELETON_WEEK_COLUMNS}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: SKELETON_WEEK_COLUMNS }).map((_, index) => (
            <div
              key={index}
              className="flex h-10 items-center justify-center border-l border-border first:border-l-0"
            >
              <span className="calendar-skeleton-placeholder h-2.5 w-8 rounded-full bg-paper" />
            </div>
          ))}
        </div>
        <div
          className="calendar-month-body min-h-0 flex-1"
          style={{
            gridTemplateRows: `repeat(${layout.monthRowCount}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({ length: layout.monthRowCount }).map((_, weekIndex) => {
            const weekDays = monthDays.slice(
              weekIndex * DAYS_PER_WEEK,
              (weekIndex + 1) * DAYS_PER_WEEK,
            );
            const bars = monthBarsByWeek.get(weekIndex) ?? [];
            const barsPerColumn = weekDays.map((_, column) =>
              bars.filter(
                (segment) =>
                  column >= segment.columnStart &&
                  column < segment.columnStart + segment.columnSpan,
              ),
            );
            const dayItemCounts = weekDays.map((_, column) => {
              const cellIndex = weekIndex * DAYS_PER_WEEK + column;
              const singles = monthSinglesByCell.get(cellIndex) ?? [];
              return (barsPerColumn[column]?.length ?? 0) + singles.length;
            });
            const { visibleLaneCount } = planWeekLanes({
              laneCountForWeek: layout.laneCountByWeek[weekIndex] ?? 0,
              dayItemCounts,
              capacity: DEFAULT_MONTH_CAPACITY,
            });
            const visibleBars = bars.filter(
              (segment) => segment.lane < visibleLaneCount,
            );
            const roomForSingles = Math.max(
              DEFAULT_MONTH_CAPACITY - visibleLaneCount,
              0,
            );

            return (
            <div
              key={weekIndex}
              className="calendar-month-row calendar-month-week relative min-h-0"
            >
              {weekDays.map((_, column) => {
                const cellIndex = weekIndex * DAYS_PER_WEEK + column;
                const singles = monthSinglesByCell.get(cellIndex) ?? [];
                const hiddenBarCount =
                  barsPerColumn[column]?.filter(
                    (segment) => segment.lane >= visibleLaneCount,
                  ).length ?? 0;
                const fitsWithoutTrigger =
                  hiddenBarCount === 0 && singles.length <= roomForSingles;
                const visibleSingleCount = fitsWithoutTrigger
                  ? singles.length
                  : Math.max(roomForSingles - 1, 0);

                return (
                  <div
                    key={cellIndex}
                    className="calendar-month-cell flex min-h-0 flex-col gap-1.5"
                  >
                    <span className="ml-auto size-4 rounded-full border border-border bg-transparent" />
                    {Array.from({ length: visibleLaneCount }).map((__, lane) => (
                      <span
                        key={`lane-${lane}`}
                        aria-hidden="true"
                        className="calendar-month-lane-spacer"
                      />
                    ))}
                    {singles.slice(0, visibleSingleCount).map((item) => (
                      <MonthSingleGhost key={item.key} item={item} />
                    ))}
                  </div>
                );
              })}
              {visibleBars.length > 0 ? (
                <div className="calendar-month-bar-layer" aria-hidden="true">
                  {visibleBars.map((item) => (
                    <MonthBarGhost key={item.key} item={item} />
                  ))}
                </div>
              ) : null}
            </div>
            );
          })}
          {monthCellCount === 0 ? (
            <div className="min-h-0 flex-1 border-t border-border" />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "planevo-calendar-grid-shell flex min-h-0 flex-1 flex-col overflow-hidden bg-calendar-grid",
        className,
      )}
    >
      <div
        className="grid shrink-0 border-b border-border"
        style={{
          gridTemplateColumns: `var(--size-calendar-time-gutter) repeat(${columns}, minmax(0, 1fr))`,
        }}
      >
        <div />
        {Array.from({ length: columns }).map((_, index) => (
          <div
            key={index}
            className="flex h-[var(--size-calendar-day-header-row)] items-center justify-center border-l border-border"
          >
            <span className="calendar-skeleton-placeholder h-3 w-12 rounded-full bg-paper" />
          </div>
        ))}
      </div>
      {layout.allDay.length > 0 ? (
        <div
          className="relative grid shrink-0 border-b border-border"
          style={{
            gridTemplateColumns: `var(--size-calendar-time-gutter) repeat(${columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${allDayRowCount}, minmax(var(--size-calendar-allday-band), auto))`,
          }}
        >
          <div />
          {layout.allDay.map((item) => (
            <AllDayEventGhost key={item.key} item={item} />
          ))}
        </div>
      ) : null}
      <div
        className="relative min-h-0 flex-1"
        style={{
          display: "grid",
          gridTemplateColumns: `var(--size-calendar-time-gutter) repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${VISIBLE_HOURS}, minmax(var(--size-calendar-day-header-row), 1fr))`,
        }}
      >
        {Array.from({ length: VISIBLE_HOURS }).flatMap((_, row) => [
          <div
            key={`time-${row}`}
            className="flex items-start justify-end border-t border-border pr-2 pt-1"
          >
            <span className="calendar-skeleton-placeholder h-2 w-7 rounded-full bg-paper" />
          </div>,
          ...Array.from({ length: columns }).map((__, column) => (
            <div
              key={`cell-${row}-${column}`}
              className="min-h-0 border-l border-t border-border"
            />
          )),
        ])}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            left: "var(--size-calendar-time-gutter)",
          }}
        >
          {layout.timed.map((item) => (
            <TimedEventGhost key={item.key} item={item} columns={columns} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function EmbeddedCalendarSkeleton({
  view = "month",
  height = "standard",
  anchor,
}: {
  view?: "day" | "week" | "month";
  height?: "compact" | "standard" | "tall";
  anchor?: Date;
}) {
  return (
    <div
      role="status"
      aria-label="Loading calendar"
      className="calendar-embed"
      data-height={height}
    >
      <div className="calendar-embed-header">
        <div className="flex flex-col gap-2">
          <span className="calendar-skeleton-placeholder h-3 w-28 rounded-full bg-sidebar" />
          <span className="calendar-skeleton-placeholder h-2.5 w-20 rounded-full bg-sidebar" />
        </div>
        <div className="flex items-center gap-2">
          <span className="calendar-skeleton-placeholder h-7 w-16 rounded-md bg-sidebar" />
          <span className="calendar-skeleton-placeholder h-7 w-24 rounded-md bg-sidebar" />
        </div>
      </div>
      <div className="calendar-embed-surface flex min-h-0">
        <CalendarGridSkeleton view={view} anchor={anchor} />
      </div>
    </div>
  );
}

/**
 * Route-level Calendar loading chrome.
 *
 * Prefs restore in useLayoutEffect (before paint) using the same defaults as
 * CalendarProductView. The Agenda aside stays mounted with width 0 when
 * collapsed — never conditionally unmounted — so soft-nav handoff does not
 * shove the main column.
 */
export function CalendarProductSkeleton() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    DEFAULT_PLANNING_COLLAPSED,
  );
  const [planningWidth, setPlanningWidth] = useState(DEFAULT_PLANNING_WIDTH);
  const [prefsRestored, setPrefsRestored] = useState(false);

  useLayoutEffect(() => {
    setSidebarCollapsed(getPlanningCollapsed());
    setPlanningWidth(getPlanningWidth());
    setPrefsRestored(true);
  }, []);

  return (
    <ProductSkeletonTheme>
      <section
        aria-labelledby="calendar-product-title"
        aria-busy="true"
        className="flex h-full w-full flex-col bg-calendar-chrome"
      >
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          <PlanningRailSkeleton
            collapsed={sidebarCollapsed}
            width={planningWidth}
            prefsRestored={prefsRestored}
          />

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-calendar-chrome">
            <div className="shrink-0 pl-6 pr-6 pt-5 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {sidebarCollapsed ? (
                    <span
                      aria-hidden="true"
                      className="hidden size-8 shrink-0 items-center justify-center rounded-lg text-text-muted lg:flex"
                    >
                      <PanelLeft className="size-4" />
                    </span>
                  ) : null}
                  <h1
                    id="calendar-product-title"
                    className="text-h2 font-medium tracking-tight text-ink"
                  >
                    Calendar
                  </h1>
                </div>
                <div
                  aria-hidden="true"
                  className="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-product-body font-medium text-ink lg:hidden"
                >
                  Agenda
                </div>
              </div>
              <div className="mt-4">
                <ToolbarSkeleton />
              </div>
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden pt-2">
              <CalendarGridSkeleton />
            </div>
          </div>
        </div>
      </section>
    </ProductSkeletonTheme>
  );
}
