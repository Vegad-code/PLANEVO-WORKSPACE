import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { notFound } from "next/navigation"
import type { CalendarContext } from "@planevo/core/types/calendar"
import { CalendarProductView } from "./calendar-product-view"
import {
  calendarMetaQueryKey,
  calendarRangeQueryKey,
  calendarTodayQueryKey,
} from "@/lib/calendar/calendar-query-keys"
import { dateParam } from "@/lib/calendar/calendar-range"
import { getQueryClient } from "@/lib/calendar/get-query-client"
import { loadCalendarPageData } from "@/lib/queries/product-calendar"
import type { CalendarScope } from "@/lib/calendar/scope-prefs"

export async function CalendarProductPage({
  scope,
  context,
  date,
  view,
  week,
}: {
  scope: CalendarScope
  context: CalendarContext
  date?: string
  view?: string
  week?: string
}) {
  let data = await loadCalendarPageData(scope, {
    date,
    view,
    week,
    context,
  })
  if (
    data.status === "ready" &&
    data.scope === "workspace" &&
    data.workspaceId === null
  ) {
    data = await loadCalendarPageData("all", {
      date,
      view,
      week,
      context,
    })
  }

  if (data.status === "unauthenticated") {
    return (
      <section className="mx-auto w-full max-w-3xl px-6 py-12">
        <p className="text-label uppercase text-text-muted">Calendar</p>
        <h1 className="mt-2 text-h1">Sign in to see your calendar</h1>
        <p className="mt-2 text-body text-text-secondary">
          Your calendars, events, and Agenda will be ready here after you sign
          in.
        </p>
      </section>
    )
  }

  if (
    context.kind === "calendar" &&
    !data.calendars.some(({ id }) => id === context.calendarId)
  ) {
    notFound()
  }

  const queryClient = getQueryClient()
  queryClient.setQueryData(
    calendarRangeQueryKey(
      data.scope,
      context,
      data.initialView,
      data.anchorDate,
    ),
    {
      context,
      scope: data.scope,
      anchorDate: dateParam(data.anchorDate),
      view: data.initialView,
      workspaceId: data.workspaceId,
      events: data.events,
      taskDues: data.taskDues,
    },
  )
  queryClient.setQueryData(calendarMetaQueryKey(data.scope, context), {
    context,
    scope: data.scope,
    workspaceId: data.workspaceId,
    calendars: data.calendars,
  })
  queryClient.setQueryData(calendarTodayQueryKey(data.scope, context), {
    context,
    scope: data.scope,
    todayTasks: data.todayTasks,
  })

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CalendarProductView
        initialScope={data.scope}
        workspaceId={data.workspaceId}
        context={context}
      />
    </HydrationBoundary>
  )
}
