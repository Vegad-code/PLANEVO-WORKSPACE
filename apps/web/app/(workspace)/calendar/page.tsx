import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import { CalendarProductView } from "@/features/calendar-product/calendar-product-view"
import { calendarQueryKey } from "@/lib/calendar/calendar-query-keys"
import { getQueryClient } from "@/lib/calendar/get-query-client"
import { serializeCalendarQueryData } from "@/lib/calendar/fetch-calendar-page-data"
import { loadCalendarPageData } from "@/lib/queries/product-calendar"
import type { CalendarScope } from "@/lib/calendar/scope-prefs"

function requestedScope(value: string | undefined): CalendarScope {
  return value === "workspace" ? "workspace" : "all"
}

async function CalendarProductPage({
  scope,
  date,
  view,
  week,
}: {
  scope: CalendarScope
  date?: string
  view?: string
  week?: string
}) {
  let data = await loadCalendarPageData(scope, { date, view, week })
  if (
    data.status === "ready" &&
    data.scope === "workspace" &&
    data.workspaceId === null
  ) {
    data = await loadCalendarPageData("all", { date, view, week })
  }

  if (data.status === "unauthenticated") {
    return (
      <section className="mx-auto w-full max-w-3xl px-6 py-12">
        <p className="text-label uppercase text-text-muted">Calendar</p>
        <h1 className="mt-2 text-h1">Sign in to see your calendar</h1>
        <p className="mt-2 text-body text-text-secondary">
          Your week, your calendars, and your scheduled tasks will be ready here
          after you sign in.
        </p>
      </section>
    )
  }

  const queryClient = getQueryClient()
  const serialized = serializeCalendarQueryData({
    scope: data.scope,
    anchorDate: data.anchorDate,
    view: data.initialView,
    workspaceId: data.workspaceId,
    calendars: data.calendars,
    views: data.views,
    events: data.events,
    taskDues: data.taskDues,
    todayTasks: data.todayTasks,
  })

  queryClient.setQueryData(
    calendarQueryKey(data.scope, data.initialView, data.anchorDate),
    serialized,
  )

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CalendarProductView
        initialScope={data.scope}
        workspaceId={data.workspaceId}
      />
    </HydrationBoundary>
  )
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    scope?: string
    date?: string
    view?: string
    week?: string
  }>
}) {
  const { scope, date, view, week } = await searchParams
  return (
    <CalendarProductPage
      scope={requestedScope(scope)}
      date={date}
      view={view}
      week={week}
    />
  )
}
