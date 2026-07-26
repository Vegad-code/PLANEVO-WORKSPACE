"use client"

import { useCallback, useEffect, useState } from "react"
import type { CalendarViewRow } from "@planevo/core/types/calendar"
import { CalendarGridEngine } from "@/features/calendar-product/calendar-grid-engine"
import { YearView } from "@/features/calendar-product/year-view"
import { parseCalendarDate } from "@/lib/calendar/calendar-range"
import type { CalendarQueryPayload } from "@/lib/calendar/fetch-calendar-page-data"
import {
  filterCalendarViewContent,
  toolbarViewForSavedConfig,
} from "@/lib/calendar/view-crud"
import { resolveViewConfig } from "@/lib/calendar/view-config"

type EmbeddedCalendarPayload = {
  view: CalendarViewRow
  data: CalendarQueryPayload
}

type EmbeddedCalendarState =
  | { status: "loading"; viewId: string }
  | { status: "ready"; viewId: string; payload: EmbeddedCalendarPayload }
  | { status: "missing"; viewId: string }
  | { status: "error"; viewId: string; message: string }

export type EmbeddedCalendarViewProps = {
  viewId: string
  height?: string
}

/**
 * Workspace calendar block. It owns fetching and empty/error states only; the
 * calendar itself stays on CalendarGridEngine/YearView, exactly like the
 * product route, so saved-view edits cannot fork into a second renderer.
 */
export function EmbeddedCalendarView({
  viewId,
  height = "standard",
}: EmbeddedCalendarViewProps) {
  const [state, setState] = useState<EmbeddedCalendarState>({
    status: "loading",
    viewId,
  })
  const [now, setNow] = useState(() => new Date())
  const normalizedHeight =
    height === "compact" || height === "tall" ? height : "standard"

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!viewId) {
      if (signal?.aborted) return
      setState({ status: "missing", viewId })
      return
    }

    try {
      const params = new URLSearchParams({ viewId })
      const response = await fetch(
        `/api/embedded-calendar?${params.toString()}`,
        { cache: "no-store", signal },
      )
      if (signal?.aborted) return
      if (response.status === 404) {
        setState({ status: "missing", viewId })
        return
      }
      if (!response.ok) {
        throw new Error("Unable to load this calendar view.")
      }

      const payload = (await response.json()) as EmbeddedCalendarPayload
      if (signal?.aborted) return
      setState({ status: "ready", viewId, payload })
    } catch (cause) {
      if (signal?.aborted) return
      setState({
        status: "error",
        viewId,
        message:
          cause instanceof Error
            ? cause.message
            : "Unable to load this calendar view.",
      })
    }
  }, [viewId])

  useEffect(() => {
    let controller = new AbortController()
    const handleRefresh = () => {
      controller.abort()
      controller = new AbortController()
      void load(controller.signal)
    }
    handleRefresh()

    // A view edited in another tab is fresh as soon as the workspace regains
    // focus; same-page integrations can dispatch the explicit event.
    window.addEventListener("focus", handleRefresh)
    window.addEventListener("planevo:calendar-view-updated", handleRefresh)
    return () => {
      controller.abort()
      window.removeEventListener("focus", handleRefresh)
      window.removeEventListener("planevo:calendar-view-updated", handleRefresh)
    }
  }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const currentState: EmbeddedCalendarState =
    state.viewId === viewId ? state : { status: "loading", viewId }
  const prepared = (() => {
    if (currentState.status !== "ready") return null
    const { payload } = currentState
    const config = resolveViewConfig(payload.view.preset, payload.view.config)
    const content = filterCalendarViewContent({
      events: payload.data.events,
      taskDues: payload.data.taskDues,
      view: payload.view,
    })
    return {
      payload,
      config,
      content,
      view: toolbarViewForSavedConfig(config),
      anchor: parseCalendarDate(payload.data.anchorDate),
    }
  })()

  if (currentState.status === "loading") {
    return (
      <div
        className="calendar-embed calendar-embed--placeholder"
        data-height={normalizedHeight}
        role="status"
      >
        Loading calendar…
      </div>
    )
  }

  if (currentState.status === "missing") {
    return (
      <div
        className="calendar-embed calendar-embed--placeholder"
        data-height={normalizedHeight}
      >
        <p className="text-product-body font-medium text-ink">
          Calendar view unavailable
        </p>
        <p className="mt-1 text-product-meta text-text-muted">
          Choose another saved view or remove this block.
        </p>
      </div>
    )
  }

  if (currentState.status === "error" || !prepared) {
    return (
      <div
        className="calendar-embed calendar-embed--placeholder"
        data-height={normalizedHeight}
        role="alert"
      >
        {currentState.status === "error"
          ? currentState.message
          : "Unable to load this calendar view."}
      </div>
    )
  }

  const { payload, config, content, view, anchor } = prepared

  return (
    <section
      className="calendar-embed"
      data-height={normalizedHeight}
      data-calendar-embed={viewId}
      aria-label={`${payload.view.name} calendar view`}
    >
      <header className="calendar-embed-header">
        <div className="min-w-0">
          <p className="truncate text-product-body font-semibold text-ink">
            {payload.view.name}
          </p>
          <p className="text-product-meta capitalize text-text-muted">
            {payload.view.preset} view
          </p>
        </div>
        <a
          href="/calendar"
          className="shrink-0 text-product-meta text-text-secondary hover:text-ink"
        >
          Open calendar
        </a>
      </header>

      <div className="calendar-embed-surface">
        {view === "year" ? (
          <YearView year={anchor.getFullYear()} today={now} onSelectDay={() => {}} />
        ) : (
          <CalendarGridEngine
            view={view}
            viewConfig={config}
            anchor={anchor}
            calendars={payload.data.calendars}
            events={content.events}
            taskDues={content.taskDues}
            now={now}
            onSlotSelect={() => {}}
            onEventSelect={() => {}}
            onEventTimesChange={() => {}}
            onToggleTask={() => {}}
            onOpenDay={() => {}}
            onNavigateMonth={() => {}}
          />
        )}
      </div>
    </section>
  )
}
