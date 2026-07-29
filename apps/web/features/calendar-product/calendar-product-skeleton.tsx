"use client";

import { useLayoutEffect, useState } from "react";
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
import { cn } from "@/lib/utils";

const MINI_MONTH_CELLS = 35;
const SKELETON_TASK_ROWS = 4;
const SKELETON_TIME_ROWS = 8;
const SKELETON_MONTH_ROWS = 6;
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

function GridPlaceholder({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "calendar-skeleton-placeholder block rounded-[var(--radius-calendar-event)] bg-paper",
        compact ? "h-2.5 w-1/2" : "h-10 w-4/5 border-l-2 border-border-strong",
      )}
    />
  );
}

export function CalendarGridSkeleton({
  view = "week",
  className,
}: {
  view?: "day" | "week" | "month";
  className?: string;
}) {
  const columns = view === "day" ? 1 : SKELETON_WEEK_COLUMNS;

  if (view === "month") {
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
          className="grid min-h-0 flex-1"
          style={{
            gridTemplateColumns: `repeat(${SKELETON_WEEK_COLUMNS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${SKELETON_MONTH_ROWS}, minmax(0, 1fr))`,
          }}
        >
          {Array.from({
            length: SKELETON_MONTH_ROWS * SKELETON_WEEK_COLUMNS,
          }).map((_, index) => (
            <div
              key={index}
              className="flex min-h-0 flex-col gap-2 border-l border-t border-border p-2 first:border-l-0"
            >
              <span className="calendar-skeleton-placeholder ml-auto size-4 rounded-full bg-paper" />
              {index % 5 === 1 || index % 11 === 4 ? (
                <GridPlaceholder compact />
              ) : null}
            </div>
          ))}
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
      <div
        className="grid min-h-0 flex-1"
        style={{
          gridTemplateColumns: `var(--size-calendar-time-gutter) repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${SKELETON_TIME_ROWS}, minmax(var(--size-calendar-day-header-row), 1fr))`,
        }}
      >
        {Array.from({ length: SKELETON_TIME_ROWS }).flatMap((_, row) => [
          <div
            key={`time-${row}`}
            className="flex items-start justify-end border-t border-border pr-2 pt-1"
          >
            <span className="calendar-skeleton-placeholder h-2 w-7 rounded-full bg-paper" />
          </div>,
          ...Array.from({ length: columns }).map((__, column) => {
            const showEvent =
              (row === 1 && column === Math.min(1, columns - 1)) ||
              (row === 3 && column === Math.min(4, columns - 1)) ||
              (row === 5 && column === 0);
            return (
              <div
                key={`cell-${row}-${column}`}
                className="min-h-0 border-l border-t border-border p-1.5"
              >
                {showEvent ? <GridPlaceholder /> : null}
              </div>
            );
          }),
        ])}
      </div>
    </div>
  );
}

export function EmbeddedCalendarSkeleton({
  view = "month",
  height = "standard",
}: {
  view?: "day" | "week" | "month";
  height?: "compact" | "standard" | "tall";
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
        <CalendarGridSkeleton view={view} />
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
