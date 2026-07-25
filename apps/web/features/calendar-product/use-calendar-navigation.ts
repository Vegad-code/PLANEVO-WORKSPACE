"use client"

import {
  calendarNavIdleMotion,
  type CalendarNavMotion,
} from "@/lib/calendar/calendar-nav-motion"
import {
  goToToday,
  stepAnchor,
  switchView,
  type CalendarToolbarView,
} from "@/lib/calendar/calendar-navigation"
import { dateParam, parseCalendarDate } from "@/lib/calendar/calendar-range"
import {
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs"
import { useCallback, useMemo, useState } from "react"
import type { CalendarScope } from "@/lib/calendar/scope-prefs"
import type { CalendarView } from "./calendar-toolbar"

const viewParser = parseAsStringLiteral([
  "day",
  "week",
  "month",
  "year",
]).withDefault("week")

function anchorDirection(from: Date, to: Date): -1 | 0 | 1 {
  const fromTime = from.getTime()
  const toTime = to.getTime()
  if (fromTime === toTime) return 0
  return toTime > fromTime ? 1 : -1
}

export function useCalendarNavigation(initialScope: CalendarScope) {
  const [navMotion, setNavMotion] = useState<CalendarNavMotion>(
    calendarNavIdleMotion,
  )
  const [params, setParams] = useQueryStates(
    {
      date: parseAsString,
      view: viewParser,
      scope: parseAsString,
    },
    {
      history: "replace",
      shallow: true,
    },
  )

  const anchorDate = useMemo(
    () => (params.date ? parseCalendarDate(params.date) : goToToday()),
    [params.date],
  )

  const view = params.view as CalendarView

  const scope: CalendarScope = useMemo(() => {
    if (params.scope === "workspace") return "workspace"
    if (params.scope === "all") return "all"
    return initialScope
  }, [initialScope, params.scope])

  const navigateTo = useCallback(
    (date: Date, nextView: CalendarToolbarView) => {
      void setParams({
        date: dateParam(date),
        view: nextView,
      })
    },
    [setParams],
  )

  const setScope = useCallback(
    (nextScope: CalendarScope) => {
      void setParams({
        scope: nextScope === "workspace" ? "workspace" : null,
      })
    },
    [setParams],
  )

  const handleNavigatePrevious = useCallback(() => {
    setNavMotion({ intent: "step", direction: -1 })
    navigateTo(stepAnchor(view, anchorDate, -1), view)
  }, [anchorDate, navigateTo, view])

  const handleNavigateNext = useCallback(() => {
    setNavMotion({ intent: "step", direction: 1 })
    navigateTo(stepAnchor(view, anchorDate, 1), view)
  }, [anchorDate, navigateTo, view])

  const handleNavigateToday = useCallback(
    (now: Date = new Date()) => {
      const today = goToToday(now)
      setNavMotion({
        intent: "jump",
        direction: anchorDirection(anchorDate, today),
      })
      navigateTo(today, view)
    },
    [anchorDate, navigateTo, view],
  )

  const handleViewChange = useCallback(
    (nextView: CalendarView) => {
      setNavMotion({ intent: "view", direction: 0 })
      navigateTo(switchView(view, anchorDate, nextView), nextView)
    },
    [anchorDate, navigateTo, view],
  )

  const handleSelectDay = useCallback(
    (day: Date) => {
      const normalized = new Date(day)
      normalized.setHours(0, 0, 0, 0)
      setNavMotion({ intent: "view", direction: 0 })
      navigateTo(normalized, "day")
    },
    [navigateTo],
  )

  return {
    anchorDate,
    view,
    scope,
    navMotion,
    setScope,
    handleNavigatePrevious,
    handleNavigateNext,
    handleNavigateToday,
    handleViewChange,
    handleSelectDay,
  }
}
