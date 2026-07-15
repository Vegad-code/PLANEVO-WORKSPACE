import { parseMonthParam } from "@planevo/core/state/calendar-state";
import { CalendarView } from "@/features/calendar/calendar-view";
import { getCalendarData } from "@/lib/queries/calendar";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const monthDate =
    parseMonthParam(month) ??
    new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const data = await getCalendarData(monthDate);
  return <CalendarView data={data} month={month} />;
}
