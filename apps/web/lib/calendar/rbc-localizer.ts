import { dateFnsLocalizer } from "react-big-calendar"
import { format } from "date-fns/format"
import { getDay } from "date-fns/getDay"
import { startOfWeek } from "date-fns/startOfWeek"
import { enUS } from "date-fns/locale/en-US"

const locales = { "en-US": enUS }

/** Sunday-start localizer — matches Google Calendar week columns. */
export const calendarLocalizer = dateFnsLocalizer({
  format,
  getDay,
  locales,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 0 }),
})
