"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { weekParam, weekRange } from "@planevo/core/state/calendar-state";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/planevo-icon";
import type { CalendarScope } from "@/lib/calendar/scope-prefs";

export const CALENDAR_VIEWS = ["day", "week"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

const VIEW_LABELS: Record<CalendarView, string> = {
  day: "Day",
  week: "Week",
};

const SCOPE_OPTIONS = [
  { value: "all", label: "All calendars" },
  { value: "workspace", label: "This workspace" },
] as const satisfies ReadonlyArray<{ value: CalendarScope; label: string }>;

type CalendarToolbarProps = {
  anchor: Date;
  view: CalendarView;
  scope: CalendarScope;
  onViewChange: (view: CalendarView) => void;
  onScopeChange: (scope: CalendarScope) => void;
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
  onNavigateToday: () => void;
};

function toolbarLabel(anchor: Date, view: CalendarView): string {
  const { start } = weekRange(anchor);
  const labelDate = view === "day" ? anchor : start;
  const monthYear = labelDate.toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
  const week = weekParam(anchor).split("-")[1];
  return `${monthYear} / ${week}`;
}

export function CalendarToolbar({
  anchor,
  view,
  scope,
  onViewChange,
  onScopeChange,
  onNavigatePrevious,
  onNavigateNext,
  onNavigateToday,
}: CalendarToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);

  return (
    <div
      role="toolbar"
      aria-label="Calendar controls"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <h2 className="text-h3 tabular-nums">{toolbarLabel(anchor, view)}</h2>

      <div className="flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="Calendar view"
          className="flex rounded-lg border border-border bg-surface-raised p-0.5"
        >
          {CALENDAR_VIEWS.map((option) => {
            const isSelected = view === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onViewChange(option)}
                className={`rounded-md px-3 py-1.5 text-product-body font-medium outline-none transition-colors focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none ${
                  isSelected
                    ? "border border-border bg-paper text-ink"
                    : "border border-transparent text-text-secondary hover:text-ink"
                }`}
              >
                {VIEW_LABELS[option]}
              </button>
            );
          })}
        </div>

        <div className="relative">
          <button
            type="button"
            aria-expanded={filterOpen}
            aria-controls="calendar-scope-filter"
            onClick={() => setFilterOpen((open) => !open)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 py-2 text-product-body font-medium text-text-secondary outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <SlidersHorizontal aria-hidden="true" className="size-4" />
            Filter
            <Icon name="chevron-down" className="size-3.5" />
          </button>
          {filterOpen ? (
            <>
              <button
                type="button"
                aria-label="Close filter menu"
                tabIndex={-1}
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setFilterOpen(false)}
              />
              <div
                id="calendar-scope-filter"
                onKeyDown={(event) => {
                  if (event.key !== "Escape") return;
                  event.preventDefault();
                  setFilterOpen(false);
                }}
                className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-border bg-paper p-1"
              >
                <fieldset>
                  <legend className="sr-only">Calendar scope</legend>
                  {SCOPE_OPTIONS.map((option) => {
                    const isSelected = scope === option.value;
                    return (
                      <label key={option.value} className="block cursor-pointer">
                        <input
                          type="radio"
                          name="calendar-scope"
                          value={option.value}
                          checked={isSelected}
                          onChange={() => {
                            setFilterOpen(false);
                            onScopeChange(option.value);
                          }}
                          className="peer sr-only"
                        />
                        <span className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-product-body text-ink outline-none hover:bg-surface-raised peer-focus-visible:outline peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink">
                          {option.label}
                          {isSelected ? (
                            <Icon
                              name="check"
                              className="size-4 text-text-secondary"
                            />
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </fieldset>
              </div>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={view === "day" ? "Previous day" : "Previous week"}
            onClick={onNavigatePrevious}
            className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface-raised text-text-secondary outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            aria-label={view === "day" ? "Next day" : "Next week"}
            onClick={onNavigateNext}
            className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface-raised text-text-secondary outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>

        {/* The view's single marigold element. */}
        <Button type="button" onClick={onNavigateToday}>
          Today
        </Button>

        <Button type="button" variant="outline" disabled title="Sharing comes later">
          Share
        </Button>
      </div>
    </div>
  );
}
