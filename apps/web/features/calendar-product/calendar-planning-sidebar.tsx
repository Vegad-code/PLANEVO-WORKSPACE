"use client";

import { useEffect, useState } from "react";
import { PanelLeft } from "lucide-react";
import type {
  CalendarEventRow,
  CalendarRow,
} from "@planevo/core/types/calendar";
import {
  getCollapsedPlanningSections,
  setCollapsedPlanningSections,
  togglePlanningSection,
  type PlanningSectionId,
} from "@/lib/calendar/planning-collapse";
import { cn } from "@/lib/utils";
import { CalendarDateSection } from "./calendar-date-section";
import { CalendarPlanningSection } from "./calendar-planning-section";
import {
  CalendarTasksSection,
  countOpenPlanningTasks,
} from "./calendar-tasks-section";
import type { TodayColumnTask } from "./today-task-row";
import { useCalendarDay } from "./calendar-now-context";

export type CalendarPlanningSidebarProps = {
  calendars: CalendarRow[];
  events: CalendarEventRow[];
  todayTasks: TodayColumnTask[];
  now?: Date;
  weekStart: Date;
  onSelectDay: (day: Date) => void;
  onToggleTask: (taskId: string, done: boolean) => void;
  onQuickAddTask: (title: string, bucket: "week" | "month" | "none") => void;
  onCollapse: () => void;
  isLoadingTasks?: boolean;
  /** Extra left inset on the title row when the app nav hamburger is visible. */
  clearRevealChrome?: boolean;
  /** Hide the collapse control in the mobile drawer (drawer has its own close). */
  hideCollapseControl?: boolean;
};

/**
 * Calendar Agenda rail. Calendar switching and management deliberately live in
 * the toolbar selector so the task rail stays focused on planning.
 */
export function CalendarPlanningSidebar({
  calendars,
  events,
  todayTasks,
  now,
  weekStart,
  onSelectDay,
  onToggleTask,
  onQuickAddTask,
  onCollapse,
  isLoadingTasks = false,
  clearRevealChrome = false,
  hideCollapseControl = false,
}: CalendarPlanningSidebarProps) {
  const clockDay = useCalendarDay();
  const resolvedNow = now ?? clockDay;
  const [collapsedSections, setCollapsedSections] = useState<
    Set<PlanningSectionId>
  >(() => new Set());
  const [collapseRestored, setCollapseRestored] = useState(false);

  useEffect(() => {
    setCollapsedSections(getCollapsedPlanningSections());
    setCollapseRestored(true);
  }, []);

  useEffect(() => {
    if (!collapseRestored) return;
    setCollapsedPlanningSections(collapsedSections);
  }, [collapsedSections, collapseRestored]);

  function handleToggleSection(sectionId: PlanningSectionId) {
    setCollapsedSections((current) =>
      togglePlanningSection(current, sectionId),
    );
  }

  const openTaskCount = countOpenPlanningTasks(todayTasks, resolvedNow);

  return (
    <div className="flex h-full w-full flex-col gap-3 px-4 pt-4 pb-4 pr-3">
      <div
        className={cn(
          "flex min-h-8 items-center justify-between gap-2",
          // Clear fixed nav hamburger (top-3 left-3 size-8) with ~8px air after it.
          // Container already has px-4; add the rest of the safe inset + gap.
          clearRevealChrome &&
            "md:pl-[calc(var(--sidebar-reveal-safe-inset)-0.5rem)]",
        )}
      >
        <h2 className="text-h3 font-semibold text-ink">Agenda</h2>
        {!hideCollapseControl ? (
          <button
            type="button"
            aria-label="Collapse agenda"
            onClick={onCollapse}
            className="flex size-7 items-center justify-center rounded-lg text-text-muted outline-none hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <PanelLeft aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>

      <nav
        aria-label="Agenda"
        className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1"
      >
        <CalendarPlanningSection
          id="planning-date"
          label="Date"
          open={!collapsedSections.has("date")}
          onToggle={() => handleToggleSection("date")}
        >
          <CalendarDateSection
            now={resolvedNow}
            weekStart={weekStart}
            onSelectDay={onSelectDay}
          />
        </CalendarPlanningSection>

        <CalendarPlanningSection
          id="planning-tasks"
          label="Tasks"
          open={!collapsedSections.has("tasks")}
          onToggle={() => handleToggleSection("tasks")}
          count={isLoadingTasks ? undefined : openTaskCount}
        >
          {isLoadingTasks ? (
            <div
              aria-label="Loading Agenda tasks"
              className="flex flex-col gap-3 py-1"
            >
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="size-4 shrink-0 rounded-full border border-border-strong" />
                  <span
                    className={cn(
                      "calendar-skeleton-placeholder h-3 rounded-full bg-sidebar",
                      index % 2 === 0 ? "w-3/4" : "w-1/2",
                    )}
                  />
                </div>
              ))}
            </div>
          ) : (
            <CalendarTasksSection
              tasks={todayTasks}
              events={events}
              calendars={calendars}
              now={resolvedNow}
              onToggleTask={onToggleTask}
              onQuickAddTask={onQuickAddTask}
            />
          )}
        </CalendarPlanningSection>

      </nav>
    </div>
  );
}
