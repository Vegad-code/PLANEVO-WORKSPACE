import { CalendarProductPage } from "@/features/calendar-product/calendar-product-page"
import type { CalendarScope } from "@/lib/calendar/scope-prefs"

function requestedScope(value: string | undefined): CalendarScope {
  return value === "workspace" ? "workspace" : "all"
}

export default async function IsolatedCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ calendarId: string }>
  searchParams: Promise<{
    scope?: string
    date?: string
    view?: string
    week?: string
  }>
}) {
  const [{ calendarId }, query] = await Promise.all([params, searchParams])
  return (
    <CalendarProductPage
      scope={requestedScope(query.scope)}
      context={{ kind: "calendar", calendarId }}
      date={query.date}
      view={query.view}
      week={query.week}
    />
  )
}
