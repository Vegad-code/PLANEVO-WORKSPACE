"use client"

import { useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react"
import { formatToolbarTitle } from "@/lib/calendar/calendar-navigation"
import type { CalendarNavMotion } from "@/lib/calendar/calendar-nav-motion"
import { calendarTitleTransition } from "@/lib/calendar/calendar-nav-motion"
import { Icon } from "@/components/ui/planevo-icon"
import type { CalendarScope } from "@/lib/calendar/scope-prefs"
import { CalendarViewMenu } from "./calendar-view-menu"

export const CALENDAR_VIEWS = ["day", "week", "month", "year"] as const
export type CalendarView = (typeof CALENDAR_VIEWS)[number]

export const VIEW_LABELS: Record<CalendarView, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  year: "Year",
}

const SCOPE_OPTIONS = [
  { value: "all", label: "All calendars" },
  { value: "workspace", label: "This workspace" },
] as const satisfies ReadonlyArray<{ value: CalendarScope; label: string }>

type CalendarToolbarProps = {
  anchor: Date
  view: CalendarView
  scope: CalendarScope
  navMotion: CalendarNavMotion
  prefersReducedMotion: boolean
  onViewChange: (view: CalendarView) => void
  onScopeChange: (scope: CalendarScope) => void
  onNavigatePrevious: () => void
  onNavigateNext: () => void
  onNavigateToday: () => void
}

export function CalendarToolbar({
  anchor,
  view,
  scope,
  navMotion,
  prefersReducedMotion,
  onViewChange,
  onScopeChange,
  onNavigatePrevious,
  onNavigateNext,
  onNavigateToday,
}: CalendarToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false)
  const title = useMemo(() => formatToolbarTitle(anchor, view), [anchor, view])
  const titleTransition = calendarTitleTransition(prefersReducedMotion)
  const titleOffset =
    navMotion.intent === "step" && navMotion.direction !== 0 ? 10 : 6

  return (
    <div
      role="toolbar"
      aria-label="Calendar controls"
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onNavigateToday}
          className="rounded-[var(--radius-calendar-control)] border border-border bg-surface-raised px-3 py-1.5 text-product-body font-medium text-ink outline-none hover:bg-paper focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Today
        </button>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label={
              view === "day"
                ? "Previous day"
                : view === "month"
                  ? "Previous month"
                  : view === "year"
                    ? "Previous year"
                    : "Previous week"
            }
            onClick={onNavigatePrevious}
            className="flex size-8 items-center justify-center rounded-full text-text-secondary outline-none transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            aria-label={
              view === "day"
                ? "Next day"
                : view === "month"
                  ? "Next month"
                  : view === "year"
                    ? "Next year"
                    : "Next week"
            }
            onClick={onNavigateNext}
            className="flex size-8 items-center justify-center rounded-full text-text-secondary outline-none transition-colors hover:bg-surface-raised hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink motion-reduce:transition-none"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </div>
        <div className="relative min-w-[10ch] overflow-hidden">
          <AnimatePresence
            mode="wait"
            initial={false}
            custom={navMotion.direction}
          >
            <motion.h2
              key={title}
              custom={navMotion.direction}
              initial={
                prefersReducedMotion
                  ? false
                  : {
                      opacity: 0,
                      y:
                        navMotion.intent === "step"
                          ? navMotion.direction > 0
                            ? titleOffset
                            : navMotion.direction < 0
                              ? -titleOffset
                              : 0
                          : titleOffset,
                    }
              }
              animate={{ opacity: 1, y: 0 }}
              exit={
                prefersReducedMotion
                  ? undefined
                  : {
                      opacity: 0,
                      y:
                        navMotion.intent === "step"
                          ? navMotion.direction > 0
                            ? -titleOffset
                            : navMotion.direction < 0
                              ? titleOffset
                              : 0
                          : -titleOffset,
                    }
              }
              transition={titleTransition}
              className="text-h3 font-medium tracking-tight tabular-nums text-ink"
            >
              {title}
            </motion.h2>
          </AnimatePresence>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <CalendarViewMenu view={view} onViewChange={onViewChange} />

        <div className="relative">
          <button
            type="button"
            aria-expanded={filterOpen}
            aria-controls="calendar-scope-filter"
            onClick={() => setFilterOpen((open) => !open)}
            className="flex items-center gap-1.5 rounded-[var(--radius-calendar-control)] border border-border bg-surface-raised px-3 py-2 text-product-body font-medium text-text-secondary outline-none hover:text-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
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
                  if (event.key !== "Escape") return
                  event.preventDefault()
                  setFilterOpen(false)
                }}
                className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-border bg-paper p-1"
              >
                <fieldset>
                  <legend className="sr-only">Calendar scope</legend>
                  {SCOPE_OPTIONS.map((option) => {
                    const isSelected = scope === option.value
                    return (
                      <label
                        key={option.value}
                        className="block cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="calendar-scope"
                          value={option.value}
                          checked={isSelected}
                          onChange={() => {
                            setFilterOpen(false)
                            onScopeChange(option.value)
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
                    )
                  })}
                </fieldset>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
