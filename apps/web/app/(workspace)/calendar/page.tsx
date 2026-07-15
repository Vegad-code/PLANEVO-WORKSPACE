import { CalendarView } from "@/features/calendar/calendar-view";
import { getCalendarData } from "@/lib/queries/calendar";

export default async function CalendarPage() {
  const data = await getCalendarData();
  return <CalendarView data={data} />;
}
