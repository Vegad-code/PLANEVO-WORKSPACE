import type { CalendarViewRow } from "@planevo/core/types/calendar"
import { dateParam } from "./calendar-range.ts"
import type { CalendarPageRequest } from "./fetch-calendar-page-data.ts"
import { resolveViewConfig } from "./view-config.ts"
import { toolbarViewForSavedConfig } from "./view-crud.ts"

/**
 * Turns a persisted lens into the same URL-level request used by /calendar.
 * Keeping this decision shared prevents embeds from inventing a second range
 * model when a saved view is edited.
 */
export function embeddedCalendarRequest(
  view: CalendarViewRow,
  now: Date,
): Required<Pick<CalendarPageRequest, "date" | "view">> {
  const config = resolveViewConfig(view.preset, view.config)
  return {
    date: dateParam(now),
    view: toolbarViewForSavedConfig(config),
  }
}
