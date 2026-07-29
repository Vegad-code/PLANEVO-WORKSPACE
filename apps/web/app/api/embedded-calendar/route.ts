import { NextResponse } from "next/server"
import { z } from "zod"
import { loadCalendars } from "@planevo/core/queries/product-calendar"
import {
  embeddedCalendarRequest,
  parseCalendarEmbedTarget,
} from "@/lib/calendar/embedded-calendar"
import {
  fetchCalendarPageData,
  serializeCalendarQueryData,
} from "@/lib/calendar/fetch-calendar-page-data"
import { mapTypedError } from "@/lib/api/typed-errors"
import { getDataAccess } from "@/lib/data/access"
import { enforceRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit.server"
import { parseCalendarDate } from "@/lib/calendar/calendar-range"

const viewSchema = z.enum(["day", "week", "month"])
const calendarIdSchema = z.string().uuid()
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" }

export async function GET(request: Request) {
  const url = new URL(request.url)
  const target = parseCalendarEmbedTarget({
    targetKind: url.searchParams.get("targetKind") ?? "",
    calendarId: url.searchParams.get("calendarId") ?? undefined,
  })
  const parsedView = viewSchema.safeParse(url.searchParams.get("view"))
  const anchor = parseCalendarDate(
    url.searchParams.get("date") ?? undefined,
  )
  if (
    !target ||
    !parsedView.success ||
    (target.kind === "calendar" &&
      !calendarIdSchema.safeParse(target.calendarId).success)
  ) {
    return NextResponse.json(
      { error: "A valid calendar target is required." },
      { status: 400, headers: NO_STORE_HEADERS },
    )
  }

  const access = await getDataAccess()
  if (!access) {
    return NextResponse.json(
      { error: "Sign in to see this calendar." },
      { status: 401, headers: NO_STORE_HEADERS },
    )
  }

  try {
    await enforceRateLimit(access, "embedded-calendar:get", RATE_LIMITS.read)
    const calendars = await loadCalendars(access.client, access.ownerId)
    if (
      target.kind === "calendar" &&
      !calendars.some(({ id }) => id === target.calendarId)
    ) {
      return NextResponse.json(
        { error: "Calendar not found." },
        { status: 404, headers: NO_STORE_HEADERS },
      )
    }

    const ready = await fetchCalendarPageData(
      access,
      null,
      "all",
      embeddedCalendarRequest({
        target,
        view: parsedView.data,
        now: anchor,
      }),
    )

    return NextResponse.json(
      {
        target,
        data: serializeCalendarQueryData(ready),
      },
      { headers: NO_STORE_HEADERS },
    )
  } catch (cause) {
    const mapped = mapTypedError(cause)
    if (mapped) return mapped
    return NextResponse.json(
      { error: "Failed to load embedded calendar." },
      { status: 500, headers: NO_STORE_HEADERS },
    )
  }
}
