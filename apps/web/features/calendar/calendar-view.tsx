import type { CalendarData } from "@planevo/core/queries/calendar";
import { Icon } from "@/components/ui/planevo-icon";
import { createWorkspaceCalendar } from "@/app/(workspace)/calendar/actions";
import { MonthGrid } from "@/features/database/month-grid";

export function CalendarView({ data, month }: { data: CalendarData; month?: string }) {
  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col px-5 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-label uppercase text-text-muted">All dated work</p>
          <h1 className="mt-2 text-h1">Calendar</h1>
          <p className="mt-2 text-body text-text-secondary">
            Every dated record across this workspace, in one place.
          </p>
        </div>
        {!data.hasCalendarDatabase && (
          <form action={createWorkspaceCalendar}>
            <button
              type="submit"
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-border-strong bg-paper px-3 text-small font-medium outline-none hover:border-ink focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              <Icon name="calendar" />
              Create calendar
            </button>
          </form>
        )}
      </div>

      <div className="mt-8">
        <MonthGrid
          items={data.items.map((item) => ({
            id: item.id,
            recordId: item.recordId,
            databaseId: item.databaseId,
            title: item.title,
            date: item.date,
            subtitle: item.databaseName,
          }))}
          month={month}
          monthHrefBase="/calendar"
        />
      </div>

      {data.items.length === 0 && (
        <p className="mt-4 text-center text-small text-text-muted">
          No dated records this month. Add a due date to a task or create your first calendar.
        </p>
      )}
    </div>
  );
}
