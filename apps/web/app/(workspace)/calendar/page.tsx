import { CalendarProductPage } from "@/features/calendar-product/calendar-product-page"
import type { CalendarScope } from "@/lib/calendar/scope-prefs"

function requestedScope(value: string | undefined): CalendarScope {
  return value === "workspace" ? "workspace" : "all"
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
      context={{ kind: "main" }}
      date={date}
      view={view}
      week={week}
    />
  )
}
