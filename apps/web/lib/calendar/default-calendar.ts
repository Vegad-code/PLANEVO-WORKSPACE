import type { CalendarRow } from "@planevo/core/types/calendar";

export function defaultCalendarId(
  calendars: Array<Pick<CalendarRow, "id" | "is_default">>,
): string {
  return (
    calendars.find(({ is_default }) => is_default)?.id ??
    calendars[0]?.id ??
    ""
  );
}
