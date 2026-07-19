import { CalendarProductView } from "@/features/calendar-product/calendar-product-view";
import { loadCalendarPageData } from "@/lib/queries/product-calendar";
import type { CalendarScope } from "@/lib/calendar/scope-prefs";

function requestedScope(value: string | undefined): CalendarScope {
  return value === "workspace" ? "workspace" : "all";
}

async function CalendarProductPage({
  scope,
  week,
}: {
  scope: CalendarScope;
  week?: string;
}) {
  let data = await loadCalendarPageData(scope, week);
  if (
    data.status === "ready" &&
    data.scope === "workspace" &&
    data.workspaceId === null
  ) {
    data = await loadCalendarPageData("all", week);
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
    );
  }

  return (
    <CalendarProductView
      weekStart={data.weekStart}
      calendars={data.calendars}
      events={data.events}
      taskDues={data.taskDues}
      todayTasks={data.todayTasks}
      initialScope={data.scope}
      workspaceId={data.workspaceId}
    />
  );
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; week?: string }>;
}) {
  const { scope, week } = await searchParams;
  return <CalendarProductPage scope={requestedScope(scope)} week={week} />;
}
