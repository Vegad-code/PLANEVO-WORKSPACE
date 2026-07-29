import type {
  CalendarMetaQueryPayload,
  CalendarRangeQueryPayload,
  CalendarTodayQueryPayload,
} from "./fetch-calendar-page-data.ts"

/**
 * Keep independently cached calendar regions renderable while another region
 * is loading. A range miss should not erase the toolbar, and a task refresh
 * should not blank an already-ready grid.
 */
export function calendarRenderSlices({
  range,
  meta,
  today,
}: {
  range: CalendarRangeQueryPayload | undefined
  meta: CalendarMetaQueryPayload | undefined
  today: CalendarTodayQueryPayload | undefined
}) {
  return {
    calendars: meta?.calendars ?? [],
    events: range?.events ?? [],
    taskDues: range?.taskDues ?? [],
    todayTasks: today?.todayTasks ?? [],
  }
}
